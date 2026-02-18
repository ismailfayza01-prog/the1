'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { userService, businessService, deliveryService, riderService } from '@/lib/storage';
import {
  MapPin,
  Package,
  CreditCard,
  LogOut,
  Plus,
  CheckCircle2,
  Home,
  Wallet,
  Navigation,
  ArrowRight,
} from 'lucide-react';
import type { User, Business, Delivery, Rider } from '@/lib/types';
import Link from 'next/link';

export default function BusinessDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [availableRiders, setAvailableRiders] = useState<Rider[]>([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const user = await userService.getCurrentUser();
      if (!user || user.role !== 'business') {
        router.push('/business');
        return;
      }
      setCurrentUser(user);
      await loadData(user.id);

      // Get business ID for filtered subscription
      const biz = await businessService.getByUserId(user.id);

      channel = supabase.channel('business-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => { loadData(user.id); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => { loadData(user.id); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'riders' }, () => { loadData(user.id); })
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

  const handleLogout = async () => {
    await userService.logout();
    router.push('/business');
  };

  const handleRequestDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;

    if (business.subscription_tier !== 'none' && business.rides_used >= business.rides_total) {
      alert('No rides remaining. Please top up your wallet or upgrade your subscription.');
      return;
    }

    const riders = await riderService.getAvailable();
    if (riders.length === 0) {
      alert('No riders available at the moment. Please try again shortly.');
      return;
    }

    const selectedRider = riders[0];

    const newDelivery = await deliveryService.create({
      business_id: business.id,
      business_name: business.name,
      rider_id: null,
      rider_name: null,
      pickup_address: pickupAddress,
      pickup_lat: 35.7595 + (Math.random() - 0.5) * 0.02,
      pickup_lng: -5.8340 + (Math.random() - 0.5) * 0.02,
      dropoff_address: dropoffAddress,
      dropoff_lat: 35.7595 + (Math.random() - 0.5) * 0.02,
      dropoff_lng: -5.8340 + (Math.random() - 0.5) * 0.02,
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

    if (business.subscription_tier !== 'none') {
      await businessService.useRide(business.id);
    }

    await loadData(currentUser!.id);
    setPickupAddress('');
    setDropoffAddress('');
    setShowRequestDialog(false);
  };

  if (!currentUser || !business) return null;

  const activeDeliveries = deliveries.filter(d => ['pending', 'accepted', 'picked_up', 'in_transit'].includes(d.status));
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');

  const ridesRemaining = business.rides_total - business.rides_used;
  const ridesPercentage = (business.rides_used / business.rides_total) * 100;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      accepted: 'bg-sky-100 text-sky-700 border-sky-200',
      picked_up: 'bg-violet-100 text-violet-700 border-violet-200',
      in_transit: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
    return variants[status] || 'bg-slate-100 text-slate-500 border-slate-200';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-sky-50">
                <Home className="h-5 w-5 text-sky-600" />
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-sky-100 p-1.5">
                <MapPin className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground leading-tight">{business.name}</h1>
                <p className="text-xs text-muted-foreground leading-tight">Business Portal</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
              <DialogTrigger asChild>
                <Button className="rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold shadow-md shadow-sky-200 gap-2">
                  <Plus className="h-4 w-4" />
                  Request Delivery
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl border-border">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Request New Delivery</DialogTitle>
                  <DialogDescription>
                    Enter pickup and dropoff addresses to request a delivery
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRequestDelivery} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="pickup" className="font-semibold text-sm">Pickup Address</Label>
                    <Input
                      id="pickup"
                      placeholder="Enter pickup address"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dropoff" className="font-semibold text-sm">Dropoff Address</Label>
                    <Input
                      id="dropoff"
                      placeholder="Enter dropoff address"
                      value={dropoffAddress}
                      onChange={(e) => setDropoffAddress(e.target.value)}
                      className="h-11 rounded-xl"
                      required
                    />
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-emerald-700">Available Riders</p>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border">{availableRiders.length} online</Badge>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white font-semibold"
                  >
                    Confirm Request
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
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
        {/* Subscription Status */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border border-sky-100 bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Subscription</p>
                  <p className="text-3xl font-extrabold text-foreground capitalize">{business.subscription_tier}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {business.renewal_date && new Date(business.renewal_date) > new Date()
                      ? `Renews ${new Date(business.renewal_date).toLocaleDateString()}`
                      : 'No active subscription'}
                  </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-3">
                  <CreditCard className="h-6 w-6 text-sky-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-violet-100 bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 mr-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Rides Remaining</p>
                  <p className="text-3xl font-extrabold text-foreground">{ridesRemaining}</p>
                  <div className="mt-3">
                    <Progress value={100 - ridesPercentage} className="h-2 rounded-full bg-violet-100 [&>div]:bg-violet-500" />
                    <p className="text-xs text-muted-foreground mt-1.5">{business.rides_used} of {business.rides_total} used</p>
                  </div>
                </div>
                <div className="rounded-2xl bg-violet-50 p-3 flex-shrink-0">
                  <Package className="h-6 w-6 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-emerald-100 bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Wallet Balance</p>
                  <p className="text-3xl font-extrabold text-foreground">{business.wallet_balance} <span className="text-base font-semibold text-muted-foreground">MAD</span></p>
                  <button className="text-xs font-semibold text-sky-600 hover:text-sky-700 mt-2 transition-colors">
                    + Top up wallet
                  </button>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3">
                  <Wallet className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Deliveries */}
        {activeDeliveries.length > 0 && (
          <Card className="border border-sky-200 bg-gradient-to-br from-sky-50 to-cyan-50/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-sky-100 p-2">
                  <Navigation className="h-4 w-4 text-sky-600 animate-pulse" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Active Deliveries</CardTitle>
                  <CardDescription>Track your deliveries in real-time</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="bg-white rounded-2xl border border-sky-100 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs border ${getStatusBadge(delivery.status)}`}>
                        {delivery.status.replace('_', ' ')}
                      </Badge>
                      {delivery.rider_name && (
                        <span className="text-sm font-semibold text-foreground">{delivery.rider_name}</span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">~{delivery.estimated_duration} min</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-1 h-2 w-2 rounded-full bg-slate-400 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                    </div>
                    <div className="ml-[3px] h-4 border-l-2 border-dashed border-slate-200" />
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-sky-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">{delivery.dropoff_address}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl bg-gradient-to-br from-sky-50 to-cyan-50 border border-sky-100 flex items-center justify-center py-6">
                    <div className="text-center space-y-2">
                      <MapPin className="h-8 w-8 text-sky-400 mx-auto" />
                      <p className="text-xs text-sky-500 font-medium">Live tracking map</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Delivery History */}
        <Card className="border border-border bg-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Delivery History</CardTitle>
                <CardDescription>View your past deliveries</CardDescription>
              </div>
              <Badge className="bg-slate-100 text-slate-600 border-slate-200 border font-semibold">
                {completedDeliveries.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {completedDeliveries.length === 0 ? (
              <div className="text-center py-16">
                <div className="rounded-2xl bg-slate-50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-slate-400" />
                </div>
                <p className="font-semibold text-foreground">No completed deliveries yet</p>
                <p className="text-sm text-muted-foreground mt-1">Request your first delivery to get started</p>
                <Button
                  className="mt-4 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-semibold"
                  onClick={() => setShowRequestDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Request Delivery
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {completedDeliveries.slice(0, 10).map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-start justify-between p-4 rounded-xl border border-border bg-background hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-foreground">
                          {new Date(delivery.completed_at!).toLocaleDateString()}
                        </p>
                        {delivery.rider_name && (
                          <p className="text-xs text-muted-foreground">{delivery.rider_name}</p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5 ml-6">
                        <p>{delivery.pickup_address}</p>
                        <p>{delivery.dropoff_address}</p>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        {delivery.price === 0 ? (
                          <span className="text-sky-600">Subscription</span>
                        ) : `${delivery.price} MAD`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.actual_duration || delivery.estimated_duration} min
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
