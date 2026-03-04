'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { userService, riderService, businessService, deliveryService } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import { MAP_3D_ENABLED } from '@/components/maps/config';
import { AdminMap3D } from '@/components/maps/AdminMap3D';
import { BusinessLocationPicker, type BusinessLocationValue } from '../users/components/BusinessLocationPicker';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Users,
  Package,
  DollarSign,
  LogOut,
  TrendingUp,
  Home,
  BarChart3,
} from 'lucide-react';
import type { User, Rider, Business, Delivery } from '@/lib/types';
import Link from 'next/link';

const MAP_BOUNDS = { latMin: 35.74, latMax: 35.79, lngMin: -5.86, lngMax: -5.8 };

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

function getRiderStatusColor(status: Rider['status']): string {
  if (status === 'available') return '#10b981';
  if (status === 'busy') return '#f59e0b';
  return '#94a3b8';
}

function getRiderMotoIcon(L: any, status: Rider['status']): any {
  const size = 38;
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
          <svg class="map-rider-bike" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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

interface AdminLiveMapProps {
  riders: Rider[];
  deliveries: Delivery[];
}

function AdminLiveMap({ riders, deliveries }: AdminLiveMapProps) {
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

    for (const rider of riders) {
      const loc = getRiderLocation(rider);
      L.marker([loc.lat, loc.lng], {
        icon: getRiderMotoIcon(L, rider.status),
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

    const activeStatuses: Delivery['status'][] = ['pending', 'offered', 'accepted', 'picked_up', 'in_transit'];
    const activeDeliveries = deliveries.filter((delivery) => activeStatuses.includes(delivery.status));

    for (const delivery of activeDeliveries) {
      const pickup = getDeliveryPoint(delivery, 'pickup');
      const dropoff = getDeliveryPoint(delivery, 'dropoff');
      const routeColor = getRouteColor(delivery.status);
      const dash = ['pending', 'offered'].includes(delivery.status) ? '6 6' : undefined;

      L.polyline([
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ], {
        color: routeColor,
        weight: 3,
        dashArray: dash,
      })
        .addTo(layer)
        .bindTooltip(`${delivery.business_name} · ${delivery.status}`, { direction: 'top', offset: [0, -8] });

      L.marker([pickup.lat, pickup.lng], { icon: getPickupFlagIcon(L) }).addTo(layer);
      L.marker([dropoff.lat, dropoff.lng], { icon: getDropoffFlagIcon(L) }).addTo(layer);
    }

    if (!mapRef.current || didFitBoundsRef.current || (riders.length === 0 && activeDeliveries.length === 0)) return;
    const points: [number, number][] = [];
    for (const rider of riders) {
      const loc = getRiderLocation(rider);
      points.push([loc.lat, loc.lng]);
    }
    for (const delivery of activeDeliveries) {
      const pickup = getDeliveryPoint(delivery, 'pickup');
      const dropoff = getDeliveryPoint(delivery, 'dropoff');
      points.push([pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]);
    }
    if (points.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
      didFitBoundsRef.current = true;
    }
  }, [deliveries, riders]);

  return <div ref={mapContainerRef} role="region" aria-label="Admin live rider and delivery map" className="h-full w-full rounded-2xl" />;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
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

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function init() {
      const user = await userService.getCurrentUser();
      if (!user || user.role !== 'admin') {
        router.push('/admin');
        return;
      }
      setCurrentUser(user);
      await loadData();

      channel = supabase.channel('admin-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => { loadData(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => { loadData(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => { loadData(); })
        .subscribe();
    }
    init();

    pollInterval = setInterval(() => {
      void loadData();
    }, 8000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [router]);

  const loadData = async () => {
    setRiders(await riderService.getAll());
    setBusinesses(await businessService.getAll());
    setDeliveries(await deliveryService.getAll());
  };

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

  const handleOverrideStatus = async (deliveryId: string, fallbackStatus: Delivery['status']) => {
    const nextStatus = statusDraftByDelivery[deliveryId] ?? fallbackStatus;
    setMutatingDeliveryId(deliveryId);
    try {
      await deliveryService.adminOverrideStatus(deliveryId, nextStatus);
      setActionMsg(`Delivery updated to ${nextStatus.replace('_', ' ')}`);
      await loadData();
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
      await loadData();
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

    const target = businesses.find((b) => b.id === walletBusinessId);
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

      await loadData();
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

    const target = businesses.find((b) => b.id === walletBusinessId);
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

      await loadData();
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

  if (!currentUser) return null;

  const availableRiders = riders.filter(r => r.status === 'available').length;
  const busyRiders = riders.filter(r => r.status === 'busy').length;
  const activeDeliveries = deliveries.filter(d => ['pending', 'accepted', 'picked_up', 'in_transit'].includes(d.status)).length;
  const completedToday = deliveries.filter(d => {
    if (d.status !== 'delivered') return false;
    const today = new Date().setHours(0, 0, 0, 0);
    return new Date(d.completed_at!).getTime() >= today;
  }).length;

  const totalRevenue = businesses.reduce((sum, b) => {
    const tierRevenue =
      b.subscription_tier === 'monthly'
        ? 200
        : b.subscription_tier === 'trimestrial'
          ? 600
          : b.subscription_tier === 'semestrial'
            ? 1200
            : b.subscription_tier === 'annual'
              ? 2400
              : 0;
    return sum + tierRevenue + b.wallet_balance;
  }, 0);
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      available: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      busy: 'bg-amber-100 text-amber-700 border-amber-200',
      offline: 'bg-slate-100 text-slate-500 border-slate-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      accepted: 'bg-sky-100 text-sky-700 border-sky-200',
      picked_up: 'bg-violet-100 text-violet-700 border-violet-200',
      in_transit: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      offered: 'bg-amber-100 text-amber-700 border-amber-200',
      expired: 'bg-slate-100 text-slate-600 border-slate-200',
      cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return variants[status] || 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const stats = [
    {
      label: 'Total Riders',
      value: riders.length,
      sub: `${availableRiders} available · ${busyRiders} busy`,
      icon: Users,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      borderColor: 'border-violet-100',
    },
    {
      label: 'Total Businesses',
      value: businesses.length,
      sub: `${businesses.filter(b => b.subscription_tier !== 'none').length} active subscriptions`,
      icon: TrendingUp,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      borderColor: 'border-sky-100',
    },
    {
      label: 'Active Deliveries',
      value: activeDeliveries,
      sub: `${completedToday} completed today`,
      icon: Package,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
    },
    {
      label: 'Total Revenue',
      value: `${totalRevenue.toFixed(0)} MAD`,
      sub: 'From subscriptions & wallets',
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      borderColor: 'border-amber-100',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
        <div className="flex h-16 items-center justify-between px-6">
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
                <h1 className="text-base font-bold text-foreground leading-tight">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground leading-tight">The 1000 Platform</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {actionMsg && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
                {actionMsg}
              </div>
            )}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-foreground">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <Link href="/admin/users">
              <Button
                variant="outline"
                className="rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800"
              >
                <Users className="h-4 w-4 mr-2" />
                Users
              </Button>
            </Link>
            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              className="rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className={`border ${stat.borderColor} bg-white shadow-sm hover:shadow-md transition-shadow`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-3xl font-extrabold text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-2">{stat.sub}</p>
                    </div>
                    <div className={`rounded-2xl ${stat.bg} p-3`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Live Map */}
        <Card className="border border-violet-100 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-violet-100 p-2">
                <MapPin className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Live Rider Map</CardTitle>
                <CardDescription>Real-time rider locations and active deliveries</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className={`border ${getStatusBadge('available')}`}>Online: {availableRiders}</Badge>
                <Badge className={`border ${getStatusBadge('busy')}`}>Busy: {busyRiders}</Badge>
                <Badge className={`border ${getStatusBadge('offline')}`}>Offline: {riders.length - availableRiders - busyRiders}</Badge>
                <Badge className={`border ${getStatusBadge('pending')}`}>Active deliveries: {activeDeliveries}</Badge>
              </div>
              <div className="relative aspect-video w-full rounded-2xl border border-violet-100 overflow-hidden bg-slate-50">
                {MAP_3D_ENABLED ? (
                  <AdminMap3D
                    riders={riders}
                    deliveries={deliveries}
                    className="h-full w-full rounded-2xl"
                    fallback={<AdminLiveMap riders={riders} deliveries={deliveries} />}
                  />
                ) : (
                  <AdminLiveMap riders={riders} deliveries={deliveries} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Management Tabs */}
        <Tabs defaultValue="riders" className="space-y-4">
          <TabsList className="bg-white border border-border rounded-xl p-1 h-auto gap-1">
            <TabsTrigger value="riders" className="rounded-lg data-[state=active]:bg-violet-600 data-[state=active]:text-white font-semibold px-5 py-2">
              Riders
            </TabsTrigger>
            <TabsTrigger value="businesses" className="rounded-lg data-[state=active]:bg-sky-600 data-[state=active]:text-white font-semibold px-5 py-2">
              Businesses
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white font-semibold px-5 py-2">
              Deliveries
            </TabsTrigger>
          </TabsList>

          <TabsContent value="riders" className="space-y-4">
            <Card className="border border-violet-100 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Rider Management</CardTitle>
                <CardDescription>Manage riders, view earnings, and track performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riders.map((rider) => (
                    <div
                      key={rider.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:bg-violet-50/50 hover:border-violet-100 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{rider.name}</p>
                            <Badge className={`text-xs border ${getStatusBadge(rider.status)}`}>
                              {rider.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{rider.phone}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{rider.earnings_this_month} MAD</p>
                        <p className="text-xs text-muted-foreground">{rider.total_deliveries} deliveries</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="businesses" className="space-y-4">
            <Card className="border border-sky-100 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Business Management</CardTitle>
                <CardDescription>Manage business accounts, subscriptions, and admin wallet credits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <div className="text-sm font-bold text-sky-800">Admin Wallet Credit Panel</div>
                  <p className="mt-1 text-xs text-sky-700">
                    Choose customer, input amount, choose payment method, then validate.
                  </p>

                  <form onSubmit={handleAdminWalletCredit} className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1 md:col-span-2">
                      <Label htmlFor="wallet-business" className="text-xs text-sky-800">Customer</Label>
                      <select
                        id="wallet-business"
                        className="h-10 w-full rounded-md border border-sky-200 bg-white px-3 text-sm"
                        value={walletBusinessId}
                        onChange={(event) => setWalletBusinessId(event.target.value)}
                        required
                      >
                        <option value="">Select a customer</option>
                        {businesses.map((business) => (
                          <option key={business.id} value={business.id}>
                            {business.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="wallet-amount" className="text-xs text-sky-800">Credit Amount (MAD)</Label>
                      <Input
                        id="wallet-amount"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 150"
                        value={walletAmount}
                        onChange={(event) => setWalletAmount(event.target.value)}
                        required
                        disabled={walletSubmitting}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="wallet-method" className="text-xs text-sky-800">Payment Method</Label>
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
                        placeholder="Reference / payment note"
                        value={walletNote}
                        onChange={(event) => setWalletNote(event.target.value)}
                        disabled={walletSubmitting}
                      />
                    </div>

                    {selectedWalletBusiness && (
                      <div className="md:col-span-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-xs text-sky-700">
                        Selected: <span className="font-semibold">{selectedWalletBusiness.name}</span> · Current wallet: {selectedWalletBusiness.wallet_balance} MAD
                      </div>
                    )}

                    <div className="md:col-span-2 flex justify-end">
                      <Button type="submit" disabled={walletSubmitting || !walletBusinessId || !walletAmount}>
                        {walletSubmitting ? 'Validating...' : 'Validate Credit'}
                      </Button>
                    </div>
                  </form>
                </div>

                <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="text-sm font-bold text-violet-800">Business Location Update</div>
                  <p className="mt-1 text-xs text-violet-700">
                    Admin can re-pin a business location when the customer requests a correction.
                  </p>

                  <form onSubmit={handleAdminLocationUpdate} className="mt-4 space-y-3">
                    <div className="rounded-md border border-violet-200 bg-white px-3 py-2 text-xs text-violet-700">
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
                            setLocationDraft((prev) => (
                              prev.lat === nextValue ? prev : { ...prev, lat: nextValue }
                            ));
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
                            setLocationDraft((prev) => (
                              prev.lng === nextValue ? prev : { ...prev, lng: nextValue }
                            ));
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

                    <p className="text-[11px] text-violet-700">
                      Click on the map to place the business pin exactly on the requested location.
                    </p>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={!selectedWalletBusiness || !isLocationDraftValid || locationSubmitting}
                      >
                        {locationSubmitting ? 'Saving location...' : 'Save Location'}
                      </Button>
                    </div>
                  </form>
                </div>

                <div className="space-y-3">
                  {businesses.map((business) => (
                    <div
                      key={business.id}
                      onClick={() => setWalletBusinessId(business.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all ${
                        walletBusinessId === business.id
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-border bg-background hover:bg-sky-50/50 hover:border-sky-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
                          <MapPin className="h-5 w-5 text-sky-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-foreground text-sm">{business.name}</p>
                            {business.subscription_tier !== 'none' && (
                              <Badge className="text-xs border bg-sky-100 text-sky-700 border-sky-200 capitalize">
                                {business.subscription_tier}
                              </Badge>
                            )}
                            {walletBusinessId === business.id && (
                              <Badge className="text-xs border bg-emerald-100 text-emerald-700 border-emerald-200">
                                Selected
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {business.rides_used} / {business.rides_total} rides used
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{business.wallet_balance} MAD</p>
                        <p className="text-xs text-muted-foreground">Wallet</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-4">
            <Card className="border border-emerald-100 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">Delivery Management</CardTitle>
                <CardDescription>Monitor, override status, and manually assign riders when dispatch fails</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deliveries.slice(0, 10).map((delivery) => (
                    <div
                      key={delivery.id}
                      className="space-y-3 rounded-xl border border-border bg-background p-4 transition-all hover:bg-emerald-50/50 hover:border-emerald-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-xs border ${getStatusBadge(delivery.status)}`}>
                              {delivery.status.replace('_', ' ')}
                            </Badge>
                            <p className="text-sm font-semibold text-foreground">{delivery.business_name}</p>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                              {delivery.pickup_address}
                            </p>
                            <p className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-violet-500 flex-shrink-0" />
                              {delivery.dropoff_address}
                            </p>
                          </div>
                          {delivery.rider_name && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {delivery.rider_name}
                            </p>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-foreground">{delivery.price} MAD</p>
                          <p className="text-xs text-muted-foreground">~{delivery.estimated_duration} min</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Override status
                          </label>
                          <div className="flex gap-2">
                            <select
                              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                              value={statusDraftByDelivery[delivery.id] ?? delivery.status}
                              onChange={(event) =>
                                setStatusDraftByDelivery((prev) => ({
                                  ...prev,
                                  [delivery.id]: event.target.value as Delivery['status'],
                                }))
                              }
                            >
                              {['pending', 'offered', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired'].map((status) => (
                                <option key={status} value={status}>
                                  {status.replace('_', ' ')}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={mutatingDeliveryId === delivery.id}
                              onClick={() => handleOverrideStatus(delivery.id, delivery.status)}
                            >
                              Save
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Manual assign
                          </label>
                          <div className="flex gap-2">
                            <select
                              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                              value={assignDraftByDelivery[delivery.id] ?? ''}
                              onChange={(event) =>
                                setAssignDraftByDelivery((prev) => ({
                                  ...prev,
                                  [delivery.id]: event.target.value,
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
                              disabled={!assignDraftByDelivery[delivery.id] || mutatingDeliveryId === delivery.id}
                              onClick={() => handleAssignRider(delivery.id)}
                            >
                              Assign
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

