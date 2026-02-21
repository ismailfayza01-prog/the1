'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';
import { userService, businessService, deliveryService, riderService, transactionService } from '@/lib/storage';
import {
  MapPin, Package, CreditCard, LogOut, Plus, CheckCircle2,
  Home, Wallet, Navigation, X, ArrowRight, Bike,
  Receipt, AlertCircle, TrendingUp, DollarSign,
} from 'lucide-react';
import type { User, Business, Delivery, Rider, Transaction } from '@/lib/types';
import Link from 'next/link';

// Tangier bounding box
const MAP_BOUNDS = { latMin: 35.74, latMax: 35.79, lngMin: -5.86, lngMax: -5.80 };
const BIZ_LOCATION = { lat: 35.7595, lng: -5.8340 };

function toCanvas(lat: number, lng: number, W: number, H: number) {
  const x = ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * W;
  const y = ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * H;
  return { x, y };
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
  const fromJson = (rider.current_location as { lat: number; lng: number } | null);
  if (fromJson) return fromJson;
  return seedLocation(rider.id);
}

interface BusinessMapProps {
  riders: Rider[];
  selectedRiderId: string | null;
  onSelectRider: (id: string | null) => void;
}

function BusinessMap({ riders, selectedRiderId, onSelectRider }: BusinessMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const posRef = useRef(
    riders.map(r => {
      const base = getRiderLocation(r);
      return { ...r, lat: base.lat, lng: base.lng, vx: (Math.random() - 0.5) * 0.00015, vy: (Math.random() - 0.5) * 0.00015 };
    })
  );

  useEffect(() => {
    const existing = new Map(posRef.current.map(r => [r.id, r]));
    posRef.current = riders.map(r => {
      if (existing.has(r.id)) return { ...existing.get(r.id)!, ...r };
      const base = getRiderLocation(r);
      return { ...r, lat: base.lat, lng: base.lng, vx: (Math.random() - 0.5) * 0.00015, vy: (Math.random() - 0.5) * 0.00015 };
    });
  }, [riders]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;

    function draw() {
      frame++;
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const W = canvas.width, H = canvas.height;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#0A0F1E';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(56,189,248,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      ctx.strokeStyle = 'rgba(56,189,248,0.10)';
      ctx.lineWidth = 2;
      [[0.25, 0, 0.65, 1], [0, 0.35, 1, 0.55], [0.1, 0, 0.55, 1], [0, 0.15, 1, 0.85], [0.5, 0, 0.8, 1]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1 * W, y1 * H); ctx.lineTo(x2 * W, y2 * H); ctx.stroke();
      });

      const biz = toCanvas(BIZ_LOCATION.lat, BIZ_LOCATION.lng, W, H);
      const bizPulse = 18 + Math.sin(frame * 0.05) * 4;
      ctx.beginPath(); ctx.arc(biz.x, biz.y, bizPulse, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56,189,248,${0.15 + Math.sin(frame * 0.05) * 0.08})`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(biz.x, biz.y, 10, 0, Math.PI * 2);
      const bizGrad = ctx.createRadialGradient(biz.x, biz.y, 0, biz.x, biz.y, 10);
      bizGrad.addColorStop(0, '#38BDF8'); bizGrad.addColorStop(1, '#0EA5E9');
      ctx.fillStyle = bizGrad; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('B', biz.x, biz.y);
      ctx.fillStyle = 'rgba(56,189,248,0.9)'; ctx.font = '10px var(--font-dm),sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Votre adresse', biz.x + 14, biz.y + 4);

      posRef.current = posRef.current.map(r => {
        if (r.status !== 'available') return r;
        let { lat, lng, vx, vy } = r;
        lat += vx; lng += vy;
        if (lat > MAP_BOUNDS.latMax || lat < MAP_BOUNDS.latMin) vx *= -1;
        if (lng > MAP_BOUNDS.lngMax || lng < MAP_BOUNDS.lngMin) vy *= -1;
        return { ...r, lat, lng, vx, vy };
      });

      posRef.current.forEach(r => {
        const { x, y } = toCanvas(r.lat, r.lng, W, H);
        const isSelected = r.id === selectedRiderId;
        const color = r.status === 'available' ? '#00FF88' : '#FF3B3B';

        if (isSelected) {
          ctx.beginPath(); ctx.moveTo(biz.x, biz.y); ctx.lineTo(x, y);
          ctx.strokeStyle = 'rgba(0,255,136,0.2)'; ctx.lineWidth = 1;
          ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
        }

        if (r.status === 'available') {
          const pulse = 14 + Math.sin(frame * 0.06 + r.id.charCodeAt(0)) * 5;
          ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,255,136,${0.12 + Math.sin(frame * 0.06 + r.id.charCodeAt(0)) * 0.08})`;
          ctx.lineWidth = 1; ctx.stroke();
        }

        if (isSelected) {
          ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
        }

        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();

        ctx.fillStyle = isSelected ? '#fff' : 'rgba(240,240,248,0.85)';
        ctx.font = isSelected ? 'bold 11px var(--font-dm),sans-serif' : '11px var(--font-dm),sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(r.name.split(' ')[0], x + 13, y + 1);
      });

      ctx.fillStyle = 'rgba(56,189,248,0.25)'; ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left'; ctx.fillText('TANGER', 12, H - 14);

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [selectedRiderId]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const hit = posRef.current.find(r => {
      const { x, y } = toCanvas(r.lat, r.lng, W, H);
      return Math.hypot(x - mx, y - my) < 20;
    });
    onSelectRider(hit ? hit.id : null);
  }, [onSelectRider]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      role="region"
      aria-label="Live rider locations map for Tangier"
      className="w-full h-full cursor-crosshair rounded-2xl"
    />
  );
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
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Subscription UI state
  const [sidebarTab, setSidebarTab] = useState<'riders' | 'subscription' | 'wallet' | 'history'>('riders');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [addingCredits, setAddingCredits] = useState(false);
  const [topUpError, setTopUpError] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dispatchingDeliveryId, setDispatchingDeliveryId] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());

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
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [router]);

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
    const txns = await transactionService.getByUserId(userId);
    setTransactions(txns);
  };

  const handleLogout = async () => { await userService.logout(); router.push('/business'); };
  const selectedRider = availableRiders.find(r => r.id === selectedRiderId) ?? null;

  const handleRequestDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !selectedRider) return;
    setSubmitting(true);
    try {
      await deliveryService.create({
        business_id: business.id,
        business_name: business.name,
        rider_id: null,
        rider_name: null,
        pickup_address: pickupAddress,
        pickup_lat: BIZ_LOCATION.lat + (Math.random() - 0.5) * 0.01,
        pickup_lng: BIZ_LOCATION.lng + (Math.random() - 0.5) * 0.01,
        dropoff_address: dropoffAddress,
        dropoff_lat: BIZ_LOCATION.lat + (Math.random() - 0.5) * 0.02,
        dropoff_lng: BIZ_LOCATION.lng + (Math.random() - 0.5) * 0.02,
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
      if (business.subscription_tier !== 'none') await businessService.useRide(business.id);
      await loadData(currentUser!.id);
      setPickupAddress('');
      setDropoffAddress('');
      setSelectedRiderId(null);
      setSuccessMsg('Livraison créée. Prête pour dispatch.');
      setTimeout(() => setSuccessMsg(''), 4000);
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
        setSidebarTab('history');
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
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');
  const ridesRemaining = business.rides_total - business.rides_used;
  const recentDeliveries = deliveries.slice(0, 5);

  const getDispatchCountdown = (createdAt: string) => {
    const remainingMs = 90000 - (nowTs - new Date(createdAt).getTime());
    return Math.max(0, Math.ceil(remainingMs / 1000));
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
                  <div key={d.id} className={`${statusColor[d.status]} border rounded-lg px-3 py-2 text-xs whitespace-nowrap flex-shrink-0`}>
                    {d.status}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dispatch List */}
          <div className="flex-shrink-0 bg-white border border-border shadow-sm rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Dispatch ({recentDeliveries.length})
            </div>
            <div className="space-y-3">
              {recentDeliveries.map(d => {
                const countdown = getDispatchCountdown(d.created_at);
                const isOffered = d.status === 'offered';
                const isPending = d.status === 'pending';
                const isAccepted = d.status === 'accepted';
                const canDispatch = isPending;
                const showCountdown = isPending || isOffered;
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs border rounded-full px-2 py-0.5 ${statusColor[d.status]}`}>{d.status}</span>
                        {isAccepted && d.rider_name && (
                          <span className="text-xs text-muted-foreground">Assigned: {d.rider_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{d.pickup_address}</p>
                      {showCountdown && (
                        <p className="text-[11px] text-muted-foreground">Timeout: {countdown}s</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canDispatch || dispatchingDeliveryId === d.id || isOffered}
                      onClick={() => handleDispatchDelivery(d.id, selectedRider?.user_id ?? null)}
                    >
                      {isOffered ? 'Searching…' : 'Dispatch'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar with Tabs (hidden on mobile) */}
        <div className="hidden lg:flex flex-col bg-white border-l border-border overflow-hidden">

          {/* Tab Navigation */}
          <div className="flex border-b border-border flex-shrink-0">
            <button
              onClick={() => { setSidebarTab('riders'); setSelectedRiderId(null); }}
              className={`flex-1 py-3 px-4 text-sm font-semibold text-center transition-colors ${
                sidebarTab === 'riders'
                  ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Riders
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
            {sidebarTab === 'riders' && (
              <>
                {!selectedRider ? (
                  <div className="flex flex-col overflow-hidden h-full">
                    <div className="p-4 border-b border-border flex-shrink-0">
                      <div className="text-sm font-semibold text-foreground">Sélectionner un rider</div>
                      <div className="text-xs text-muted-foreground">{availableRiders.length} disponible{availableRiders.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {availableRiders.map(r => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedRiderId(r.id)}
                          className="w-full px-4 py-3 border-b border-border hover:bg-sky-50 transition-colors text-left"
                        >
                          <div className="font-semibold text-sm text-foreground">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.total_deliveries} livraisons</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRequestDelivery} className="flex flex-col p-4 h-full overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-semibold text-sm text-foreground">Nouvelle livraison</div>
                      <button
                        type="button"
                        onClick={() => setSelectedRiderId(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="space-y-4 flex-1">
                      <div>
                        <Label className="text-xs text-muted-foreground">Rider</Label>
                        <div className="font-semibold text-sm mt-1 text-foreground">{selectedRider.name}</div>
                      </div>

                      <div>
                        <Label htmlFor="pickup" className="text-xs text-muted-foreground">Adresse de départ</Label>
                        <Input
                          id="pickup"
                          value={pickupAddress}
                          onChange={(e) => setPickupAddress(e.target.value)}
                          placeholder="Enter pickup address"
                          className="mt-1 text-sm"
                          required
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
                    </div>

                    <Button
                      type="submit"
                      disabled={submitting || !pickupAddress || !dropoffAddress}
                      className="w-full mt-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold hover:from-sky-600 hover:to-cyan-600"
                    >
                      {submitting ? 'Assigning...' : 'Assigner Livraison'}
                    </Button>
                  </form>
                )}
              </>
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
                {transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12">
                    <Receipt size={24} className="text-gray-300 mb-3" />
                    <div className="text-sm font-semibold text-muted-foreground mb-1">Aucune transaction</div>
                    <div className="text-xs text-muted-foreground">Vos transactions apparaîtront ici</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => {
                      const typeStyles = {
                        subscription: { bg: 'bg-sky-100', text: 'text-sky-700', icon: CreditCard },
                        top_up: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: Wallet },
                        delivery_charge: { bg: 'bg-amber-100', text: 'text-amber-700', icon: Package },
                        commission: { bg: 'bg-purple-100', text: 'text-purple-700', icon: TrendingUp },
                        payout: { bg: 'bg-blue-100', text: 'text-blue-700', icon: DollarSign },
                      }[tx.type] || { bg: 'bg-gray-100', text: 'text-gray-700', icon: Receipt };
                      const IconComp = typeStyles.icon;

                      return (
                        <div key={tx.id} className="bg-white border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`${typeStyles.bg} ${typeStyles.text} p-2 rounded-lg flex-shrink-0`}>
                                <IconComp size={14} />
                              </div>
                              <div className="text-sm font-semibold text-foreground">
                                {tx.type === 'subscription' ? 'Abonnement' : tx.type === 'top_up' ? 'Recharge' : tx.type === 'delivery_charge' ? 'Livraison' : tx.type === 'commission' ? 'Commission' : 'Paiement'}
                              </div>
                            </div>
                            <div className={`text-sm font-bold ${tx.type === 'top_up' || tx.type === 'commission' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {tx.type === 'top_up' || tx.type === 'commission' ? '+' : '-'}{tx.amount} MAD
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground text-truncate">{tx.description}</div>
                          <div className="text-xs text-gray-500 mt-1">{new Date(tx.created_at).toLocaleDateString('fr-FR')} à {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
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
    </div>
  );
}
