'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { userService, riderService, deliveryService } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import { getRiderCommission } from '@/lib/types';
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
} from 'lucide-react';
import type { User, Rider, Delivery } from '@/lib/types';
import Link from 'next/link';

export default function RiderDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rider, setRider] = useState<Rider | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let locationInterval: NodeJS.Timeout | null = null;
    let userId: string | null = null;
    let riderId: string | null = null;

    async function init() {
      const user = await userService.getCurrentUser();
      if (!user || user.role !== 'rider') {
        router.push('/rider');
        return;
      }
      userId = user.id;
      setCurrentUser(user);
      const riderData = await riderService.getByUserId(user.id);
      if (riderData) {
        riderId = riderData.id;
        setRider(riderData);
        setIsOnline(riderData.status !== 'offline');
        setDeliveries(await deliveryService.getByRiderId(riderData.id));
        setPendingDeliveries((await deliveryService.getActive()).filter(d => d.status === 'pending' && !d.rider_id));
      }

      // Location update interval (active GPS simulation)
      locationInterval = setInterval(async () => {
        if (!riderId) return;
        const r = await riderService.getByUserId(userId!);
        if (r && r.status !== 'offline') {
          const newLat = 35.7595 + (Math.random() - 0.5) * 0.02;
          const newLng = -5.8340 + (Math.random() - 0.5) * 0.02;
          await riderService.updateLocation(r.id, { lat: newLat, lng: newLng });
        }
      }, 10000);

      // Realtime subscriptions
      channel = supabase.channel('rider-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, async () => {
          if (riderId) {
            setDeliveries(await deliveryService.getByRiderId(riderId));
            setPendingDeliveries((await deliveryService.getActive()).filter(d => d.status === 'pending' && !d.rider_id));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, async () => {
          if (userId) {
            const r = await riderService.getByUserId(userId);
            if (r) setRider(r);
          }
        })
        .subscribe();
    }
    init();

    return () => {
      if (locationInterval) clearInterval(locationInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  const handleLogout = async () => {
    if (rider) {
      await riderService.updateStatus(rider.id, 'offline');
    }
    await userService.logout();
    router.push('/rider');
  };

  const handleToggleStatus = async (checked: boolean) => {
    if (!rider) return;
    setIsOnline(checked);
    await riderService.updateStatus(rider.id, checked ? 'available' : 'offline');
    const updatedRider = await riderService.getById(rider.id);
    if (updatedRider) setRider(updatedRider);
  };

  const handleAcceptDelivery = async (deliveryId: string) => {
    if (!rider) return;
    await deliveryService.update(deliveryId, {
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });
    await riderService.updateStatus(rider.id, 'busy');
    setDeliveries(await deliveryService.getByRiderId(rider.id));
    const updatedRider = await riderService.getById(rider.id);
    if (updatedRider) setRider(updatedRider);
  };

  const handleMarkPickedUp = async (deliveryId: string) => {
    await deliveryService.update(deliveryId, {
      status: 'picked_up',
      picked_up_at: new Date().toISOString(),
    });
    setDeliveries(await deliveryService.getByRiderId(rider!.id));
  };

  const handleMarkInTransit = async (deliveryId: string) => {
    await deliveryService.update(deliveryId, { status: 'in_transit' });
    setDeliveries(await deliveryService.getByRiderId(rider!.id));
  };

  const handleMarkDelivered = async (deliveryId: string) => {
    if (!rider) return;
    const delivery = deliveries.find(d => d.id === deliveryId);
    if (!delivery) return;

    const actualDuration = delivery.picked_up_at
      ? Math.round((Date.now() - new Date(delivery.picked_up_at).getTime()) / 60000)
      : delivery.estimated_duration;

    await deliveryService.update(deliveryId, {
      status: 'delivered',
      completed_at: new Date().toISOString(),
      actual_duration: actualDuration,
    });

    await riderService.update(rider.id, {
      total_deliveries: rider.total_deliveries + 1,
      earnings_this_month: rider.earnings_this_month + delivery.rider_commission,
      status: 'available',
    });

    setDeliveries(await deliveryService.getByRiderId(rider.id));
    const updatedRider = await riderService.getById(rider.id);
    if (updatedRider) setRider(updatedRider);
  };

  if (!currentUser || !rider) return null;

  const activeDelivery = deliveries.find(d => ['accepted', 'picked_up', 'in_transit'].includes(d.status));
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');

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
          </CardContent>
        </Card>

        {/* Earnings Card */}
        <Card className="border-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-lg shadow-emerald-200/50 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
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
                    Mark Picked Up
                  </Button>
                )}
                {activeDelivery.status === 'picked_up' && (
                  <Button
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold"
                    onClick={() => handleMarkInTransit(activeDelivery.id)}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Start Navigation
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
            </CardContent>
          </Card>
        )}

        {/* Available Deliveries */}
        {isOnline && !activeDelivery && pendingDeliveries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-bold text-foreground">Available Deliveries</h2>
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">{pendingDeliveries.length}</Badge>
            </div>
            {pendingDeliveries.slice(0, 3).map((delivery) => (
              <Card key={delivery.id} className="border border-border bg-white shadow-sm">
                <CardContent className="pt-5 space-y-3">
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

                  <Button
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold"
                    onClick={() => handleAcceptDelivery(delivery.id)}
                  >
                    Accept Delivery
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {isOnline && !activeDelivery && pendingDeliveries.length === 0 && (
          <Card className="border border-border bg-white shadow-sm">
            <CardContent className="py-14 text-center">
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Package className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="font-bold text-foreground">No deliveries available</p>
              <p className="text-sm text-muted-foreground mt-1">New requests will appear here</p>
            </CardContent>
          </Card>
        )}

        {/* Offline State */}
        {!isOnline && (
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
