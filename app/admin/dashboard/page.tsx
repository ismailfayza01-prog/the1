'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { userService, riderService, businessService, deliveryService } from '@/lib/storage';
import {
  MapPin,
  Users,
  Package,
  DollarSign,
  LogOut,
  TrendingUp,
  CheckCircle2,
  Home,
  BarChart3,
} from 'lucide-react';
import type { Rider, Business, Delivery } from '@/lib/types';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(userService.getCurrentUser());
  const [riders, setRiders] = useState<Rider[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  useEffect(() => {
    const user = userService.getCurrentUser();
    if (!user || user.role !== 'admin') {
      router.push('/admin');
      return;
    }
    setCurrentUser(user);
    loadData();

    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [router]);

  const loadData = () => {
    setRiders(riderService.getAll());
    setBusinesses(businessService.getAll());
    setDeliveries(deliveryService.getAll());
  };

  const handleLogout = () => {
    userService.logout();
    router.push('/admin');
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
    const tierRevenue = b.subscription_tier === 'monthly' ? 200 : b.subscription_tier === 'annual' ? 1800 : 0;
    return sum + tierRevenue + b.wallet_balance;
  }, 0);

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
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-foreground">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
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

        {/* Live Map Placeholder */}
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
            <div className="relative aspect-video w-full rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 overflow-hidden">
              {/* Fake map grid */}
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: 'linear-gradient(hsl(243 75% 80%) 1px, transparent 1px), linear-gradient(90deg, hsl(243 75% 80%) 1px, transparent 1px)',
                backgroundSize: '40px 40px'
              }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="flex gap-2 justify-center mb-4">
                    {riders.map((rider, i) => (
                      <div
                        key={rider.id}
                        className={`h-4 w-4 rounded-full border-2 border-white shadow-md ${
                          rider.status === 'available' ? 'bg-emerald-500' :
                          rider.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'
                        } animate-pulse`}
                        style={{ animationDelay: `${i * 300}ms` }}
                      />
                    ))}
                  </div>
                  <div className="rounded-2xl bg-white/80 backdrop-blur px-6 py-4 shadow-sm">
                    <MapPin className="h-8 w-8 text-violet-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-foreground">Map Integration Ready</p>
                    <p className="text-xs text-muted-foreground mt-1">Add Google Maps API key to see live locations</p>
                  </div>
                </div>
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
                <CardDescription>Manage business accounts and subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {businesses.map((business) => (
                    <div
                      key={business.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-border bg-background hover:bg-sky-50/50 hover:border-sky-100 transition-all"
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
                <CardDescription>Monitor all deliveries and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {deliveries.slice(0, 10).map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-start justify-between p-4 rounded-xl border border-border bg-background hover:bg-emerald-50/50 hover:border-emerald-100 transition-all"
                    >
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
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-sm font-bold text-foreground">{delivery.price} MAD</p>
                        <p className="text-xs text-muted-foreground">~{delivery.estimated_duration} min</p>
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
