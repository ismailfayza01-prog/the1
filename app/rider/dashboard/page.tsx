'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { userService, riderService, deliveryService } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import { getRiderCommission } from '@/lib/types';
import type { LatLng, RouteResponse } from '@/lib/navigation/types';
import { MAP_3D_ENABLED } from '@/components/maps/config';
import { RiderMap3D } from '@/components/maps/RiderMap3D';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Package,
  DollarSign,
  LogOut,
  TrendingUp,
  CheckCircle2,
  Home,
  Navigation,
  Circle,
  Users,
  Zap,
  ExternalLink,
} from 'lucide-react';
import type { User, Rider, Delivery, DeliveryOffer } from '@/lib/types';
import Link from 'next/link';

const MAP_BOUNDS = { latMin: 35.74, latMax: 35.79, lngMin: -5.86, lngMax: -5.8 };
const ROUTING_ENABLED = process.env.NEXT_PUBLIC_ROUTING_ENABLED !== 'false';
const ROUTE_REQUEST_DEBOUNCE_MS = 10_000;
const ROUTE_RECALC_DISTANCE_M = 150;
const MISSING_RIDER_PROFILE_MESSAGE = 'Rider profile not found. Ask admin to provision your rider account or apply the latest Supabase migration.';
type NavigationStage = 'pickup' | 'dropoff';

interface NavigationRequestSnapshot {
  deliveryId: string;
  stage: NavigationStage;
  origin: LatLng;
  destination: LatLng;
  requestedAt: number;
}

function formatDistanceMeters(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(value))} m`;
}

function formatDurationSeconds(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  const h = Math.floor(safe / 3600);
  const m = Math.round((safe % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatEtaCountdown(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  if (m === 0) return `${s} sec`;
  return `${m} min ${s.toString().padStart(2, '0')} sec`;
}

function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const x = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
  const y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));

  return earth * y;
}

function getNavigationStage(status: Delivery['status']): NavigationStage {
  if (status === 'picked_up' || status === 'in_transit') return 'dropoff';
  return 'pickup';
}

function buildExternalNavLinks(origin: LatLng, destination: LatLng): { google_maps: string; waze: string } {
  const originStr = `${origin.lat},${origin.lng}`;
  const destinationStr = `${destination.lat},${destination.lng}`;

  return {
    google_maps: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destinationStr)}&travelmode=driving`,
    waze: `https://www.waze.com/ul?ll=${encodeURIComponent(destinationStr)}&navigate=yes`,
  };
}

function seedLocation(id: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const lat = MAP_BOUNDS.latMin + ((h & 0xff) / 255) * (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin);
  const lng = MAP_BOUNDS.lngMin + (((h >> 8) & 0xff) / 255) * (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin);
  return { lat, lng };
}

function getRiderLocation(rider: Rider): { lat: number; lng: number } {
  if (typeof rider.last_lat === 'number' && typeof rider.last_lng === 'number') {
    return { lat: rider.last_lat, lng: rider.last_lng };
  }
  const fromJson = rider.current_location as { lat: number; lng: number } | null;
  if (fromJson) return fromJson;
  return seedLocation(rider.id);
}

function getRiderStatusColor(status: Rider['status']): string {
  if (status === 'available') return '#10b981';
  if (status === 'busy') return '#f59e0b';
  return '#94a3b8';
}

