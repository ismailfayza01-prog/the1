'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  CircleDot,
  Clock3,
  Home,
  Loader2,
  LogOut,
  MapPin,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService, riderService, businessService, deliveryService } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import { MAP_3D_ENABLED } from '@/components/maps/config';
import { AdminMap3D } from '@/components/maps/AdminMap3D';
import { BusinessLocationPicker, type BusinessLocationValue } from '../users/components/BusinessLocationPicker';
import type { Business, Delivery, Rider, User } from '@/lib/types';
import type {
  AlertType,
  MonitoringAlert,
  MonitoringRange,
  MonitoringSnapshot,
} from '@/lib/admin/monitoring/types';
import 'leaflet/dist/leaflet.css';

const MAP_BOUNDS = { latMin: 35.74, latMax: 35.79, lngMin: -5.86, lngMax: -5.8 };
const SNAPSHOT_TIMEZONE = 'Africa/Casablanca';
const ACTIVE_DELIVERY_STATUSES: Delivery['status'][] = ['pending', 'offered', 'accepted', 'picked_up', 'in_transit'];
const ALL_DELIVERY_STATUSES: Delivery['status'][] = [
  'pending',
  'offered',
  'accepted',
  'picked_up',
  'in_transit',
  'delivered',
  'cancelled',
  'expired',
];
const ALERT_TYPES: AlertType[] = [
  'pending_unassigned',
  'offer_timeout',
  'rider_stale',
  'transit_overdue',
  'pod_missing',
  'cod_missing',
];

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
  const current = rider.current_location as { lat: number; lng: number } | null;
  if (current) return current;
  return seedLocation(rider.id);
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

function getRiderStatusColor(status: Rider['status']): string {
  if (status === 'available') return '#10b981';
  if (status === 'busy') return '#f59e0b';
  return '#94a3b8';
}

function getRouteColor(status: Delivery['status']): string {
  const byStatus: Record<Delivery['status'], string> = {
    pending: '#f59e0b',
    offered: '#f59e0b',
    accepted: '#0284c7',
    picked_up: '#8b5cf6',
    in_transit: '#06b6d4',
    delivered: '#10b981',
    cancelled: '#64748b',
    expired: '#64748b',
  };
  return byStatus[status] || '#94a3b8';
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDurationSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}m ${remaining}s`;
}

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return `${Math.max(diffSeconds, 0)}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function alertTypeLabel(type: AlertType): string {
  const labels: Record<AlertType, string> = {
    pending_unassigned: 'Pending Unassigned',
    offer_timeout: 'Offer Timeout',
    rider_stale: 'Rider Stale',
    transit_overdue: 'Transit Overdue',
    pod_missing: 'PoD Missing',
    cod_missing: 'COD Missing',
  };
  return labels[type];
}

