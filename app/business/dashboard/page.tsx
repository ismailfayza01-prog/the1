'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { userService, businessService, deliveryService, riderService } from '@/lib/storage';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Package, CreditCard, LogOut,
  Home, Wallet, X, Bike, Receipt, AlertCircle, CheckCircle2,
} from 'lucide-react';
import type { User, Business, Delivery, Rider } from '@/lib/types';
import Link from 'next/link';

// Tangier bounding box
const MAP_BOUNDS = { latMin: 35.74, latMax: 35.79, lngMin: -5.86, lngMax: -5.80 };
const BIZ_LOCATION = { lat: 35.7595, lng: -5.8340 };

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
  const fromJson = (rider.current_location as { lat: number; lng: number } | null);
  if (fromJson) return fromJson;
  return seedLocation(rider.id);
}

interface BusinessMapProps {
  riders: Rider[];
  selectedRiderId: string | null;
  onSelectRider: (id: string | null) => void;
  pinMode?: 'pickup' | 'dropoff' | null;
  pickupPin?: { lat: number; lng: number } | null;
  dropoffPin?: { lat: number; lng: number } | null;
  onMapPin?: (lat: number, lng: number) => void;
}

function BusinessMap({
  riders,
  selectedRiderId,
  onSelectRider,
  pinMode = null,
  pickupPin = null,
  dropoffPin = null,
  onMapPin,
}: BusinessMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const ridersLayerRef = useRef<any>(null);
  const pinsLayerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
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

      const businessIcon = L.divIcon({
        className: 'business-pin',
        html: '<div style="width:24px;height:24px;border-radius:999px;background:#0ea5e9;border:2px solid #fff;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.25)">B</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      L.marker([BIZ_LOCATION.lat, BIZ_LOCATION.lng], { icon: businessIcon })
        .addTo(map)
        .bindTooltip('Votre adresse', { direction: 'top', offset: [0, -12] });

      ridersLayerRef.current = L.layerGroup().addTo(map);
      pinsLayerRef.current = L.layerGroup().addTo(map);
      routeLineRef.current = L.polyline([], {
        color: '#10b981',
        weight: 3,
        dashArray: '6 6',
      }).addTo(map);

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
      pinsLayerRef.current = null;
      routeLineRef.current = null;
      leafletRef.current = null;
      didFitBoundsRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !ridersLayerRef.current) return;

    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = ridersLayerRef.current;
    const routeLine = routeLineRef.current;

    layer.clearLayers();

    for (const rider of riders) {
      const loc = getRiderLocation(rider);
      const isSelected = rider.id === selectedRiderId;
      const fillColor = rider.status === 'available'
        ? '#10b981'
        : rider.status === 'busy'
          ? '#f59e0b'
          : '#94a3b8';

      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: isSelected ? 9 : 7,
        fillColor,
        fillOpacity: 0.95,
        color: '#ffffff',
        weight: 2,
      });

      marker
        .addTo(layer)
        .bindTooltip(`${rider.name} · ${rider.status}`, { direction: 'top', offset: [0, -8] })
        .on('click', () => onSelectRider(isSelected ? null : rider.id));
    }

    const selected = riders.find((r) => r.id === selectedRiderId);
    if (selected && routeLine) {
      const selectedLoc = getRiderLocation(selected);
      const latlngs = [
        [BIZ_LOCATION.lat, BIZ_LOCATION.lng],
        [selectedLoc.lat, selectedLoc.lng],
      ];
      routeLine.setLatLngs(latlngs);
      const routeBounds = L.latLngBounds(latlngs as [number, number][]);
      map.fitBounds(routeBounds, { padding: [48, 48], maxZoom: 15 });
      return;
    }

    if (routeLine) {
      routeLine.setLatLngs([]);
    }

    if (!didFitBoundsRef.current && riders.length > 0) {
      const allPoints: [number, number][] = riders.map((r) => {
        const loc = getRiderLocation(r);
        return [loc.lat, loc.lng];
      });
      allPoints.push([BIZ_LOCATION.lat, BIZ_LOCATION.lng]);
      map.fitBounds(L.latLngBounds(allPoints), { padding: [48, 48], maxZoom: 14 });
      didFitBoundsRef.current = true;
    }
  }, [riders, selectedRiderId, onSelectRider]);

  useEffect(() => {
    if (!mapRef.current || !leafletRef.current || !pinsLayerRef.current) return;

    const L = leafletRef.current;
    const pinsLayer = pinsLayerRef.current;
    pinsLayer.clearLayers();

    if (pickupPin) {
      L.circleMarker([pickupPin.lat, pickupPin.lng], {
        radius: 7,
        fillColor: '#0ea5e9',
        fillOpacity: 0.95,
        color: '#ffffff',
        weight: 2,
      })
        .addTo(pinsLayer)
        .bindTooltip('Pickup pin', { direction: 'top', offset: [0, -8] });
    }

    if (dropoffPin) {
      L.circleMarker([dropoffPin.lat, dropoffPin.lng], {
        radius: 7,
        fillColor: '#ef4444',
        fillOpacity: 0.95,
        color: '#ffffff',
        weight: 2,
      })
        .addTo(pinsLayer)
        .bindTooltip('Dropoff pin', { direction: 'top', offset: [0, -8] });
    }
  }, [pickupPin, dropoffPin]);

  useEffect(() => {
    if (!mapRef.current || !onMapPin) return;
    const map = mapRef.current;

    const clickHandler = (e: any) => {
      if (!pinMode) return;
      onMapPin(e.latlng.lat, e.latlng.lng);
    };

    map.on('click', clickHandler);
    return () => {
      map.off('click', clickHandler);
    };
  }, [onMapPin, pinMode]);

  return <div ref={mapContainerRef} role="region" aria-label="Live rider locations map for Tangier" className="w-full h-full rounded-2xl" />;
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-lg flex items-center justify-between px-6 h-15 mb-6 rounded-lg">
        <div className="h-8 bg-gray-200 rounded w-32 animate-pulse" />
        <div className="h-8 bg-gray-200 rounded w-20 animate-pulse" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-border shadow-sm rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>

      <div className="bg-gray-50 border border-border rounded-2xl h-96 animate-pulse" />
    </div>
  );
}

