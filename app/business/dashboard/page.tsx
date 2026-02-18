'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { createClient } from '@/lib/supabase/client';
import { userService, businessService, deliveryService, riderService } from '@/lib/storage';
import {
  MapPin, Package, CreditCard, LogOut, Plus, CheckCircle2,
  Home, Wallet, Navigation, X, ArrowRight, Bike,
} from 'lucide-react';
import type { User, Business, Delivery, Rider } from '@/lib/types';
import Link from 'next/link';

// Tangier bounding box
const MAP_BOUNDS = { latMin: 35.74, latMax: 35.79, lngMin: -5.86, lngMax: -5.80 };
const BIZ_LOCATION = { lat: 35.7595, lng: -5.8340 }; // business pin

function toCanvas(lat: number, lng: number, W: number, H: number) {
  const x = ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * W;
  const y = ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * H;
  return { x, y };
}

function seedLocation(id: string): { lat: number; lng: number } {
  // deterministic scatter from rider id so positions are stable
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const lat = MAP_BOUNDS.latMin + ((h & 0xff) / 255) * (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin);
  const lng = MAP_BOUNDS.lngMin + (((h >> 8) & 0xff) / 255) * (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin);
  return { lat, lng };
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
      const base = (r.current_location as { lat: number; lng: number } | null) ?? seedLocation(r.id);
      return {
        ...r,
        lat: base.lat,
        lng: base.lng,
        vx: (Math.random() - 0.5) * 0.00015,
        vy: (Math.random() - 0.5) * 0.00015,
      };
    })
  );

  // keep posRef in sync when riders list changes (new riders arrive)
  useEffect(() => {
    const existing = new Map(posRef.current.map(r => [r.id, r]));
    posRef.current = riders.map(r => {
      if (existing.has(r.id)) return { ...existing.get(r.id)!, ...r };
      const base = (r.current_location as { lat: number; lng: number } | null) ?? seedLocation(r.id);
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

      // Background
      ctx.fillStyle = '#0A0F1E';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(56,189,248,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Street-like lines
      ctx.strokeStyle = 'rgba(56,189,248,0.10)';
      ctx.lineWidth = 2;
      [[0.25, 0, 0.65, 1], [0, 0.35, 1, 0.55], [0.1, 0, 0.55, 1], [0, 0.15, 1, 0.85], [0.5, 0, 0.8, 1]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1 * W, y1 * H); ctx.lineTo(x2 * W, y2 * H); ctx.stroke();
      });

      // Business pin
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
      ctx.fillStyle = 'rgba(56,189,248,0.9)'; ctx.font = '10px DM Sans,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Votre adresse', biz.x + 14, biz.y + 4);

      // Animate busy riders
      posRef.current = posRef.current.map(r => {
        if (r.status !== 'available') return r;
        let { lat, lng, vx, vy } = r;
        lat += vx; lng += vy;
        if (lat > MAP_BOUNDS.latMax || lat < MAP_BOUNDS.latMin) vx *= -1;
        if (lng > MAP_BOUNDS.lngMax || lng < MAP_BOUNDS.lngMin) vy *= -1;
        return { ...r, lat, lng, vx, vy };
      });

      // Draw riders
      posRef.current.forEach(r => {
        const { x, y } = toCanvas(r.lat, r.lng, W, H);
        const isSelected = r.id === selectedRiderId;
        const color = r.status === 'available' ? '#00FF88' : '#FF3B3B';

        // Connection line to business (only for selected)
        if (isSelected) {
          ctx.beginPath(); ctx.moveTo(biz.x, biz.y); ctx.lineTo(x, y);
          ctx.strokeStyle = 'rgba(0,255,136,0.2)'; ctx.lineWidth = 1;
          ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
        }

        // Pulse ring for available
        if (r.status === 'available') {
          const pulse = 14 + Math.sin(frame * 0.06 + r.id.charCodeAt(0)) * 5;
          ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,255,136,${0.12 + Math.sin(frame * 0.06 + r.id.charCodeAt(0)) * 0.08})`;
          ctx.lineWidth = 1; ctx.stroke();
        }

        // Selection ring
        if (isSelected) {
          ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
        }

        // Main dot
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();

        // Label
        ctx.fillStyle = isSelected ? '#fff' : 'rgba(240,240,248,0.85)';
        ctx.font = isSelected ? 'bold 11px DM Sans,sans-serif' : '11px DM Sans,sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(r.name.split(' ')[0], x + 13, y + 1);
      });

      // City label
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
      style={{ width: '100%', height: '100%', cursor: 'crosshair', borderRadius: 16 }}
    />
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

  const loadData = async (userId: string) => {
    const biz = await businessService.getByUserId(userId);
    if (biz) {
      setBusiness(biz);
      setDeliveries(await deliveryService.getByBusinessId(biz.id));
    }
    setAvailableRiders(await riderService.getAvailable());
  };

  const handleLogout = async () => { await userService.logout(); router.push('/business'); };

  const selectedRider = availableRiders.find(r => r.id === selectedRiderId) ?? null;

  const handleRequestDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !selectedRider) return;
    setSubmitting(true);
    try {
      const newDelivery = await deliveryService.create({
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
      await deliveryService.assignRider(newDelivery.id, selectedRider.id);
      if (business.subscription_tier !== 'none') await businessService.useRide(business.id);
      await loadData(currentUser!.id);
      setPickupAddress('');
      setDropoffAddress('');
      setSelectedRiderId(null);
      setSuccessMsg(`Livraison assignée à ${selectedRider.name} !`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser || !business) return null;

  const activeDeliveries = deliveries.filter(d => ['pending', 'accepted', 'picked_up', 'in_transit'].includes(d.status));
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');
  const ridesRemaining = business.rides_total - business.rides_used;

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    accepted: 'bg-sky-100 text-sky-700 border-sky-200',
    picked_up: 'bg-violet-100 text-violet-700 border-violet-200',
    in_transit: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="min-h-screen bg-[#060912] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.3s ease forwards; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(6,9,18,0.92)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/">
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#38BDF8', display: 'flex' }}>
              <Home size={18} />
            </button>
          </Link>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#0EA5E9,#38BDF8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{business.name}</div>
              <div style={{ fontSize: 11, color: '#38BDF8', lineHeight: 1.4 }}>Business Portal</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {successMsg && (
            <div className="fade-up" style={{ fontSize: 13, color: '#00FF88', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 8, padding: '6px 14px' }}>
              ✓ {successMsg}
            </div>
          )}
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#888' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

        {/* LEFT: Map */}
        <div style={{ position: 'relative', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>

          {/* Stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, flexShrink: 0 }}>
            {[
              { label: 'Abonnement', value: business.subscription_tier === 'none' ? 'Aucun' : business.subscription_tier === 'monthly' ? 'Mensuel' : 'Annuel', icon: <CreditCard size={14} />, color: '#38BDF8' },
              { label: 'Courses restantes', value: `${ridesRemaining} / ${business.rides_total}`, icon: <Package size={14} />, color: '#A78BFA' },
              { label: 'Wallet', value: `${business.wallet_balance} MAD`, icon: <Wallet size={14} />, color: '#00FF88' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#F0F0F8', fontFamily: "'Syne',sans-serif" }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Map legend */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>CARTE EN DIRECT</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { color: '#38BDF8', label: 'Votre adresse' },
                { color: '#00FF88', label: `${availableRiders.length} rider${availableRiders.length !== 1 ? 's' : ''} disponible${availableRiders.length !== 1 ? 's' : ''}` },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#CCCCDD' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
                  {l.label}
                </div>
              ))}
              {selectedRider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 11, color: '#00FF88' }}>
                  <Bike size={11} /> {selectedRider.name} sélectionné
                </div>
              )}
            </div>
            {!selectedRider && availableRiders.length > 0 && (
              <div style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>Cliquez sur un rider pour le sélectionner</div>
            )}
          </div>

          {/* Canvas map */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', minHeight: 0 }}>
            <BusinessMap
              riders={availableRiders}
              selectedRiderId={selectedRiderId}
              onSelectRider={setSelectedRiderId}
            />
          </div>

          {/* Active deliveries (bottom strip) */}
          {activeDeliveries.length > 0 && (
            <div style={{ flexShrink: 0, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Livraisons actives ({activeDeliveries.length})</div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
                {activeDeliveries.map(d => (
                  <div key={d.id} style={{ flexShrink: 0, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', minWidth: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span className={`text-xs border rounded-full px-2 py-0.5 ${statusColor[d.status] || 'bg-slate-100 text-slate-500'}`}>{d.status.replace('_', ' ')}</span>
                      <span style={{ fontSize: 11, color: '#555' }}>~{d.estimated_duration} min</span>
                    </div>
                    {d.rider_name && <div style={{ fontSize: 12, color: '#38BDF8', marginBottom: 4 }}>🏍 {d.rider_name}</div>}
                    <div style={{ fontSize: 11, color: '#666' }}>{d.pickup_address}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>→ {d.dropoff_address}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Sidebar */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Rider selection or request form */}
          {!selectedRider ? (
            <>
              <div>
                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Riders disponibles</div>
                {availableRiders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#555' }}>
                    <Bike size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <div style={{ fontSize: 13 }}>Aucun rider disponible</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Réessayez dans quelques instants</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {availableRiders.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRiderId(r.id)}
                        style={{
                          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,255,136,0.15)',
                          borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12,
                          color: '#F0F0F8',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,136,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,255,136,0.3)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,255,136,0.15)'; }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Bike size={16} color="#00FF88" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{r.total_deliveries} livraisons · {r.earnings_this_month} MAD</div>
                        </div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00FF88', flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Completed deliveries */}
              <div>
                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Historique ({completedDeliveries.length})
                </div>
                {completedDeliveries.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#555' }}>
                    <Package size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                    <div style={{ fontSize: 12 }}>Aucune livraison complétée</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {completedDeliveries.slice(0, 8).map(d => (
                      <div key={d.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle2 size={12} color="#00FF88" />
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{d.completed_at ? new Date(d.completed_at).toLocaleDateString('fr-FR') : '—'}</span>
                          </div>
                          <span style={{ fontSize: 12, color: d.price === 0 ? '#38BDF8' : '#00FF88', fontWeight: 600 }}>
                            {d.price === 0 ? 'Abonnement' : `${d.price} MAD`}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#555' }}>{d.pickup_address}</div>
                        <div style={{ fontSize: 11, color: '#555' }}>→ {d.dropoff_address}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Delivery request form for selected rider */
            <div className="fade-up">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Demander une livraison</div>
                <button onClick={() => setSelectedRiderId(null)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#888', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>

              {/* Rider card */}
              <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bike size={18} color="#00FF88" />
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16 }}>{selectedRider.name}</div>
                    <div style={{ fontSize: 11, color: '#00FF88', marginTop: 2 }}>● Disponible maintenant</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                  {[
                    ['Livraisons', selectedRider.total_deliveries],
                    ['Gains ce mois', `${selectedRider.earnings_this_month} MAD`],
                  ].map(([l, v]) => (
                    <div key={String(l)} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{l}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F8', marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleRequestDelivery} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Adresse de départ</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#38BDF8' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8' }} />
                    </div>
                    <input
                      value={pickupAddress}
                      onChange={e => setPickupAddress(e.target.value)}
                      placeholder="Ex: Rue Ibn Batouta, Tanger"
                      required
                      style={{
                        width: '100%', paddingLeft: 28, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, color: '#F0F0F8', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Adresse de livraison</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#00FF88' }}>
                      <MapPin size={12} color="#00FF88" />
                    </div>
                    <input
                      value={dropoffAddress}
                      onChange={e => setDropoffAddress(e.target.value)}
                      placeholder="Ex: Av. Mohammed V, Tanger"
                      required
                      style={{
                        width: '100%', paddingLeft: 28, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10, color: '#F0F0F8', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.4)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    />
                  </div>
                </div>

                {/* Pricing info */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#666' }}>Paiement</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: business.subscription_tier !== 'none' ? '#38BDF8' : '#F0F0F8' }}>
                    {business.subscription_tier !== 'none' ? `Abonnement (${ridesRemaining} restantes)` : '25 MAD'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                    background: submitting ? 'rgba(0,255,136,0.3)' : 'linear-gradient(135deg,#00CC6A,#00FF88)',
                    color: '#0A0F1E', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {submitting ? 'Envoi en cours...' : (<><Navigation size={16} /> Confirmer la livraison</>)}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