function alertSeverityClass(alert: MonitoringAlert): string {
  if (alert.severity === 'high') return 'bg-red-100 text-red-700 border-red-200';
  if (alert.severity === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function deliveryStatusClass(status: Delivery['status'] | Rider['status']): string {
  const variants: Record<string, string> = {
    available: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    busy: 'bg-amber-100 text-amber-700 border-amber-200',
    offline: 'bg-slate-100 text-slate-500 border-slate-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    offered: 'bg-amber-100 text-amber-700 border-amber-200',
    accepted: 'bg-sky-100 text-sky-700 border-sky-200',
    picked_up: 'bg-violet-100 text-violet-700 border-violet-200',
    in_transit: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    expired: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return variants[status] || 'bg-slate-100 text-slate-500 border-slate-200';
}

function defaultIncidentFilter(): Record<AlertType, boolean> {
  return {
    pending_unassigned: false,
    offer_timeout: false,
    rider_stale: false,
    transit_overdue: false,
    pod_missing: false,
    cod_missing: false,
  };
}

interface AdminLiveMapProps {
  riders: Rider[];
  deliveries: Delivery[];
  focusDeliveryId?: string | null;
  focusRiderId?: string | null;
}

function AdminLiveMap({
  riders,
  deliveries,
  focusDeliveryId = null,
  focusRiderId = null,
}: AdminLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const ridersLayerRef = useRef<any>(null);
  const routesLayerRef = useRef<any>(null);
  const didFitBoundsRef = useRef(false);

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

      const tangierBounds = L.latLngBounds(
        [MAP_BOUNDS.latMin, MAP_BOUNDS.lngMin],
        [MAP_BOUNDS.latMax, MAP_BOUNDS.lngMax]
      );

      map.fitBounds(tangierBounds, { padding: [24, 24] });
      map.setMaxBounds(tangierBounds.pad(0.1));

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      ridersLayerRef.current = L.layerGroup().addTo(map);
      routesLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
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
      routesLayerRef.current = null;
      leafletRef.current = null;
      didFitBoundsRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!leafletRef.current || !ridersLayerRef.current) return;
    const L = leafletRef.current;
    const layer = ridersLayerRef.current;
    layer.clearLayers();

    const riderIcon = (status: Rider['status']) =>
      L.divIcon({
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        html: `<div class="h-9 w-9 rounded-full border-2 border-white shadow" style="background:${getRiderStatusColor(
          status
        )}"></div>`,
      });

    for (const rider of riders) {
      const loc = getRiderLocation(rider);
      L.marker([loc.lat, loc.lng], {
        icon: riderIcon(rider.status),
      })
        .addTo(layer)
        .bindTooltip(`${rider.name} · ${rider.status}`, { direction: 'top', offset: [0, -8] });
    }
  }, [riders]);

  useEffect(() => {
    if (!leafletRef.current || !routesLayerRef.current) return;
    const L = leafletRef.current;
    const layer = routesLayerRef.current;
    layer.clearLayers();

    const mapDeliveries = [...deliveries];
    if (focusDeliveryId) {
      const focused = deliveries.find((delivery) => delivery.id === focusDeliveryId);
      if (focused && !mapDeliveries.some((delivery) => delivery.id === focused.id)) {
        mapDeliveries.push(focused);
      }
    }

    for (const delivery of mapDeliveries) {
      const pickup = getDeliveryPoint(delivery, 'pickup');
      const dropoff = getDeliveryPoint(delivery, 'dropoff');
      const routeColor = getRouteColor(delivery.status);
      const dash = ['pending', 'offered'].includes(delivery.status) ? '6 6' : undefined;

      L.polyline(
        [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ],
        {
          color: routeColor,
          weight: 3,
          dashArray: dash,
        }
      )
        .addTo(layer)
        .bindTooltip(`${delivery.business_name} · ${delivery.status}`, { direction: 'top', offset: [0, -8] });

      L.circleMarker([pickup.lat, pickup.lng], {
        radius: 5,
        color: '#38bdf8',
        fillColor: '#38bdf8',
        fillOpacity: 0.95,
      }).addTo(layer);
      L.circleMarker([dropoff.lat, dropoff.lng], {
        radius: 5,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.95,
      }).addTo(layer);
    }

    if (!mapRef.current || didFitBoundsRef.current || (riders.length === 0 && mapDeliveries.length === 0)) return;
    const points: [number, number][] = [];
    for (const rider of riders) {
      const loc = getRiderLocation(rider);
      points.push([loc.lat, loc.lng]);
    }
    for (const delivery of mapDeliveries) {
      const pickup = getDeliveryPoint(delivery, 'pickup');
      const dropoff = getDeliveryPoint(delivery, 'dropoff');
      points.push([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]);
    }
    if (points.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
      didFitBoundsRef.current = true;
    }
  }, [deliveries, focusDeliveryId, riders]);

  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    if (!focusDeliveryId && !focusRiderId) return;

    const focusPoints: [number, number][] = [];

    if (focusRiderId) {
      const rider = riders.find((row) => row.id === focusRiderId);
      if (rider) {
        const loc = getRiderLocation(rider);
        focusPoints.push([loc.lat, loc.lng]);
      }
    }

    if (focusDeliveryId) {
      const delivery = deliveries.find((row) => row.id === focusDeliveryId);
      if (delivery) {
        const pickup = getDeliveryPoint(delivery, 'pickup');
        const dropoff = getDeliveryPoint(delivery, 'dropoff');
        focusPoints.push([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]);
        if (delivery.rider_id) {
          const rider = riders.find((row) => row.id === delivery.rider_id);
          if (rider) {
            const loc = getRiderLocation(rider);
            focusPoints.push([loc.lat, loc.lng]);
          }
        }
      }
    }

    if (focusPoints.length > 0) {
      mapRef.current.fitBounds(leafletRef.current.latLngBounds(focusPoints), {
        padding: [60, 60],
        maxZoom: 15,
      });
    }
  }, [deliveries, focusDeliveryId, focusRiderId, riders]);

  return <div ref={mapContainerRef} role="region" aria-label="Admin live rider and delivery map" className="h-full w-full rounded-2xl" />;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const snapshotRangeRef = useRef<MonitoringRange>('today');
  const snapshotRequestIdRef = useRef(0);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  const [snapshotRange, setSnapshotRange] = useState<MonitoringRange>('today');
  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [lastGoodSnapshot, setLastGoodSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [snapshotError, setSnapshotError] = useState('');
  const [snapshotStale, setSnapshotStale] = useState(false);
  const [isRefreshingSnapshot, setIsRefreshingSnapshot] = useState(false);

  const [incidentTypeFilter, setIncidentTypeFilter] = useState<Record<AlertType, boolean>>(defaultIncidentFilter());
  const [mapFocus, setMapFocus] = useState<{ alertId: string | null; deliveryId: string | null; riderId: string | null }>({
    alertId: null,
    deliveryId: null,
    riderId: null,
  });

  const [statusDraftByDelivery, setStatusDraftByDelivery] = useState<Record<string, Delivery['status']>>({});
  const [assignDraftByDelivery, setAssignDraftByDelivery] = useState<Record<string, string>>({});
  const [mutatingDeliveryId, setMutatingDeliveryId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const [walletBusinessId, setWalletBusinessId] = useState('');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletPaymentMethod, setWalletPaymentMethod] = useState<'cash' | 'card' | 'check'>('cash');
  const [walletNote, setWalletNote] = useState('');
  const [walletSubmitting, setWalletSubmitting] = useState(false);

  const [locationDraft, setLocationDraft] = useState<{ lat: string; lng: string }>({ lat: '', lng: '' });
  const [locationSubmitting, setLocationSubmitting] = useState(false);
  const [isLocationDraftDirty, setIsLocationDraftDirty] = useState(false);
  const locationDraftBusinessIdRef = useRef<string | null>(null);

  const loadOperationalData = useCallback(async () => {
    const [nextRiders, nextBusinesses, nextDeliveries] = await Promise.all([
      riderService.getAll(),
      businessService.getAll(),
      deliveryService.getAll(),
    ]);
    setRiders(nextRiders);
    setBusinesses(nextBusinesses);
    setDeliveries(nextDeliveries);
  }, []);

  const loadSnapshot = useCallback(async (range: MonitoringRange, options?: { silent?: boolean }) => {
    const requestId = ++snapshotRequestIdRef.current;
    const silent = !!options?.silent;

    if (!silent) {
      setSnapshotLoading(true);
      setSnapshotError('');
    } else {
      setIsRefreshingSnapshot(true);
    }

    try {
      const response = await fetch(
        `/api/admin/monitoring/snapshot?range=${encodeURIComponent(range)}&tz=${encodeURIComponent(SNAPSHOT_TIMEZONE)}`,
        {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Failed to load monitoring snapshot (${response.status})`);
      }

      const payload = (await response.json()) as MonitoringSnapshot;
      if (requestId !== snapshotRequestIdRef.current) return;

      setSnapshot(payload);
      setLastGoodSnapshot(payload);
      setSnapshotStale(false);
      setSnapshotError('');
    } catch (error) {
      if (requestId !== snapshotRequestIdRef.current) return;
      const message = error instanceof Error ? error.message : 'Failed to load monitoring snapshot';
      setSnapshotError(message);
      setSnapshotStale(true);
    } finally {
      if (requestId === snapshotRequestIdRef.current) {
        setSnapshotLoading(false);
        setIsRefreshingSnapshot(false);
      }
    }
  }, []);

  useEffect(() => {
    snapshotRangeRef.current = snapshotRange;
  }, [snapshotRange]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let snapshotPoll: ReturnType<typeof setInterval> | null = null;
    let opsPoll: ReturnType<typeof setInterval> | null = null;
    let realtimeDebounce: ReturnType<typeof setTimeout> | null = null;

    const debouncedRefresh = () => {
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      realtimeDebounce = setTimeout(() => {
        void Promise.all([
          loadOperationalData(),
          loadSnapshot(snapshotRangeRef.current, { silent: true }),
        ]);
      }, 800);
    };

    async function init() {
      const user = await userService.getCurrentUser();
      if (!user || user.role !== 'admin') {
        router.push('/admin');
        return;
      }

      setCurrentUser(user);
      await Promise.all([
        loadOperationalData(),
        loadSnapshot(snapshotRangeRef.current),
      ]);

      channel = supabase
        .channel('admin-monitoring-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, debouncedRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, debouncedRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, debouncedRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_offers' }, debouncedRefresh)
        .subscribe();
    }

    void init();

    snapshotPoll = setInterval(() => {
      void loadSnapshot(snapshotRangeRef.current, { silent: true });
    }, 30000);

    opsPoll = setInterval(() => {
      void loadOperationalData();
    }, 60000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (snapshotPoll) clearInterval(snapshotPoll);
      if (opsPoll) clearInterval(opsPoll);
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
    };
  }, [loadOperationalData, loadSnapshot, router]);

  useEffect(() => {
    if (!currentUser) return;
    void loadSnapshot(snapshotRange);
  }, [currentUser, loadSnapshot, snapshotRange]);

  useEffect(() => {
    if (!walletBusinessId && businesses.length > 0) {
      setWalletBusinessId(businesses[0].id);
    }
  }, [businesses, walletBusinessId]);

  useEffect(() => {
    const business = businesses.find((item) => item.id === walletBusinessId);
    if (!business) {
      setLocationDraft((prev) => (prev.lat === '' && prev.lng === '' ? prev : { lat: '', lng: '' }));
      setIsLocationDraftDirty(false);
      locationDraftBusinessIdRef.current = null;
      return;
    }

    const selectedBusinessChanged = locationDraftBusinessIdRef.current !== business.id;
    if (!selectedBusinessChanged && isLocationDraftDirty) return;

    const lat = typeof business.location_lat === 'number' && Number.isFinite(business.location_lat)
      ? business.location_lat.toFixed(6)
      : '';
    const lng = typeof business.location_lng === 'number' && Number.isFinite(business.location_lng)
      ? business.location_lng.toFixed(6)
      : '';

    setLocationDraft((prev) => (prev.lat === lat && prev.lng === lng ? prev : { lat, lng }));
    if (selectedBusinessChanged) {
      setIsLocationDraftDirty(false);
    }
    locationDraftBusinessIdRef.current = business.id;
  }, [walletBusinessId, businesses, isLocationDraftDirty]);

  const handleLogout = async () => {
    await userService.logout();
    router.push('/admin');
  };

  const refreshAll = async () => {
    await Promise.all([
      loadOperationalData(),
      loadSnapshot(snapshotRange),
    ]);
  };

  const handleOverrideStatus = async (deliveryId: string, fallbackStatus: Delivery['status']) => {
    const nextStatus = statusDraftByDelivery[deliveryId] ?? fallbackStatus;
    setMutatingDeliveryId(deliveryId);
    try {
      await deliveryService.adminOverrideStatus(deliveryId, nextStatus);
      setActionMsg(`Delivery updated to ${nextStatus.replace('_', ' ')}`);
      await Promise.all([
        loadOperationalData(),
        loadSnapshot(snapshotRangeRef.current, { silent: true }),
      ]);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to override status';
      setActionMsg(message);
    } finally {
      setMutatingDeliveryId(null);
    }
  };

  const handleAssignRider = async (deliveryId: string) => {
    const riderId = assignDraftByDelivery[deliveryId];
    if (!riderId) return;
    setMutatingDeliveryId(deliveryId);
    try {
      await deliveryService.adminAssignDelivery(deliveryId, riderId, false);
      setActionMsg('Rider assigned manually');
      await Promise.all([
        loadOperationalData(),
        loadSnapshot(snapshotRangeRef.current, { silent: true }),
      ]);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to assign rider';
      setActionMsg(message);
    } finally {
      setMutatingDeliveryId(null);
    }
  };

  const handleAdminWalletCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const target = businesses.find((business) => business.id === walletBusinessId);
    if (!target) {
      setActionMsg('Select a business first');
      return;
    }

    const amount = parseFloat(walletAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionMsg('Enter a valid credit amount');
      return;
    }
    if (amount > 99999) {
      setActionMsg('Amount cannot exceed 99,999 MAD');
      return;
    }

    setWalletSubmitting(true);
    try {
      const ok = await businessService.adminAddCredits(
        target.id,
        amount,
        walletPaymentMethod,
        currentUser.id,
        walletNote
      );
      if (!ok) {
        setActionMsg('Failed to add wallet credit');
        return;
      }

      await Promise.all([
        loadOperationalData(),
        loadSnapshot(snapshotRangeRef.current, { silent: true }),
      ]);
      setWalletAmount('');
      setWalletNote('');
      setActionMsg(`+${amount} MAD added to ${target.name} (${walletPaymentMethod})`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add wallet credit';
      setActionMsg(message);
    } finally {
      setWalletSubmitting(false);
    }
  };

  const handleAdminLocationUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    const target = businesses.find((business) => business.id === walletBusinessId);
    if (!target) {
      setActionMsg('Select a business first');
      return;
    }

    const lat = Number(locationDraft.lat);
    const lng = Number(locationDraft.lng);
    if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
      setActionMsg('Enter valid latitude and longitude');
      return;
    }

    setLocationSubmitting(true);
    try {
      const nextLat = Number(lat.toFixed(6));
      const nextLng = Number(lng.toFixed(6));

      const updated = await businessService.update(target.id, {
        location_lat: nextLat,
        location_lng: nextLng,
        location_pinned_at: new Date().toISOString(),
      });
      if (!updated) {
        setActionMsg('Failed to update business location');
        return;
      }

      await Promise.all([
        loadOperationalData(),
        loadSnapshot(snapshotRangeRef.current, { silent: true }),
      ]);
      setLocationDraft({ lat: nextLat.toFixed(6), lng: nextLng.toFixed(6) });
      setIsLocationDraftDirty(false);
      setActionMsg(`Location updated for ${target.name}`);
      setTimeout(() => setActionMsg(''), 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update business location';
      setActionMsg(message);
    } finally {
      setLocationSubmitting(false);
    }
  };

  const handleOpenOnMap = (alert: MonitoringAlert) => {
    if (!alert.delivery_id && !alert.rider_id) return;
    setMapFocus({
      alertId: alert.id,
      deliveryId: alert.delivery_id,
      riderId: alert.rider_id,
    });
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const effectiveSnapshot = snapshot ?? lastGoodSnapshot;
  const incidents = effectiveSnapshot?.alerts ?? [];
  const deliveryById = useMemo(() => new Map(deliveries.map((delivery) => [delivery.id, delivery])), [deliveries]);

  const selectedIncidentTypes = useMemo(
    () => ALERT_TYPES.filter((type) => incidentTypeFilter[type]),
    [incidentTypeFilter]
  );

  const mapPayload = useMemo(() => {
    const activeDeliveries = deliveries.filter((delivery) => ACTIVE_DELIVERY_STATUSES.includes(delivery.status));
    if (selectedIncidentTypes.length === 0) {
      return {
        deliveries: activeDeliveries,
        riders,
      };
    }

    const filteredAlerts = incidents.filter((alert) => selectedIncidentTypes.includes(alert.type));
    const deliveryIds = new Set(filteredAlerts.map((alert) => alert.delivery_id).filter((id): id is string => !!id));
    const riderIds = new Set(filteredAlerts.map((alert) => alert.rider_id).filter((id): id is string => !!id));

    const filteredDeliveries = activeDeliveries.filter((delivery) => {
      if (deliveryIds.has(delivery.id)) return true;
      if (delivery.rider_id && riderIds.has(delivery.rider_id)) return true;
      return false;
    });

    const filteredRiders = riders.filter((rider) => {
      if (riderIds.has(rider.id)) return true;
      return filteredDeliveries.some((delivery) => delivery.rider_id === rider.id);
    });

    return {
      deliveries: filteredDeliveries,
      riders: filteredRiders,
    };
  }, [deliveries, incidents, riders, selectedIncidentTypes]);

  const mapDeliveries = useMemo(() => {
    const base = [...mapPayload.deliveries];
    if (mapFocus.deliveryId) {
      const focused = deliveries.find((delivery) => delivery.id === mapFocus.deliveryId);
      if (focused && !base.some((delivery) => delivery.id === focused.id)) {
        base.push(focused);
      }
    }
    return base;
  }, [deliveries, mapFocus.deliveryId, mapPayload.deliveries]);

  const mapRiders = useMemo(() => {
    const base = [...mapPayload.riders];
    if (mapFocus.riderId) {
      const focused = riders.find((rider) => rider.id === mapFocus.riderId);
      if (focused && !base.some((rider) => rider.id === focused.id)) {
        base.push(focused);
      }
    }
    return base;
  }, [mapFocus.riderId, mapPayload.riders, riders]);

  const selectedWalletBusiness = businesses.find((business) => business.id === walletBusinessId) || null;
  const parsedLocationDraftLat = Number(locationDraft.lat);
  const parsedLocationDraftLng = Number(locationDraft.lng);
  const isLocationDraftValid = isValidLatitude(parsedLocationDraftLat) && isValidLongitude(parsedLocationDraftLng);
  const mapDraftValue: BusinessLocationValue | null = isLocationDraftValid
    ? {
      lat: Number(parsedLocationDraftLat.toFixed(6)),
      lng: Number(parsedLocationDraftLng.toFixed(6)),
    }
    : null;

  const availableRiders = riders.filter((rider) => rider.status === 'available').length;
  const busyRiders = riders.filter((rider) => rider.status === 'busy').length;
  const activeDeliveriesCount = deliveries.filter((delivery) => ACTIVE_DELIVERY_STATUSES.includes(delivery.status)).length;

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-violet-50">
                <Home className="h-5 w-5 text-violet-600" />
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-violet-100 p-1.5">
                <BarChart3 className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight text-foreground">Admin Monitoring Dashboard</h1>
                <p className="text-xs leading-tight text-muted-foreground">Live operations + quick actions</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {actionMsg && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
                {actionMsg}
              </div>
            )}
            <Link href="/admin/users">
              <Button variant="outline" className="rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800">
                <Users className="mr-2 h-4 w-4" />
                Users
              </Button>
            </Link>
            <Button variant="outline" size="icon" onClick={handleLogout} className="rounded-xl hover:border-red-200 hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <Card className="border border-violet-100 bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Range</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={snapshotRange === 'today' ? 'default' : 'outline'}
                    onClick={() => setSnapshotRange('today')}
                  >
                    Today
                  </Button>
                  <Button
                    size="sm"
                    variant={snapshotRange === '7d' ? 'default' : 'outline'}
                    onClick={() => setSnapshotRange('7d')}
                  >
                    Last 7 Days
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border bg-slate-100 text-slate-700 border-slate-200">
                  Auto-refresh every 15s
                </Badge>
                <Badge className="border bg-slate-100 text-slate-700 border-slate-200">
                  Last update {formatRelativeTime(effectiveSnapshot?.generated_at ?? null)}
                </Badge>
                <Button variant="outline" size="sm" onClick={refreshAll} disabled={isRefreshingSnapshot || snapshotLoading}>
                  {isRefreshingSnapshot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {snapshotStale && (
          <Card className="border border-amber-200 bg-amber-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3 text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="text-sm font-semibold">Monitoring snapshot is stale.</p>
                  <p className="text-xs">{snapshotError || 'Using last successful snapshot while retrying refresh.'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {snapshotError && !effectiveSnapshot && !snapshotLoading && (
          <Card className="border border-red-200 bg-red-50">
            <CardContent className="pt-4 text-sm text-red-700">
              {snapshotError}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            {
              label: 'Active Incidents',
              value: effectiveSnapshot?.kpis.active_incidents ?? 0,
              sub: `${incidents.filter((item) => item.severity === 'high').length} high priority`,
              icon: AlertTriangle,
              color: 'text-red-600',
              bg: 'bg-red-50',
              border: 'border-red-100',
            },
            {
              label: 'Active Deliveries',
              value: effectiveSnapshot?.kpis.active_deliveries ?? activeDeliveriesCount,
              sub: `${activeDeliveriesCount} currently active`,
              icon: Package,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
              border: 'border-emerald-100',
            },
            {
              label: 'Online Riders',
              value: effectiveSnapshot ? `${effectiveSnapshot.kpis.online_riders}` : `${availableRiders + busyRiders}`,
              sub: effectiveSnapshot ? formatPercent(effectiveSnapshot.kpis.online_ratio) : `${availableRiders} available`,
              icon: Users,
              color: 'text-violet-600',
              bg: 'bg-violet-50',
              border: 'border-violet-100',
            },
            {
              label: 'Delivered Today',
              value: effectiveSnapshot?.kpis.delivered_today ?? 0,
              sub: 'Local timezone',
              icon: CircleDot,
              color: 'text-sky-600',
              bg: 'bg-sky-50',
              border: 'border-sky-100',
            },
            {
              label: 'Dispatch Success',
              value: effectiveSnapshot ? formatPercent(effectiveSnapshot.kpis.dispatch_success_rate) : '--',
              sub: 'Accepted or beyond',
              icon: TrendingUp,
              color: 'text-cyan-600',
              bg: 'bg-cyan-50',
              border: 'border-cyan-100',
            },
            {
              label: 'P50 Accept Time',
              value: formatDurationSeconds(effectiveSnapshot?.kpis.p50_accept_seconds ?? null),
              sub: `Cash-in today: ${Math.round(effectiveSnapshot?.kpis.cash_in_mad_today ?? 0)} MAD`,
              icon: Clock3,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
              border: 'border-amber-100',
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className={`border ${stat.border} bg-white shadow-sm`}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{snapshotLoading && !effectiveSnapshot ? '--' : stat.value}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{stat.sub}</p>
                    </div>
                    <div className={`rounded-2xl p-2.5 ${stat.bg}`}>
                      <Icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2 border border-red-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Incident Queue</CardTitle>
              <CardDescription>Sorted by severity and age with fast actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {incidents.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                  No active incidents in the current range.
                </div>
              )}

              {incidents.map((alert) => {
                const linkedDelivery = alert.delivery_id ? deliveryById.get(alert.delivery_id) : null;
                const isFocused = mapFocus.alertId === alert.id;
                return (
                  <div
                    key={alert.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isFocused ? 'border-violet-300 bg-violet-50/50' : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`border text-xs ${alertSeverityClass(alert)}`}>{alert.severity.toUpperCase()}</Badge>
                          <Badge className="border bg-slate-100 text-slate-700 border-slate-200">{alertTypeLabel(alert.type)}</Badge>
                          <span className="text-xs text-muted-foreground">{Math.floor(alert.age_seconds / 60)}m old</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">{alert.action_hint}</p>
                      </div>

                      <Button
                        size="sm"
                        variant={isFocused ? 'default' : 'outline'}
                        onClick={() => handleOpenOnMap(alert)}
                        disabled={!alert.delivery_id && !alert.rider_id}
                      >
                        <MapPin className="mr-1.5 h-3.5 w-3.5" />
                        Open on map
                      </Button>
                    </div>

                    {linkedDelivery && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Override status</Label>
                          <div className="flex gap-2">
                            <select
                              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                              value={statusDraftByDelivery[linkedDelivery.id] ?? linkedDelivery.status}
                              onChange={(event) =>
                                setStatusDraftByDelivery((prev) => ({
                                  ...prev,
                                  [linkedDelivery.id]: event.target.value as Delivery['status'],
                                }))
                              }
                            >
                              {ALL_DELIVERY_STATUSES.map((status) => (
                                <option key={status} value={status}>{status.replace('_', ' ')}</option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mutatingDeliveryId === linkedDelivery.id}
                              onClick={() => handleOverrideStatus(linkedDelivery.id, linkedDelivery.status)}
                            >
                              Save
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Manual assign</Label>
                          <div className="flex gap-2">
                            <select
                              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                              value={assignDraftByDelivery[linkedDelivery.id] ?? ''}
                              onChange={(event) =>
                                setAssignDraftByDelivery((prev) => ({
                                  ...prev,
                                  [linkedDelivery.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Select rider</option>
                              {riders.map((rider) => (
                                <option key={rider.id} value={rider.id}>
                                  {rider.name} ({rider.status})
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              disabled={!assignDraftByDelivery[linkedDelivery.id] || mutatingDeliveryId === linkedDelivery.id}
                              onClick={() => handleAssignRider(linkedDelivery.id)}
                            >
                              Assign
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Rider Health</CardTitle>
              <CardDescription>Availability and stale heartbeat detection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                  <p className="text-xs text-emerald-700">Available</p>
                  <p className="text-lg font-bold text-emerald-800">{effectiveSnapshot?.rider_health.available ?? availableRiders}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
                  <p className="text-xs text-amber-700">Busy</p>
                  <p className="text-lg font-bold text-amber-800">{effectiveSnapshot?.rider_health.busy ?? busyRiders}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                  <p className="text-xs text-slate-700">Offline</p>
                  <p className="text-lg font-bold text-slate-800">{effectiveSnapshot?.rider_health.offline ?? Math.max(riders.length - availableRiders - busyRiders, 0)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stale online riders</p>
                {(effectiveSnapshot?.rider_health.stale_online_riders ?? []).length === 0 && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">No stale riders.</p>
                )}
                {(effectiveSnapshot?.rider_health.stale_online_riders ?? []).map((row) => (
                  <button
                    key={row.rider_id}
                    type="button"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:border-violet-200 hover:bg-violet-50"
                    onClick={() => {
                      setMapFocus({ alertId: null, deliveryId: null, riderId: row.rider_id });
                      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{row.name}</span>
                      <span className="text-muted-foreground">{row.stale_minutes}m stale</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">Last seen {formatRelativeTime(row.last_seen_at)}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card ref={mapSectionRef} className="border border-violet-100 bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">Live Ops Map</CardTitle>
                <CardDescription>Riders and active deliveries with optional incident filters.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ALERT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setIncidentTypeFilter((prev) => ({
                        ...prev,
                        [type]: !prev[type],
                      }))
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                      incidentTypeFilter[type]
                        ? 'border-violet-200 bg-violet-100 text-violet-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
                    }`}
                  >
                    {alertTypeLabel(type)}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIncidentTypeFilter(defaultIncidentFilter())}
                >
                  Clear filters
                </Button>
                {mapFocus.deliveryId || mapFocus.riderId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMapFocus({ alertId: null, deliveryId: null, riderId: null })}
                  >
                    Clear focus
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <Badge className={`border ${deliveryStatusClass('available')}`}>Online: {availableRiders}</Badge>
              <Badge className={`border ${deliveryStatusClass('busy')}`}>Busy: {busyRiders}</Badge>
              <Badge className={`border ${deliveryStatusClass('offline')}`}>Offline: {Math.max(riders.length - availableRiders - busyRiders, 0)}</Badge>
              <Badge className={`border ${deliveryStatusClass('pending')}`}>Map deliveries: {mapDeliveries.length}</Badge>
              <Badge className="border border-slate-200 bg-slate-100 text-slate-700">Map riders: {mapRiders.length}</Badge>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-violet-100 bg-slate-50">
              {MAP_3D_ENABLED ? (
                <AdminMap3D
                  riders={mapRiders}
                  deliveries={mapDeliveries}
                  focusDeliveryId={mapFocus.deliveryId}
                  focusRiderId={mapFocus.riderId}
                  className="h-full w-full rounded-2xl"
                  fallback={
                    <AdminLiveMap
                      riders={mapRiders}
                      deliveries={mapDeliveries}
                      focusDeliveryId={mapFocus.deliveryId}
                      focusRiderId={mapFocus.riderId}
                    />
                  }
                />
              ) : (
                <AdminLiveMap
                  riders={mapRiders}
                  deliveries={mapDeliveries}
                  focusDeliveryId={mapFocus.deliveryId}
                  focusRiderId={mapFocus.riderId}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border border-cyan-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Dispatch Funnel</CardTitle>
              <CardDescription>Status distribution for selected range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(effectiveSnapshot?.funnel ?? {
                pending: 0,
                offered: 0,
                accepted: 0,
                picked_up: 0,
                in_transit: 0,
                delivered: 0,
                cancelled: 0,
                expired: 0,
              }).map(([status, count]) => {
                const total = Object.values(effectiveSnapshot?.funnel ?? {}).reduce((sum, item) => sum + item, 0);
                const width = total > 0 ? Math.max((count / total) * 100, 3) : 0;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground capitalize">{status.replace('_', ' ')}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border border-sky-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Deliveries by Hour</CardTitle>
              <CardDescription>Hourly request distribution.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-2">
                {(effectiveSnapshot?.trends.deliveries_by_hour ?? []).map((point) => {
                  const max = Math.max(...(effectiveSnapshot?.trends.deliveries_by_hour ?? [{ hour: '00:00', count: 1 }]).map((item) => item.count), 1);
                  const height = Math.max((point.count / max) * 80, point.count > 0 ? 8 : 2);
                  return (
                    <div key={point.hour} className="flex flex-col items-center gap-1">
                      <div className="text-[10px] text-muted-foreground">{point.count}</div>
                      <div className="flex h-24 w-full items-end justify-center rounded bg-slate-50">
                        <div className="w-4 rounded bg-sky-500" style={{ height }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">{point.hour.slice(0, 2)}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2 border border-indigo-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Daily Trend Quality</CardTitle>
              <CardDescription>Acceptance speed and completion reliability.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-semibold">Day</th>
                      <th className="pb-2 font-semibold">P50 Accept</th>
                      <th className="pb-2 font-semibold">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(effectiveSnapshot?.trends.accept_p50_by_day ?? []).map((row, index) => {
                      const completion = effectiveSnapshot?.trends.completion_rate_by_day[index];
                      return (
                        <tr key={row.day} className="border-b border-slate-100">
                          <td className="py-2 text-xs text-foreground">{row.day}</td>
                          <td className="py-2 text-xs text-foreground">{formatDurationSeconds(row.seconds)}</td>
                          <td className="py-2 text-xs text-foreground">{formatPercent(completion?.rate ?? 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-amber-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Business Watch</CardTitle>
              <CardDescription>Low wallet and renewals due in 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Low wallet (&lt; 100 MAD)</p>
                {(effectiveSnapshot?.business_watch.low_wallet ?? []).slice(0, 6).map((business) => (
                  <button
                    key={business.business_id}
                    type="button"
                    className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:border-sky-200 hover:bg-sky-50"
                    onClick={() => setWalletBusinessId(business.business_id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">{business.name}</span>
                      <span className="text-red-600">{Math.round(business.wallet_balance)} MAD</span>
                    </div>
                  </button>
                ))}
                {(effectiveSnapshot?.business_watch.low_wallet ?? []).length === 0 && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">No low-wallet accounts.</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Renewal due in 7 days</p>
                {(effectiveSnapshot?.business_watch.renewal_due_7d ?? []).slice(0, 6).map((business) => (
                  <div key={business.business_id} className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-foreground">{business.name}</p>
                    <p className="text-muted-foreground">{new Date(business.renewal_date).toLocaleDateString()}</p>
                  </div>
                ))}
                {(effectiveSnapshot?.business_watch.renewal_due_7d ?? []).length === 0 && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">No upcoming renewals.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border border-sky-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Admin Wallet Credit</CardTitle>
              <CardDescription>Credit business wallet and record payment method.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminWalletCredit} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="wallet-business" className="text-xs text-sky-800">Business</Label>
                  <select
                    id="wallet-business"
                    className="h-10 w-full rounded-md border border-sky-200 bg-white px-3 text-sm"
                    value={walletBusinessId}
                    onChange={(event) => setWalletBusinessId(event.target.value)}
                    required
                  >
                    <option value="">Select business</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="wallet-amount" className="text-xs text-sky-800">Credit amount (MAD)</Label>
                  <Input
                    id="wallet-amount"
                    type="number"
                    min="1"
                    step="1"
                    value={walletAmount}
                    onChange={(event) => setWalletAmount(event.target.value)}
                    required
                    disabled={walletSubmitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="wallet-method" className="text-xs text-sky-800">Payment method</Label>
                  <select
                    id="wallet-method"
                    className="h-10 w-full rounded-md border border-sky-200 bg-white px-3 text-sm"
                    value={walletPaymentMethod}
                    onChange={(event) => setWalletPaymentMethod(event.target.value as 'cash' | 'card' | 'check')}
                    disabled={walletSubmitting}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="check">Check</option>
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="wallet-note" className="text-xs text-sky-800">Note (optional)</Label>
                  <Input
                    id="wallet-note"
                    value={walletNote}
                    onChange={(event) => setWalletNote(event.target.value)}
                    disabled={walletSubmitting}
                    placeholder="Reference / payment note"
                  />
                </div>

                {selectedWalletBusiness && (
                  <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 md:col-span-2">
                    Selected: <span className="font-semibold">{selectedWalletBusiness.name}</span> · Current wallet: {selectedWalletBusiness.wallet_balance} MAD
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={walletSubmitting || !walletBusinessId || !walletAmount}>
                    {walletSubmitting ? 'Validating...' : 'Validate credit'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-violet-100 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Business Location Update</CardTitle>
              <CardDescription>Re-pin business location when correction is required.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminLocationUpdate} className="space-y-3">
                <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                  {selectedWalletBusiness ? (
                    <>
                      Selected: <span className="font-semibold">{selectedWalletBusiness.name}</span>
                      {typeof selectedWalletBusiness.location_lat === 'number' && typeof selectedWalletBusiness.location_lng === 'number' ? (
                        <span>
                          {' '}- Current pin: {selectedWalletBusiness.location_lat.toFixed(6)}, {selectedWalletBusiness.location_lng.toFixed(6)}
                        </span>
                      ) : (
                        <span> - No location pinned yet</span>
                      )}
                    </>
                  ) : (
                    <span>Select a business to edit location</span>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="business-location-lat" className="text-xs text-violet-800">Latitude</Label>
                    <Input
                      id="business-location-lat"
                      type="number"
                      step="0.000001"
                      min="-90"
                      max="90"
                      value={locationDraft.lat}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setIsLocationDraftDirty(true);
                        setLocationDraft((prev) => (prev.lat === nextValue ? prev : { ...prev, lat: nextValue }));
                      }}
                      disabled={!selectedWalletBusiness || locationSubmitting}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="business-location-lng" className="text-xs text-violet-800">Longitude</Label>
                    <Input
                      id="business-location-lng"
                      type="number"
                      step="0.000001"
                      min="-180"
                      max="180"
                      value={locationDraft.lng}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setIsLocationDraftDirty(true);
                        setLocationDraft((prev) => (prev.lng === nextValue ? prev : { ...prev, lng: nextValue }));
                      }}
                      disabled={!selectedWalletBusiness || locationSubmitting}
                      required
                    />
                  </div>
                </div>

                <BusinessLocationPicker
                  value={mapDraftValue}
                  onChange={(coords) => {
                    setIsLocationDraftDirty(true);
                    setLocationDraft({
                      lat: coords.lat.toFixed(6),
                      lng: coords.lng.toFixed(6),
                    });
                  }}
                />

                <div className="flex justify-end">
                  <Button type="submit" disabled={!selectedWalletBusiness || !isLocationDraftValid || locationSubmitting}>
                    {locationSubmitting ? 'Saving location...' : 'Save location'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Recent Admin Audit</CardTitle>
            <CardDescription>Last 25 admin actions from audit logs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(effectiveSnapshot?.recent_audit ?? []).length === 0 && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">No audit logs yet.</p>
            )}
            {(effectiveSnapshot?.recent_audit ?? []).map((audit) => (
              <div key={audit.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{audit.action}</span>
                  <span className="text-muted-foreground">{formatRelativeTime(audit.created_at)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  admin: {audit.admin_user_id ?? 'n/a'} · target: {audit.target_user_id ?? 'n/a'}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