export default function BusinessDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [availableRiders, setAvailableRiders] = useState<Rider[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffPhone, setDropoffPhone] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pinMode, setPinMode] = useState<'pickup' | 'dropoff' | null>('dropoff');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [allRiders, setAllRiders] = useState<Rider[]>([]);

  // Subscription UI state
  const [sidebarTab, setSidebarTab] = useState<'create' | 'track' | 'subscription' | 'wallet' | 'history'>('create');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [addingCredits, setAddingCredits] = useState(false);
  const [topUpError, setTopUpError] = useState('');
  const [dispatchingDeliveryId, setDispatchingDeliveryId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpDeliveryId, setOtpDeliveryId] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const user = await userService.getCurrentUser();
      if (!user || user.role !== 'business') { router.push('/business'); return; }
      setCurrentUser(user);
      await loadData(user.id);
      channel = supabase.channel('business-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => loadData(user.id))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => loadData(user.id))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => loadData(user.id))
        .subscribe();
    }
    init();
    const poller = setInterval(() => {
      if (currentUser?.id) loadData(currentUser.id);
    }, 8000);
    return () => {
      if (channel) supabase.removeChannel(channel);
      clearInterval(poller);
    };
  }, [router, currentUser?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async (userId: string) => {
    const biz = await businessService.getByUserId(userId);
    if (biz) {
      setBusiness(biz);
      setDeliveries(await deliveryService.getByBusinessId(biz.id));
    }
    setAvailableRiders(await riderService.getAvailable());
    setAllRiders(await riderService.getAll());
  };

  const handleLogout = async () => { await userService.logout(); router.push('/business'); };
  const selectedRider = allRiders.find(r => r.id === selectedRiderId) ?? null;

  const handleMapPin = (lat: number, lng: number) => {
    const coordLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (pinMode === 'pickup') {
      setPickupCoords({ lat, lng });
      setPickupAddress(`Pinned at ${coordLabel}`);
      return;
    }
    if (pinMode === 'dropoff') {
      setDropoffCoords({ lat, lng });
      setDropoffAddress(`Pinned at ${coordLabel}`);
    }
  };

  const handleRequestDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    setSubmitting(true);
    try {
      const preferredRiderUserId = selectedRider?.user_id ?? null;
      const created = await deliveryService.create({
        business_id: business.id,
        business_name: business.name,
        rider_id: null,
        rider_name: null,
        pickup_address: pickupAddress || `${business.name} (pickup)`,
        pickup_lat: pickupCoords?.lat ?? (BIZ_LOCATION.lat + (Math.random() - 0.5) * 0.01),
        pickup_lng: pickupCoords?.lng ?? (BIZ_LOCATION.lng + (Math.random() - 0.5) * 0.01),
        dropoff_address: dropoffAddress,
        dropoff_phone: dropoffPhone,
        note: deliveryNote || null,
        dropoff_lat: dropoffCoords?.lat ?? (BIZ_LOCATION.lat + (Math.random() - 0.5) * 0.02),
        dropoff_lng: dropoffCoords?.lng ?? (BIZ_LOCATION.lng + (Math.random() - 0.5) * 0.02),
        estimated_duration: 15 + Math.floor(Math.random() * 20),
        actual_duration: null,
        price: business.subscription_tier !== 'none' ? 0 : 25,
        rider_commission: 15,
        status: 'pending',
        payment_method: business.subscription_tier !== 'none' ? 'subscription' : 'payg',
        accepted_at: null,
        picked_up_at: null,
        completed_at: null,
      });

      if (preferredRiderUserId) {
        try {
          await deliveryService.dispatchDelivery(created.id, preferredRiderUserId);
        } catch (dispatchErr) {
          console.error('Auto-dispatch error', dispatchErr);
        }
      }

      if (business.subscription_tier !== 'none') await businessService.useRide(business.id);
      await loadData(currentUser!.id);
      setPickupAddress('');
      setDropoffAddress('');
      setDropoffPhone('');
      setDeliveryNote('');
      setPickupCoords(null);
      setDropoffCoords(null);
      setPinMode('dropoff');
      setSelectedRiderId(null);
      setSuccessMsg(preferredRiderUserId
        ? 'Livraison créée + rider sélectionné. Suivez-la dans Track.'
        : 'Livraison créée. Choisissez un rider puis suivez-la dans Track.');
      setTimeout(() => setSuccessMsg(''), 4000);
      setSidebarTab('track');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatchDelivery = async (deliveryId: string, preferredRiderUserId?: string | null) => {
    setDispatchingDeliveryId(deliveryId);
    try {
      await deliveryService.dispatchDelivery(deliveryId, preferredRiderUserId ?? null);
    } catch (err) {
      console.error('Dispatch error', err);
      setSuccessMsg('Aucun rider disponible');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setDispatchingDeliveryId(null);
    }
  };

  const handleOpenOtpModal = (deliveryId: string) => {
    setOtpDeliveryId(deliveryId);
    setOtpValue('');
    setOtpError('');
    setOtpModalOpen(true);
  };

  const handleSetOtp = async () => {
    if (!otpDeliveryId) return;
    if (!/^\d{4}$/.test(otpValue)) {
      setOtpError('OTP must be exactly 4 digits.');
      return;
    }
    setOtpSubmitting(true);
    setOtpError('');
    try {
      const res = await deliveryService.setDeliveryOtp(otpDeliveryId, otpValue);
      if (res?.expires_at) {
        setSuccessMsg(`OTP set. Expires at ${new Date(res.expires_at).toLocaleTimeString()}`);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
      setOtpModalOpen(false);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'Failed to set OTP');
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleViewPodPhoto = async (deliveryId: string, photoPath: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .storage
      .from('delivery-pod')
      .createSignedUrl(photoPath, 300);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, '_blank');
  };

  const handleSubscribe = async (tier: 'monthly' | 'annual') => {
    if (!business || !currentUser) return;
    setSubscribing(true);
    setSubscriptionError('');
    try {
      const success = await businessService.subscribe(business.id, tier, currentUser.id);
      if (success) {
        setSelectedPlan(null);
        setSuccessMsg(`Abonnement ${tier === 'monthly' ? 'mensuel' : 'annuel'} activé !`);
        await loadData(currentUser.id);
        setTimeout(() => setSuccessMsg(''), 4000);
        setSidebarTab('wallet');
      } else {
        setSubscriptionError('Erreur lors de l\'activation');
      }
    } catch (err) {
      setSubscriptionError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubscribing(false);
    }
  };

  const handleAddCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !currentUser) return;
    const amount = parseFloat(topUpAmount);
    if (amount <= 0 || !Number.isFinite(amount)) {
      setTopUpError('Montant invalide');
      return;
    }
    if (amount > 99999) {
      setTopUpError('Le montant ne peut pas dépasser 99 999 MAD');
      return;
    }

    setAddingCredits(true);
    setTopUpError('');
    try {
      const success = await businessService.addCredits(business.id, amount, currentUser.id);
      if (success) {
        setTopUpAmount('');
        setSuccessMsg(`+${amount} MAD crédits ajoutés !`);
        await loadData(currentUser.id);
        setTimeout(() => setSuccessMsg(''), 4000);
        setSidebarTab('wallet');
      } else {
        setTopUpError('Erreur lors de l\'ajout des crédits');
      }
    } catch (err) {
      setTopUpError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setAddingCredits(false);
    }
  };

  if (!currentUser || !business) return <LoadingSkeleton />;

  const activeDeliveries = deliveries.filter(d => ['pending', 'offered', 'accepted', 'picked_up', 'in_transit'].includes(d.status));
  const completedDeliveries = deliveries.filter(d => ['delivered', 'cancelled', 'expired'].includes(d.status));
  const trackDeliveries = deliveries.filter(d => ['pending', 'offered', 'accepted', 'picked_up', 'in_transit'].includes(d.status));
  const ridesRemaining = business.rides_total - business.rides_used;

  const getDispatchCountdown = (createdAt: string) => {
    const remainingMs = 90000 - (nowTs - new Date(createdAt).getTime());
    return Math.max(0, Math.ceil(remainingMs / 1000));
  };

  const formatLastSeen = (ts?: string | null) => {
    if (!ts) return 'never';
    const diff = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
    if (diff < 30) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    offered: 'bg-amber-100 text-amber-700 border-amber-200',
    accepted: 'bg-sky-100 text-sky-700 border-sky-200',
    picked_up: 'bg-violet-100 text-violet-700 border-violet-200',
    in_transit: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    expired: 'bg-slate-100 text-slate-500 border-slate-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/90 backdrop-blur-lg flex items-center justify-between px-6 h-15">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="bg-transparent border-none cursor-pointer text-sky-400 hover:text-sky-300 transition-colors">
              <Home size={18} />
            </button>
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center">
              <MapPin size={14} className="text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-sm text-foreground">{business.name}</div>
              <div className="text-xs text-sky-500">Business Portal</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {successMsg && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 animate-pulse">
              ✓ {successMsg}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg p-1.5 cursor-pointer text-gray-600 hover:text-gray-800 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] h-[calc(100vh-60px)] overflow-hidden">

        {/* LEFT: Map Section */}
        <div className="relative p-5 lg:p-6 flex flex-col gap-4 overflow-hidden">

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4 flex-shrink-0">
            {[
              { label: 'Abonnement', value: business.subscription_tier === 'none' ? 'Aucun' : business.subscription_tier === 'monthly' ? 'Mensuel' : 'Annuel', icon: <CreditCard size={14} />, color: 'text-sky-500' },
              { label: 'Courses', value: `${ridesRemaining}/${business.rides_total}`, icon: <Package size={14} />, color: 'text-violet-500' },
              { label: 'Wallet', value: `${business.wallet_balance} MAD`, icon: <Wallet size={14} />, color: 'text-emerald-500' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-border shadow-sm rounded-xl p-3 lg:p-4 flex items-center gap-3">
                <div className={s.color}>{s.icon}</div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  <div className="font-display font-bold text-sm lg:text-base text-foreground truncate">
                    {s.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Map Legend */}
          <div className="flex gap-3 items-center flex-shrink-0 overflow-x-auto">
            <div className="text-xs text-muted-foreground font-semibold whitespace-nowrap">CARTE EN DIRECT</div>
            <div className="flex gap-2">
              {[
                { color: 'bg-sky-400', label: 'Votre adresse' },
                { color: 'bg-emerald-500', label: `${availableRiders.length} rider${availableRiders.length !== 1 ? 's' : ''}` },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2 bg-white border border-border rounded-full px-3 py-1 text-xs text-foreground whitespace-nowrap">
                  <div className={`w-1.5 h-1.5 rounded-full ${l.color}`} />
                  {l.label}
                </div>
              ))}
              {selectedRider && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-xs text-emerald-700 whitespace-nowrap">
                  <Bike size={10} /> {selectedRider.name}
                </div>
              )}
            </div>
          </div>

          {/* Canvas Map */}
          <div className="flex-1 bg-gray-50 border border-border rounded-2xl overflow-hidden min-h-0">
            <BusinessMap
              riders={availableRiders}
              selectedRiderId={selectedRiderId}
              onSelectRider={setSelectedRiderId}
              pinMode={sidebarTab === 'create' ? pinMode : null}
              pickupPin={pickupCoords}
              dropoffPin={dropoffCoords}
              onMapPin={handleMapPin}
            />
          </div>

          {/* Active Deliveries Strip */}
          {activeDeliveries.length > 0 && (
            <div className="flex-shrink-0 bg-white border border-border shadow-sm rounded-xl p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Livraisons actives ({activeDeliveries.length})
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {activeDeliveries.map(d => (
                  <div key={d.id} className={`${statusColor[d.status]} border rounded-lg px-3 py-2 text-xs flex-shrink-0`}>
                    <div className="font-semibold">{d.status}</div>
                    <div className="text-[11px] opacity-80">
                      {new Date(d.picked_up_at || d.accepted_at || d.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracking is in dedicated Track tab */}
        </div>

        {/* RIGHT: Sidebar with Tabs (hidden on mobile) */}
        <div className="hidden lg:flex flex-col bg-white border-l border-border overflow-hidden">

          {/* Tab Navigation */}
          <div className="flex border-b border-border flex-shrink-0 overflow-x-auto">
            <button
              onClick={() => { setSidebarTab('create'); setSelectedRiderId(null); }}
              className={`flex-1 py-3 px-4 text-sm font-semibold text-center transition-colors ${
                sidebarTab === 'create'
                  ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Create
            </button>
            <button
              onClick={() => setSidebarTab('track')}
              className={`flex-1 py-3 px-4 text-sm font-semibold text-center transition-colors ${
                sidebarTab === 'track'
                  ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Track
            </button>
            <button
              onClick={() => setSidebarTab('subscription')}
              className={`flex-1 py-3 px-4 text-sm font-semibold text-center transition-colors ${
                sidebarTab === 'subscription'
                  ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="hidden sm:inline">Plan</span>
              <span className="sm:hidden text-xs">Plan</span>
            </button>
            <button
              onClick={() => setSidebarTab('wallet')}
              className={`flex-1 py-3 px-4 text-sm font-semibold text-center transition-colors ${
                sidebarTab === 'wallet'
                  ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="hidden sm:inline">Portefeuille</span>
              <span className="sm:hidden text-xs">Wallet</span>
            </button>
            <button
              onClick={() => setSidebarTab('history')}
              className={`flex-1 py-3 px-4 text-sm font-semibold text-center transition-colors ${
                sidebarTab === 'history'
                  ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="hidden sm:inline">Historique</span>
              <span className="sm:hidden text-xs">Hist</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">

            {/* RIDERS TAB */}
            {sidebarTab === 'create' && (
              <div className="flex h-full flex-col overflow-hidden">
                <form onSubmit={handleRequestDelivery} className="space-y-3 border-b border-border p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-foreground">Nouvelle livraison</div>
                    {selectedRider && (
                      <button
                        type="button"
                        onClick={() => setSelectedRiderId(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
                    {selectedRider
                      ? `Rider préféré: ${selectedRider.name} (${selectedRider.status})`
                      : 'Aucun rider préféré (dispatch automatique ou admin manuel).'}
                  </div>

                  <div className="rounded-md border border-border bg-background px-3 py-2 space-y-2">
                    <div className="text-xs font-semibold text-foreground">Pin by map click</div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={pinMode === 'pickup' ? 'default' : 'outline'}
                        onClick={() => setPinMode('pickup')}
                      >
                        Pickup pin
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={pinMode === 'dropoff' ? 'default' : 'outline'}
                        onClick={() => setPinMode('dropoff')}
                      >
                        Dropoff pin
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPickupCoords(null);
                          setDropoffCoords(null);
                        }}
                      >
                        Clear pins
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Click on the map to place the {pinMode ?? 'dropoff'} pointer.
                    </p>
                    {(pickupCoords || dropoffCoords) && (
                      <div className="text-[11px] text-muted-foreground space-y-1">
                        {pickupCoords && <p>Pickup: {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}</p>}
                        {dropoffCoords && <p>Dropoff: {dropoffCoords.lat.toFixed(5)}, {dropoffCoords.lng.toFixed(5)}</p>}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="pickup" className="text-xs text-muted-foreground">Adresse de départ</Label>
                    <Input
                      id="pickup"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="Pickup address (optional)"
                      className="mt-1 text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dropoff" className="text-xs text-muted-foreground">Adresse de livraison</Label>
                    <Input
                      id="dropoff"
                      value={dropoffAddress}
                      onChange={(e) => setDropoffAddress(e.target.value)}
                      placeholder="Enter dropoff address"
                      className="mt-1 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="dropoff-phone" className="text-xs text-muted-foreground">Téléphone de livraison</Label>
                    <Input
                      id="dropoff-phone"
                      value={dropoffPhone}
                      onChange={(e) => setDropoffPhone(e.target.value)}
                      placeholder="+212 6 00 00 00 00"
                      className="mt-1 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="note" className="text-xs text-muted-foreground">Note (optionnel)</Label>
                    <Input
                      id="note"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Notes for rider"
                      className="mt-1 text-sm"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || !dropoffAddress || !dropoffPhone}
                    className="w-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold hover:from-sky-600 hover:to-cyan-600"
                  >
                    {submitting ? 'Creating...' : 'Créer la livraison'}
                  </Button>
                </form>

                <div className="border-b border-border p-4">
                  <div className="text-sm font-semibold text-foreground">Rider availability</div>
                  <div className="text-xs text-muted-foreground">
                    {allRiders.length} total · {availableRiders.length} online
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {allRiders.map((r) => {
                    const canSelect = r.status === 'available';
                    const isSelected = selectedRiderId === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => canSelect && setSelectedRiderId(isSelected ? null : r.id)}
                        className={`w-full px-4 py-3 border-b border-border text-left transition-colors ${
                          canSelect ? 'hover:bg-sky-50' : 'opacity-70 cursor-not-allowed'
                        } ${isSelected ? 'bg-sky-50' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${r.status === 'available' ? 'bg-emerald-500' : r.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                          <div className="font-semibold text-sm text-foreground">{r.name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{r.status} · last seen {formatLastSeen(r.last_seen_at)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TRACK TAB */}
            {sidebarTab === 'track' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">Tracking board</div>
                  <div className="text-xs text-muted-foreground">{trackDeliveries.length} active</div>
                </div>

                {trackDeliveries.length === 0 ? (
                  <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
                    No active deliveries. Create one in the Create tab.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trackDeliveries.map(d => {
                      const countdown = getDispatchCountdown(d.created_at);
                      const isOffered = d.status === 'offered';
                      const isPending = d.status === 'pending';
                      const isAccepted = d.status === 'accepted';
                      const isDelivered = d.status === 'delivered';
                      const podMethod = (d as any).pod_method as string | null | undefined;
                      const podPhoto = (d as any).pod_photo_url as string | null | undefined;
                      const canDispatch = isPending;
                      const showCountdown = isPending || isOffered;
                      const canSetOtp = ['accepted', 'picked_up', 'in_transit'].includes(d.status) && !isDelivered;

                      return (
                        <div key={d.id} className="rounded-lg border border-border px-3 py-3 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs border rounded-full px-2 py-0.5 ${statusColor[d.status]}`}>{d.status}</span>
                            {isAccepted && d.rider_name && (
                              <span className="text-xs text-muted-foreground">Assigned: {d.rider_name}</span>
                            )}
                            {isDelivered && podMethod === 'otp' && (
                              <span className="text-xs text-emerald-600">PoD: OTP verified</span>
                            )}
                            {isDelivered && podMethod === 'photo' && (
                              <span className="text-xs text-emerald-600">PoD: Photo</span>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground truncate">{d.pickup_address}</p>
                          <p className="text-[11px] text-muted-foreground truncate">Dropoff: {d.dropoff_address} · {d.dropoff_phone}</p>
                          <p className="text-[11px] text-muted-foreground">Created: {new Date(d.created_at).toLocaleString()}</p>
                          {d.note && (
                            <p className="text-[11px] text-muted-foreground truncate">Note: {d.note}</p>
                          )}
                          {showCountdown && (
                            <p className="text-[11px] text-muted-foreground">Timeout: {countdown}s</p>
                          )}

                          <div className="flex items-center gap-2">
                            {canSetOtp && (
                              <Button size="sm" variant="outline" onClick={() => handleOpenOtpModal(d.id)}>
                                Set OTP
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canDispatch || dispatchingDeliveryId === d.id || isOffered}
                              onClick={() => handleDispatchDelivery(d.id, selectedRider?.user_id ?? null)}
                            >
                              {isOffered ? 'Searching…' : 'Dispatch'}
                            </Button>
                            {isDelivered && podMethod === 'photo' && podPhoto && (
                              <Button size="sm" variant="outline" onClick={() => handleViewPodPhoto(d.id, podPhoto)}>
                                View Photo
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SUBSCRIPTION TAB */}
            {sidebarTab === 'subscription' && (
              <div className="p-4 space-y-4">
                {/* Current Status */}
                {business.subscription_tier !== 'none' && (
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <div className="text-xs text-sky-600 font-semibold uppercase mb-2">Abonnement actif</div>
                    <div className="text-sm font-bold text-sky-700 mb-2">{business.subscription_tier === 'monthly' ? 'Mensuel' : 'Annuel'}</div>
                    <div className="text-xs text-sky-600 mb-1">Renouvellement: {new Date(business.renewal_date || '').toLocaleDateString('fr-FR')}</div>
                    <div className="text-xs text-sky-600">{business.rides_total - business.rides_used} / {business.rides_total} courses restantes</div>
                  </div>
                )}

                {/* Plan Selection */}
                {subscriptionError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    {subscriptionError}
                  </div>
                )}

                <div className="space-y-3">
                  {/* Monthly Plan */}
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:border-sky-300 transition-colors">
                    <div className="text-sm font-bold text-foreground mb-2">Plan Mensuel</div>
                    <div className="text-lg font-bold text-sky-600 mb-2">200 MAD</div>
                    <div className="text-xs text-muted-foreground mb-4">8 courses / 30 jours</div>
                    <Button
                      onClick={() => handleSubscribe('monthly')}
                      disabled={subscribing || business.subscription_tier !== 'none'}
                      className="w-full"
                      variant={selectedPlan === 'monthly' ? 'default' : 'outline'}
                    >
                      {subscribing && selectedPlan === 'monthly' ? 'Activation...' : 'Choisir'}
                    </Button>
                  </div>

                  {/* Annual Plan */}
                  <div className="bg-white border-2 border-emerald-200 rounded-lg p-4 hover:border-emerald-400 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-sm font-bold text-foreground">Plan Annuel</div>
                      <div className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-1 rounded">Économise 600 MAD</div>
                    </div>
                    <div className="text-lg font-bold text-emerald-600 mb-2">1800 MAD</div>
                    <div className="text-xs text-muted-foreground mb-4">96 courses / 365 jours</div>
                    <Button
                      onClick={() => handleSubscribe('annual')}
                      disabled={subscribing || business.subscription_tier !== 'none'}
                      className={`w-full ${selectedPlan === 'annual' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
                      variant={selectedPlan === 'annual' ? 'default' : 'outline'}
                    >
                      {subscribing && selectedPlan === 'annual' ? 'Activation...' : 'Choisir'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* WALLET TAB */}
            {sidebarTab === 'wallet' && (
              <div className="p-4 space-y-4">
                {/* Balance Display */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
                  <div className="text-xs text-emerald-700 font-semibold uppercase mb-2">Solde actuel</div>
                  <div className="text-2xl font-bold text-emerald-700">{business.wallet_balance} MAD</div>
                </div>

                {/* Top-Up Form */}
                {topUpError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    {topUpError}
                  </div>
                )}

                <form onSubmit={handleAddCredits} className="space-y-4">
                  <div>
                    <Label htmlFor="topup-amount" className="text-xs text-muted-foreground">Montant à ajouter (MAD)</Label>
                    <Input
                      id="topup-amount"
                      type="number"
                      inputMode="decimal"
                      placeholder="Entrez le montant..."
                      min="1"
                      max="99999"
                      step="1"
                      value={topUpAmount}
                      onChange={(e) => { setTopUpAmount(e.target.value); setTopUpError(''); }}
                      className="mt-2 text-sm"
                      required
                      disabled={addingCredits}
                    />
                    <div className="text-xs text-muted-foreground mt-2">Montant minimum: 1 MAD</div>
                  </div>

                  {topUpAmount && Number.isFinite(parseFloat(topUpAmount)) && parseFloat(topUpAmount) > 0 && (
                    <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-sm text-sky-700">
                      Nouveau solde: {business.wallet_balance} + {topUpAmount} = <span className="font-bold">{(business.wallet_balance + parseFloat(topUpAmount)).toFixed(2)}</span> MAD
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={addingCredits || !topUpAmount}
                    className="w-full bg-emerald-500 hover:bg-emerald-600"
                  >
                    {addingCredits ? 'Traitement...' : 'Ajouter des crédits'}
                  </Button>
                </form>
              </div>
            )}

            {/* HISTORY TAB */}
            {sidebarTab === 'history' && (
              <div className="p-4">
                {completedDeliveries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12">
                    <Receipt size={24} className="text-gray-300 mb-3" />
                    <div className="text-sm font-semibold text-muted-foreground mb-1">No delivery history yet</div>
                    <div className="text-xs text-muted-foreground">Delivered, cancelled, and expired deliveries appear here.</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {completedDeliveries.map((d) => {
                      const badgeClass = statusColor[d.status] || 'bg-slate-100 text-slate-600 border-slate-200';
                      return (
                        <div key={d.id} className="bg-white border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg flex-shrink-0">
                                <CheckCircle2 size={14} />
                              </div>
                              <div className={`text-xs border rounded-full px-2 py-0.5 ${badgeClass}`}>{d.status}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{d.rider_name || 'Unassigned'}</div>
                          </div>
                          <div className="text-sm font-semibold text-foreground truncate">{d.dropoff_address}</div>
                          <div className="text-xs text-muted-foreground truncate">{d.pickup_address}</div>
                          <div className="text-xs text-gray-500 mt-1">{new Date(d.completed_at || d.created_at).toLocaleString()}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      <Dialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Delivery OTP</DialogTitle>
            <DialogDescription>Enter a 4-digit OTP for this delivery.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              maxLength={4}
              inputMode="numeric"
            />
            {otpError && <p className="text-xs text-red-500">{otpError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSetOtp} disabled={otpSubmitting}>Save OTP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