function getRiderMotoIcon(L: any, status: Rider['status']): any {
  const size = 42;
  const statusColor = getRiderStatusColor(status);
  const statusClass = status === 'available'
    ? 'map-rider-status--online'
    : status === 'busy'
      ? 'map-rider-status--busy'
      : 'map-rider-status--offline';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div class="map-rider-marker" style="width:${size}px;height:${size}px;">
        <div class="map-rider-core" style="width:${size}px;height:${size}px;">
          <svg class="map-rider-bike" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="6" cy="17" r="3"></circle>
            <circle cx="18" cy="17" r="3"></circle>
            <path d="M6 17h6l2-6h-4l-2 6"></path>
            <path d="M14 7h3l2 4"></path>
          </svg>
        </div>
        <div class="map-rider-status ${statusClass}" style="background:${statusColor};"></div>
      </div>
    `,
  });
}

function getPickupFlagIcon(L: any): any {
  return L.divIcon({
    className: '',
    iconSize: [30, 36],
    iconAnchor: [15, 34],
    html: `
      <div class="map-flag-marker">
        <div class="map-flag-pole map-flag-pole--pickup"></div>
        <div class="map-flag-cloth map-flag-cloth--pickup"></div>
      </div>
    `,
  });
}

function getDropoffFlagIcon(L: any): any {
  return L.divIcon({
    className: '',
    iconSize: [30, 36],
    iconAnchor: [15, 34],
    html: `
      <div class="map-flag-marker">
        <div class="map-flag-pole map-flag-pole--dropoff"></div>
        <div class="map-flag-cloth map-flag-cloth--dropoff"></div>
      </div>
    `,
  });
}

function getDeliveryPoint(delivery: Delivery, kind: 'pickup' | 'dropoff'): { lat: number; lng: number } {
  if (kind === 'pickup' && typeof delivery.pickup_lat === 'number' && typeof delivery.pickup_lng === 'number') {
    return { lat: delivery.pickup_lat, lng: delivery.pickup_lng };
  }
  if (kind === 'dropoff' && typeof delivery.dropoff_lat === 'number' && typeof delivery.dropoff_lng === 'number') {
    return { lat: delivery.dropoff_lat, lng: delivery.dropoff_lng };
  }
  return seedLocation(`${delivery.id}-${kind}`);
}

interface RiderLiveMapProps {
  rider: Rider;
  activeDelivery: Delivery | null;
  assignedDelivery: Delivery | null;
  liveLocation: { lat: number; lng: number } | null;
  navigationRoute: RouteResponse | null;
}

interface RiderStatusResponse {
  ok?: boolean;
  rider?: Rider;
  notice?: string;
  error?: string;
}

function RiderLiveMap({ rider, activeDelivery, assignedDelivery, liveLocation, navigationRoute }: RiderLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const ridersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initMap = async () => {
      if (!mapContainerRef.current || mapRef.current) return;

      const L = await import('leaflet');
      if (!mounted) return;
      leafletRef.current = L;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      });

      map.setView([35.7595, -5.834], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      ridersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => map.invalidateSize(), 50);
    };

    void initMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      ridersLayerRef.current = null;
      routeLayerRef.current = null;
      leafletRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapRef.current || !ridersLayerRef.current || !routeLayerRef.current) return;

    const L = leafletRef.current;
    const map = mapRef.current;
    const ridersLayer = ridersLayerRef.current;
    const routeLayer = routeLayerRef.current;
    ridersLayer.clearLayers();
    routeLayer.clearLayers();

    const riderLoc = liveLocation ?? getRiderLocation(rider);

    L.marker([riderLoc.lat, riderLoc.lng], {
      icon: getRiderMotoIcon(L, rider.status),
    })
      .addTo(ridersLayer)
      .bindTooltip(`You · ${rider.status}`, { direction: 'top', offset: [0, -8] });

    const routeDelivery = activeDelivery ?? assignedDelivery;
    if (!routeDelivery) {
      map.setView([riderLoc.lat, riderLoc.lng], 13);
      return;
    }

    const pickup = getDeliveryPoint(routeDelivery, 'pickup');
    const dropoff = getDeliveryPoint(routeDelivery, 'dropoff');
    const isActive = !!activeDelivery;
    const navigationStage = getNavigationStage(routeDelivery.status);
    const destination = navigationStage === 'pickup' ? pickup : dropoff;
    const routePoints: [number, number][] = navigationRoute?.ok && navigationRoute.geometry.length > 1
      ? navigationRoute.geometry.map((point) => [point.lat, point.lng] as [number, number])
      : [
          [riderLoc.lat, riderLoc.lng],
          [destination.lat, destination.lng],
        ];

    L.polyline(routePoints, {
      color: isActive ? '#10b981' : '#f59e0b',
      weight: 3,
      dashArray: navigationRoute?.ok ? undefined : '6 6',
    })
      .addTo(routeLayer)
      .bindTooltip(`${routeDelivery.status.replace('_', ' ')}${navigationRoute?.ok ? ' · routed' : ' · fallback'}`, {
        direction: 'top',
        offset: [0, -8],
      });

    L.marker([pickup.lat, pickup.lng], {
      icon: getPickupFlagIcon(L),
    })
      .addTo(routeLayer)
      .bindTooltip('Pickup', { direction: 'top', offset: [0, -8] });

    L.marker([dropoff.lat, dropoff.lng], {
      icon: getDropoffFlagIcon(L),
    })
      .addTo(routeLayer)
      .bindTooltip('Dropoff', { direction: 'top', offset: [0, -8] });

    map.fitBounds(L.latLngBounds(routePoints), { padding: [32, 32], maxZoom: 15 });
  }, [rider, activeDelivery, assignedDelivery, liveLocation, mapReady, navigationRoute]);

  return <div ref={mapContainerRef} role="region" aria-label="Rider live route map for Tangier" className="h-full w-full rounded-2xl" />;
}

export default function RiderDashboardPage() {
  const router = useRouter();
  const [initializing, setInitializing] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [recoveringAccess, setRecoveringAccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [offers, setOffers] = useState<DeliveryOffer[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [incomingNotice, setIncomingNotice] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusAccessToken, setStatusAccessToken] = useState('');
  const [liveRiderLocation, setLiveRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [navigationRoute, setNavigationRoute] = useState<RouteResponse | null>(null);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const [navigationError, setNavigationError] = useState('');
  const [etaCountdownSeconds, setEtaCountdownSeconds] = useState<number | null>(null);
  const etaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offerSnapshotRef = useRef<Set<string>>(new Set());
  const assignedSnapshotRef = useRef<string | null>(null);
  const hydratedNoticeRef = useRef(false);
  const navigationRequestRef = useRef<NavigationRequestSnapshot | null>(null);

  const refreshRiderData = async (riderId: string, userId: string) => {
    setDeliveries(await deliveryService.getByRiderId(riderId));
    setPendingDeliveries((await deliveryService.getActive()).filter((d) => d.status === 'pending' && !d.rider_id));
    setOffers(await deliveryService.getMyOffers());
    setAccessError('');
    let riderFresh = await riderService.getByUserId(userId);
    if (!riderFresh) {
      try {
        riderFresh = (await riderService.ensureCurrentUserProfile()) ?? undefined;
      } catch (error) {
        console.error('Rider profile auto-recovery failed during refresh', error);
      }
    }

    if (!riderFresh) {
      setRider(null);
      setIsOnline(false);
      setAccessError(MISSING_RIDER_PROFILE_MESSAGE);
      return;
    }

    setRider(riderFresh);
    setIsOnline(riderFresh.status !== 'offline');
    const dbLoc =
      typeof riderFresh.last_lat === 'number' && typeof riderFresh.last_lng === 'number'
        ? { lat: riderFresh.last_lat, lng: riderFresh.last_lng }
        : (riderFresh.current_location as { lat: number; lng: number } | null);
    setLiveRiderLocation((prev) => prev ?? dbLoc ?? null);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLiveRiderLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Keep map on latest known location if geolocation updates fail.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let locationInterval: ReturnType<typeof setInterval> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let userId: string | null = null;
    let riderId: string | null = null;

    async function init() {
      setInitializing(true);
      setAccessError('');

      const getDeviceLocation = async (): Promise<{ lat: number; lng: number } | null> => {
        if (typeof window === 'undefined' || !('geolocation' in navigator)) {
          return null;
        }

        return await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (position) =>
              resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              }),
            () => resolve(null),
            {
              enableHighAccuracy: true,
              maximumAge: 10000,
              timeout: 8000,
            }
          );
        });
      };

      const sendPresenceHeartbeat = async () => {
        if (!riderId || !userId) return;
        const r = await riderService.getByUserId(userId);
        if (!r || r.status === 'offline') return;

        const liveLocation = await getDeviceLocation();
        if (!liveLocation) {
          await riderService.pingPresence(r.id, null);
          return;
        }

        const prevLat =
          typeof r.last_lat === 'number'
            ? r.last_lat
            : (r.current_location as { lat: number; lng: number } | null)?.lat;
        const prevLng =
          typeof r.last_lng === 'number'
            ? r.last_lng
            : (r.current_location as { lat: number; lng: number } | null)?.lng;
        const movedEnough =
          prevLat == null || prevLng == null || Math.hypot(liveLocation.lat - prevLat, liveLocation.lng - prevLng) > 0.0002; // ~20m

        if (movedEnough) {
          setLiveRiderLocation(liveLocation);
          const nowIso = new Date().toISOString();
          setRider((prev) => {
            if (!prev || prev.id !== r.id) return prev;
            return {
              ...prev,
              current_location: liveLocation,
              last_lat: liveLocation.lat,
              last_lng: liveLocation.lng,
              last_seen_at: nowIso,
              last_location_update: nowIso,
            };
          });
          await riderService.pingPresence(r.id, liveLocation);
        } else {
          await riderService.pingPresence(r.id, null);
        }
      };

      try {
        const user = await userService.getCurrentUser();
        if (!user || user.role !== 'rider') {
          router.push('/rider');
          return;
        }

        const { data: authData } = await supabase.auth.getSession();
        if (authData.session?.access_token) {
          setStatusAccessToken(authData.session.access_token);
        }

        userId = user.id;
        setCurrentUser(user);
        let riderData = await riderService.getByUserId(user.id);
        if (!riderData) {
          try {
            riderData = (await riderService.ensureCurrentUserProfile()) ?? undefined;
            if (riderData) {
              setIncomingNotice('Rider profile restored. You can continue working.');
            }
          } catch (error) {
            console.error('Rider profile auto-recovery failed during init', error);
          }
        }

        if (!riderData) {
          setAccessError(MISSING_RIDER_PROFILE_MESSAGE);
        } else {
          riderId = riderData.id;
          setRider(riderData);
          setIsOnline(riderData.status !== 'offline');
          await refreshRiderData(riderData.id, user.id);
          if (riderData.status !== 'offline') {
            await sendPresenceHeartbeat();
          }
        }

        // Presence heartbeat every 15s using real device location when available.
        locationInterval = setInterval(async () => {
          try {
            await sendPresenceHeartbeat();
          } catch (err) {
            console.error('Presence heartbeat error', err);
          }
        }, 15000);

        // Polling fallback in case realtime drops.
        pollInterval = setInterval(async () => {
          if (!riderId || !userId) return;
          await refreshRiderData(riderId, userId);
        }, 8000);

        // Realtime subscriptions
        channel = supabase.channel('rider-dashboard')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, async () => {
            if (riderId && userId) {
              await refreshRiderData(riderId, userId);
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_offers' }, async () => {
            if (riderId && userId) {
              await refreshRiderData(riderId, userId);
            }
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, async () => {
            if (riderId && userId) {
              await refreshRiderData(riderId, userId);
            }
          })
          .subscribe();
      } catch (error) {
        console.error('Rider dashboard init failed', error);
        setAccessError('Unable to initialize rider dashboard. Please retry.');
      } finally {
        setInitializing(false);
      }
    }
    init();

    return () => {
      if (locationInterval) clearInterval(locationInterval);
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const statusNotice = params.get('status_notice');
    const statusError = params.get('status_error');
    if (statusNotice) {
      setIncomingNotice(statusNotice);
    } else if (statusError) {
      setIncomingNotice(`Status update failed: ${statusError}`);
    } else {
      return;
    }
    params.delete('status_notice');
    params.delete('status_error');
    const query = params.toString();
    const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl);
  }, []);

  useEffect(() => {
    const offeredIds = offers.filter((o) => o.status === 'offered').map((o) => o.id);
    const assignedPendingId = deliveries.find((d) => d.status === 'pending')?.id ?? null;

    if (!hydratedNoticeRef.current) {
      offerSnapshotRef.current = new Set(offeredIds);
      assignedSnapshotRef.current = assignedPendingId;
      hydratedNoticeRef.current = true;
      return;
    }

    const hasNewOffer = offeredIds.some((id) => !offerSnapshotRef.current.has(id));
    if (hasNewOffer) {
      setIncomingNotice('New delivery offer received.');
    }

    if (assignedPendingId && assignedPendingId !== assignedSnapshotRef.current) {
      setIncomingNotice('A delivery was assigned to you.');
    }

    offerSnapshotRef.current = new Set(offeredIds);
    assignedSnapshotRef.current = assignedPendingId;
  }, [offers, deliveries]);

  useEffect(() => {
    if (!ROUTING_ENABLED || !rider) {
      setNavigationRoute(null);
      setNavigationError('');
      navigationRequestRef.current = null;
      return;
    }

    const active = deliveries.find((d) => ['accepted', 'picked_up', 'in_transit'].includes(d.status));
    const assigned = deliveries.find((d) => d.status === 'pending');
    const routeDelivery = active ?? assigned;

    if (!routeDelivery) {
      setNavigationRoute(null);
      setNavigationError('');
      navigationRequestRef.current = null;
      return;
    }

    const stage = getNavigationStage(routeDelivery.status);
    const destination = getDeliveryPoint(routeDelivery, stage === 'pickup' ? 'pickup' : 'dropoff');
    const origin = liveRiderLocation ?? getRiderLocation(rider);
    const now = Date.now();

    const previous = navigationRequestRef.current;
    const sameDeliveryAndStage =
      !!previous &&
      previous.deliveryId === routeDelivery.id &&
      previous.stage === stage &&
      haversineDistanceMeters(previous.destination, destination) < 10;

    if (sameDeliveryAndStage) {
      const moved = haversineDistanceMeters(previous.origin, origin);
      if (moved <= ROUTE_RECALC_DISTANCE_M) {
        return;
      }
      if (now - previous.requestedAt < ROUTE_REQUEST_DEBOUNCE_MS) {
        return;
      }
    }

    if (!sameDeliveryAndStage) {
      setNavigationRoute(null);
    }

    navigationRequestRef.current = {
      deliveryId: routeDelivery.id,
      stage,
      origin,
      destination,
      requestedAt: now,
    };

    const controller = new AbortController();
    let cancelled = false;
    setNavigationError('');
    setNavigationLoading(true);

    async function loadRoute() {
      try {
        const response = await fetch('/api/navigation/route', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            origin,
            destination,
            profile: 'driving',
            locale: 'fr',
          }),
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as RouteResponse | null;
        if (cancelled) return;

        if (!response.ok) {
          setNavigationRoute(payload);
          if (payload?.error_code === 'RATE_LIMIT') {
            setNavigationError('Routing limite temporairement. Utilisez Google Maps ou Waze.');
          } else if (payload?.error_code === 'INVALID_COORDS') {
            setNavigationError('Coordonnees invalides. Navigation detaillee indisponible.');
          } else {
            setNavigationError('Route detaillee indisponible, fallback active.');
          }
          return;
        }

        if (!payload) {
          setNavigationRoute(null);
          setNavigationError('Route detaillee indisponible, fallback active.');
          return;
        }

        setNavigationRoute(payload);
        setNavigationError(payload.degraded_mode ? 'Route detaillee indisponible, fallback active.' : '');
      } catch (error) {
        if (cancelled || controller.signal.aborted) return;
        console.error('Routing request failed', error);
        setNavigationError('Route detaillee indisponible, fallback active.');
      } finally {
        if (!cancelled) {
          setNavigationLoading(false);
        }
      }
    }

    void loadRoute();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [rider, deliveries, liveRiderLocation]);

  // ETA countdown — ticks down from navigationRoute.duration_s
  useEffect(() => {
    if (etaIntervalRef.current) {
      clearInterval(etaIntervalRef.current);
      etaIntervalRef.current = null;
    }

    if (!navigationRoute?.ok || !navigationRoute.duration_s) {
      setEtaCountdownSeconds(null);
      return;
    }

    setEtaCountdownSeconds(navigationRoute.duration_s);

    etaIntervalRef.current = setInterval(() => {
      setEtaCountdownSeconds((prev) => {
        if (prev === null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (etaIntervalRef.current) {
        clearInterval(etaIntervalRef.current);
        etaIntervalRef.current = null;
      }
    };
  }, [navigationRoute]);

  const handleLogout = async () => {
    if (rider) {
      await riderService.updateStatus(rider.id, 'offline');
    }
    await userService.logout();
    router.push('/rider');
  };

  const handleToggleStatus = async (checked: boolean) => {
    if (!rider || !currentUser) return;

    const nextStatus: Rider['status'] = checked ? 'available' : 'offline';
    const prevOnline = isOnline;
    setIsOnline(checked);
    setStatusUpdating(true);

    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token ?? statusAccessToken;
      if (accessToken && accessToken !== statusAccessToken) {
        setStatusAccessToken(accessToken);
      }

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      let updatedRider: Rider | undefined;
      const response = await fetch('/api/rider/status', {
        method: 'POST',
        headers,
        body: JSON.stringify(accessToken
          ? { status: nextStatus, access_token: accessToken }
          : { status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as RiderStatusResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `Status update failed (${response.status})`);
      }
      if (payload.rider) {
        updatedRider = payload.rider;
      } else {
        updatedRider = await riderService.getByUserId(currentUser.id);
      }

      if (updatedRider) {
        setRider(updatedRider);
        setIsOnline(updatedRider.status !== 'offline');
      }
      setIncomingNotice(payload?.notice ?? (nextStatus === 'offline'
        ? 'You are offline.'
        : 'You are online and available.'));
    } catch (err) {
      console.error('Toggle status error', err);
      setIsOnline(prevOnline);
      const msg = err instanceof Error ? err.message : 'Status update failed';
      setIncomingNotice(`Status update failed: ${msg}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAcceptDelivery = async (offerId: string) => {
    if (!rider) return;
    try {
      const accepted = await deliveryService.acceptOffer(offerId);
      if (!accepted) {
        setIncomingNotice('Offer could not be confirmed. Ask for a new dispatch.');
      }
      if (currentUser) {
        await refreshRiderData(rider.id, currentUser.id);
      }
    } catch (err) {
      console.error('Accept offer error', err);
      const msg = err instanceof Error ? err.message : 'Offer accept failed';
      setIncomingNotice(msg.toLowerCase().includes('expired')
        ? 'Offer expired. Ask business/admin to dispatch again.'
        : 'Unable to accept this offer now. Ask for a new dispatch.');
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    try {
      await deliveryService.refuseOffer(offerId);
      if (rider && currentUser) {
        await refreshRiderData(rider.id, currentUser.id);
      }
    } catch (err) {
      console.error('Reject offer error', err);
    }
  };

  const handleAcceptAssignedDelivery = async (deliveryId: string) => {
    if (!rider || !currentUser) return;
    try {
      await deliveryService.update(deliveryId, {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      });
      await riderService.update(rider.id, {
        status: 'busy',
        last_seen_at: new Date().toISOString(),
      });
      await refreshRiderData(rider.id, currentUser.id);
    } catch (err) {
      console.error('Accept assigned delivery error', err);
    }
  };

  const handleVerifyOtp = async (deliveryId: string) => {
    if (!/^\d{4}$/.test(otpInput)) {
      setOtpError('OTP must be exactly 4 digits.');
      return;
    }
    setOtpSubmitting(true);
    setOtpError('');
    try {
      await deliveryService.verifyDeliveryOtp(deliveryId, otpInput);
      setOtpInput('');
      if (rider && currentUser) {
        await refreshRiderData(rider.id, currentUser.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OTP verification failed';
      if (msg.toLowerCase().includes('expired')) {
        setOtpError('OTP expired. Please request a new code.');
      } else if (msg.toLowerCase().includes('invalid')) {
        setOtpError('Invalid OTP. Please try again.');
      } else {
        setOtpError(msg);
      }
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleUploadPhoto = async (deliveryId: string, file: File) => {
    setPhotoUploading(true);
    setPhotoError('');
    try {
      const supabase = createClient();
      const key = `${deliveryId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('delivery-pod').upload(key, file, {
        upsert: false,
        contentType: file.type || 'image/jpeg',
      });
      if (error) throw error;

      await deliveryService.submitDeliveryPhoto(deliveryId, key);
      if (rider && currentUser) {
        await refreshRiderData(rider.id, currentUser.id);
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleMarkPickedUp = async (deliveryId: string) => {
    await deliveryService.update(deliveryId, {
      status: 'picked_up',
      picked_up_at: new Date().toISOString(),
    });
    if (rider && currentUser) {
      await refreshRiderData(rider.id, currentUser.id);
    }
  };

  const handleMarkInTransit = async (deliveryId: string) => {
    await deliveryService.update(deliveryId, { status: 'in_transit' });
    if (rider && currentUser) {
      await refreshRiderData(rider.id, currentUser.id);
    }
  };

  const handleMarkDelivered = async (deliveryId: string) => {
    if (!rider) return;
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    const actualDuration = delivery.picked_up_at
      ? Math.round((Date.now() - new Date(delivery.picked_up_at).getTime()) / 60000)
      : delivery.estimated_duration;

    // Respect DB guard: transition to in_transit then deliver via PoD RPC.
    if (delivery.status === 'picked_up') {
      await deliveryService.update(deliveryId, { status: 'in_transit' });
    }
    await deliveryService.submitDeliveryPhoto(deliveryId, `rider-marked-delivered-${Date.now()}`);
    await deliveryService.update(deliveryId, {
      completed_at: new Date().toISOString(),
      actual_duration: actualDuration,
    });

    await riderService.update(rider.id, {
      total_deliveries: rider.total_deliveries + 1,
      earnings_this_month: rider.earnings_this_month + delivery.rider_commission,
      status: 'available',
      last_seen_at: new Date().toISOString(),
    });

    if (currentUser) {
      await refreshRiderData(rider.id, currentUser.id);
    }
  };

  const handleRecoverAccess = async () => {
    if (!currentUser) return;
    setRecoveringAccess(true);
    setAccessError('');
    try {
      const ensured = await riderService.ensureCurrentUserProfile();
      const recovered = ensured ?? (await riderService.getByUserId(currentUser.id));
      if (!recovered) {
        setAccessError(MISSING_RIDER_PROFILE_MESSAGE);
        return;
      }

      setIncomingNotice('Rider profile restored. You can continue working.');
      setRider(recovered);
      setIsOnline(recovered.status !== 'offline');
      await refreshRiderData(recovered.id, currentUser.id);
    } catch (error) {
      console.error('Rider access recovery failed', error);
      setAccessError('Access recovery failed. Please retry or contact admin.');
    } finally {
      setRecoveringAccess(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md border border-border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Loading rider dashboard...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Checking account access and rider profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser) return null;

  if (!rider) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md border border-red-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-red-600">Rider access issue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {accessError || MISSING_RIDER_PROFILE_MESSAGE}
            </p>
            <div className="flex gap-2">
              <Button onClick={handleRecoverAccess} disabled={recoveringAccess}>
                {recoveringAccess ? 'Recovering...' : 'Retry access'}
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeDelivery = deliveries.find(d => ['accepted', 'picked_up', 'in_transit'].includes(d.status));
  const assignedPendingDelivery = deliveries.find(d => d.status === 'pending');
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');
  const navigationDelivery = activeDelivery ?? assignedPendingDelivery ?? null;
  const navigationStage = navigationDelivery ? getNavigationStage(navigationDelivery.status) : null;
  const navigationTarget = navigationDelivery && navigationStage
    ? getDeliveryPoint(navigationDelivery, navigationStage === 'pickup' ? 'pickup' : 'dropoff')
    : null;
  const navigationOrigin = liveRiderLocation ?? getRiderLocation(rider);
  const fallbackLinks = navigationTarget ? buildExternalNavLinks(navigationOrigin, navigationTarget) : null;
  const externalLinks = navigationRoute?.fallback_links ?? fallbackLinks;
  const routeSteps = navigationRoute?.steps?.slice(0, 5) ?? [];

  const currentTier = getRiderCommission(rider.total_deliveries);
  const nextTier = rider.total_deliveries < 31 ? 31 : rider.total_deliveries < 71 ? 71 : rider.total_deliveries < 200 ? 200 : 200;
  const progressToNextTier = rider.total_deliveries < 200
    ? ((rider.total_deliveries % (nextTier === 31 ? 31 : nextTier === 71 ? 40 : 130)) / (nextTier === 31 ? 31 : nextTier === 71 ? 40 : 130)) * 100
    : 100;

  const statusColors = {
    available: { dot: 'bg-emerald-500', label: 'Online', sub: 'Accepting deliveries', ring: 'ring-emerald-200' },
    busy: { dot: 'bg-amber-500', label: 'On Delivery', sub: 'Currently on a delivery', ring: 'ring-amber-200' },
    offline: { dot: 'bg-slate-400', label: 'Offline', sub: 'Not accepting deliveries', ring: 'ring-slate-200' },
  };

  const sc = statusColors[rider.status] || statusColors.offline;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-emerald-50">
                <Home className="h-5 w-5 text-emerald-600" />
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-foreground leading-tight">{rider.name}</h1>
                <p className="text-xs text-muted-foreground leading-tight">Rider Dashboard</p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleLogout}
            className="rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {incomingNotice && (
          <Card className="border border-emerald-200 bg-emerald-50 shadow-sm">
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-700">{incomingNotice}</p>
                <Button size="sm" variant="outline" onClick={() => setIncomingNotice('')}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Toggle */}
        <Card className="border border-border bg-white shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`relative h-4 w-4 rounded-full ${sc.dot} ring-4 ${sc.ring} ${isOnline ? 'animate-pulse' : ''}`} />
                <div>
                  <Label htmlFor="status-toggle" className="text-base font-bold cursor-pointer">
                    {sc.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{sc.sub}</p>
                </div>
              </div>
              <Switch
                id="status-toggle"
                checked={isOnline}
                onCheckedChange={handleToggleStatus}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
            <div className="mt-3">
              <form action="/api/rider/status" method="post">
                <input type="hidden" name="status" value={isOnline ? 'offline' : 'available'} />
                <input type="hidden" name="access_token" value={statusAccessToken} />
                <Button
                  type="submit"
                  variant="outline"
                  className="h-9 w-full"
                >
                  {statusUpdating
                    ? 'Updating status...'
                    : isOnline
                      ? 'Go Offline'
                      : 'Go Online'}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-white shadow-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <div className="rounded-xl bg-emerald-100 p-1.5">
                <MapPin className="h-4 w-4 text-emerald-600" />
              </div>
              Live Route Map
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge className="border bg-emerald-100 text-emerald-700 border-emerald-200">You</Badge>
              <Badge className="border bg-sky-100 text-sky-700 border-sky-200">Pickup</Badge>
              <Badge className="border bg-red-100 text-red-700 border-red-200">Dropoff</Badge>
            </div>
            <div className="h-[420px] rounded-2xl border border-border bg-slate-50 relative">
              {/* Next maneuver chip — top-left overlay */}
              {navigationRoute?.ok && routeSteps.length > 0 && (
                <div className="absolute top-3 left-3 z-10 max-w-[75%]">
                  <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-lg border border-slate-100">
                    <Navigation className="h-3.5 w-3.5 text-sky-600 flex-shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">
                      {routeSteps[0].instruction}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
                      · {formatDistanceMeters(routeSteps[0].distance_m)}
                    </span>
                  </div>
                </div>
              )}

              {MAP_3D_ENABLED ? (
                <RiderMap3D
                  rider={rider}
                  activeDelivery={activeDelivery ?? null}
                  assignedDelivery={assignedPendingDelivery ?? null}
                  liveLocation={liveRiderLocation}
                  navigationRoute={navigationRoute}
                  className="h-full w-full rounded-2xl"
                  fallback={(
                    <RiderLiveMap
                      rider={rider}
                      activeDelivery={activeDelivery ?? null}
                      assignedDelivery={assignedPendingDelivery ?? null}
                      liveLocation={liveRiderLocation}
                      navigationRoute={navigationRoute}
                    />
                  )}
                />
              ) : (
                <RiderLiveMap
                  rider={rider}
                  activeDelivery={activeDelivery ?? null}
                  assignedDelivery={assignedPendingDelivery ?? null}
                  liveLocation={liveRiderLocation}
                  navigationRoute={navigationRoute}
                />
              )}

              {/* ETA bar — bottom overlay */}
              {navigationRoute?.ok && etaCountdownSeconds !== null && (
                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <div className="flex items-center justify-between rounded-xl bg-gray-900/85 backdrop-blur-sm px-4 py-2.5 text-white shadow-lg">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3.5 w-3.5 text-emerald-400 animate-pulse flex-shrink-0" />
                      <span className="text-sm font-bold tabular-nums">
                        {formatEtaCountdown(etaCountdownSeconds)}
                      </span>
                    </div>
                    <span className="text-xs text-white/70 font-medium">
                      {formatDistanceMeters(navigationRoute.distance_m)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {navigationDelivery && (
          <Card className="border border-sky-200 bg-sky-50/40 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="rounded-xl bg-sky-100 p-1.5">
                  <Navigation className="h-4 w-4 text-sky-600" />
                </div>
                Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-sky-100 bg-white p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                  Target: {navigationStage === 'dropoff' ? 'Dropoff' : 'Pickup'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {navigationStage === 'dropoff' ? navigationDelivery.dropoff_address : navigationDelivery.pickup_address}
                </p>
              </div>

              {!ROUTING_ENABLED && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Routing desactive via feature flag (`NEXT_PUBLIC_ROUTING_ENABLED=false`).
                </div>
              )}

              {ROUTING_ENABLED && (
                <>
                  {navigationLoading && (
                    <div className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-xs text-sky-700">
                      Calcul de route en cours...
                    </div>
                  )}

                  {navigationError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {navigationError}
                    </div>
                  )}

                  <div className="rounded-xl border border-sky-100 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 mb-2">Etapes</p>
                    {routeSteps.length > 0 ? (
                      <ol className="space-y-2">
                        {routeSteps.map((step) => (
                          <li key={`${step.index}-${step.instruction}`} className="text-xs text-foreground">
                            <span className="font-semibold">{step.index + 1}.</span>{' '}
                            {step.instruction}
                            <span className="text-muted-foreground"> ({formatDistanceMeters(step.distance_m)})</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Etapes indisponibles pour le moment. Utilisez le fallback externe ci-dessous.
                      </p>
                    )}
                  </div>
                </>
              )}

              {externalLinks && (
                <div className="grid grid-cols-2 gap-2">
                  <Button asChild className="h-10 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold">
                    <a href={externalLinks.google_maps} target="_blank" rel="noreferrer">
                      Google Maps
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="h-10 rounded-xl">
                    <a href={externalLinks.waze} target="_blank" rel="noreferrer">
                      Waze
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Earnings Card */}
        <Card className="relative border-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-lg shadow-emerald-200/50 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-10">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white blur-2xl" />
          </div>
          <CardContent className="pt-6 pb-6 relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">This Month</p>
                <p className="text-4xl font-extrabold text-white">{rider.earnings_this_month} <span className="text-xl font-semibold opacity-70">MAD</span></p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>

            <p className="text-white/70 text-sm mb-4">
              {rider.total_deliveries} deliveries · {currentTier} MAD per delivery
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Next tier at {nextTier} deliveries</span>
                <span className="font-bold text-white">{nextTier - rider.total_deliveries} to go</span>
              </div>
              <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-700 rounded-full"
                  style={{ width: `${progressToNextTier}%` }}
                />
              </div>
            </div>

            {/* Commission tier indicators */}
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {[
                { label: '14 MAD', range: '0-30', active: rider.total_deliveries >= 0 },
                { label: '15 MAD', range: '31-70', active: rider.total_deliveries >= 31 },
                { label: '16 MAD', range: '71-199', active: rider.total_deliveries >= 71 },
                { label: '17 MAD', range: '200+', active: rider.total_deliveries >= 200 },
              ].map((tier, i) => (
                <div key={i} className={`rounded-lg p-2 text-center ${tier.active ? 'bg-white/20' : 'bg-white/10'}`}>
                  <p className={`text-xs font-bold ${tier.active ? 'text-white' : 'text-white/50'}`}>{tier.label}</p>
                  <p className={`text-xs ${tier.active ? 'text-white/60' : 'text-white/30'}`}>{tier.range}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Delivery */}
        {activeDelivery && (
          <Card className="border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="rounded-xl bg-emerald-100 p-1.5">
                  <Navigation className="h-4 w-4 text-emerald-600 animate-pulse" />
                </div>
                Active Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-2xl border border-emerald-100 p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pickup</p>
                    <p className="text-sm text-foreground font-medium">{activeDelivery.pickup_address}</p>
                  </div>
                </div>
                <div className="ml-[5px] h-5 border-l-2 border-dashed border-slate-200" />
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dropoff</p>
                    <p className="text-sm text-foreground font-medium">{activeDelivery.dropoff_address}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white border border-emerald-100 p-3 text-center">
                  <p className="text-xs text-muted-foreground">You earn</p>
                  <p className="text-xl font-extrabold text-emerald-600">{activeDelivery.rider_commission} MAD</p>
                </div>
                <div className="rounded-xl bg-white border border-emerald-100 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Est. time</p>
                  <p className="text-xl font-extrabold text-foreground">{activeDelivery.estimated_duration} min</p>
                </div>
              </div>

              <div className="space-y-2">
                {activeDelivery.status === 'accepted' && (
                  <Button
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold"
                    onClick={() => handleMarkPickedUp(activeDelivery.id)}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Arrived at pickup
                  </Button>
                )}
                {activeDelivery.status === 'picked_up' && (
                  <Button
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-md shadow-emerald-200"
                    onClick={() => handleMarkDelivered(activeDelivery.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Delivered
                  </Button>
                )}
                {activeDelivery.status === 'in_transit' && (
                  <Button
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-md shadow-emerald-200"
                    onClick={() => handleMarkDelivered(activeDelivery.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Delivered
                  </Button>
                )}
              </div>

              {['accepted', 'picked_up', 'in_transit'].includes(activeDelivery.status) && (
                <div className="mt-5 space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Proof of Delivery</div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">OTP (4 digits)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="1234"
                        maxLength={4}
                        inputMode="numeric"
                      />
                      <Button
                        className="h-10"
                        onClick={() => handleVerifyOtp(activeDelivery.id)}
                        disabled={otpSubmitting}
                      >
                        Verify
                      </Button>
                    </div>
                    {otpError && <p className="text-xs text-red-500">{otpError}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Photo</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={photoUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadPhoto(activeDelivery.id, file);
                      }}
                    />
                    {photoError && <p className="text-xs text-red-500">{photoError}</p>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Available Offers */}
        {!activeDelivery && assignedPendingDelivery && (
          <Card className="border border-amber-200 bg-amber-50/40 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <div className="rounded-xl bg-amber-100 p-1.5">
                  <Package className="h-4 w-4 text-amber-700" />
                </div>
                Assigned Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-amber-100 bg-white p-3 space-y-2">
                <p className="text-xs text-muted-foreground"><span className="font-semibold">Pickup:</span> {assignedPendingDelivery.pickup_address}</p>
                <p className="text-xs text-muted-foreground"><span className="font-semibold">Dropoff:</span> {assignedPendingDelivery.dropoff_address}</p>
              </div>
              <Button
                className="w-full h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold"
                onClick={() => handleAcceptAssignedDelivery(assignedPendingDelivery.id)}
              >
                Accept Delivery
              </Button>
            </CardContent>
          </Card>
        )}

        {isOnline && !activeDelivery && offers.filter(o => o.status === 'offered').length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-bold text-foreground">Delivery Offers</h2>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">
                {offers.filter(o => o.status === 'offered').length}
              </Badge>
            </div>
            {offers.filter(o => o.status === 'offered').slice(0, 3).map((offer) => {
              const remaining = Math.max(0, Math.ceil((new Date(offer.offered_at).getTime() + 120000 - nowTs) / 1000));
              const delivery = pendingDeliveries.find(d => d.id === offer.delivery_id);

              return (
                <Card key={offer.id} className="border border-border bg-white shadow-sm">
                  <CardContent className="pt-5 space-y-3">
                    {delivery ? (
                      <>
                        <div className="space-y-2.5">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-1 h-2 w-2 rounded-full bg-slate-400 flex-shrink-0" />
                            <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                          </div>
                          <div className="ml-[3px] h-4 border-l-2 border-dashed border-slate-200" />
                          <div className="flex items-start gap-2.5">
                            <MapPin className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
                            <p className="text-sm text-muted-foreground">{delivery.dropoff_address}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 text-center">
                            <p className="text-xs text-muted-foreground">You earn</p>
                            <p className="text-base font-bold text-emerald-600">{currentTier} MAD</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-center">
                            <p className="text-xs text-muted-foreground">Est. time</p>
                            <p className="text-base font-bold text-foreground">~{delivery.estimated_duration} min</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Offer received</p>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {remaining > 0
                        ? `Expires in ${remaining}s`
                        : 'Still selectable. If accept fails, ask for a new dispatch.'}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold"
                        onClick={() => handleAcceptDelivery(offer.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        className="w-full h-10 rounded-xl"
                        variant="outline"
                        onClick={() => handleRejectOffer(offer.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {isOnline && !activeDelivery && offers.filter(o => o.status === 'offered').length === 0 && (
          <Card className="border border-border bg-white shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Package className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="font-bold text-foreground">No offers available</p>
              <p className="text-sm text-muted-foreground mt-1">New requests will appear here</p>
            </CardContent>
          </Card>
        )}

        {/* Offline State */}
        {!isOnline && !assignedPendingDelivery && !activeDelivery && (
          <Card className="border border-border bg-white shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Circle className="h-7 w-7 text-slate-400" />
              </div>
              <p className="font-bold text-foreground">You're offline</p>
              <p className="text-sm text-muted-foreground mt-1">Turn on your status to start accepting deliveries</p>
            </CardContent>
          </Card>
        )}

        {/* Recent Deliveries */}
        {completedDeliveries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              <h2 className="text-base font-bold text-foreground">Recent Deliveries</h2>
            </div>
            {completedDeliveries.slice(0, 5).map((delivery) => (
              <Card key={delivery.id} className="border border-border bg-white shadow-sm">
                <CardContent className="py-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(delivery.completed_at!).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">{delivery.business_name} · {delivery.dropoff_address.slice(0, 30)}…</p>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-emerald-600">+{delivery.rider_commission} MAD</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
