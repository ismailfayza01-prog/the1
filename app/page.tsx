'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MapPin, Users, BarChart3, ArrowRight, Zap, Shield, TrendingUp, Globe } from 'lucide-react';
import { initializeDefaultData } from '@/lib/storage';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    initializeDefaultData();
  }, []);

  const apps = [
    {
      title: 'Admin Dashboard',
      description: 'Manage riders, businesses, and monitor all deliveries in real-time across the platform.',
      icon: BarChart3,
      href: '/admin',
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      badge: 'Platform Control',
    },
    {
      title: 'Business Portal',
      description: 'Request deliveries, track riders, and manage your subscription with ease.',
      icon: MapPin,
      href: '/business',
      gradient: 'from-sky-500 to-cyan-500',
      bg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      badge: 'For Businesses',
    },
    {
      title: 'Rider App',
      description: 'Accept deliveries, track earnings, and grow your income with every ride.',
      icon: Users,
      href: '/rider',
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      badge: 'For Riders',
    },
  ];

  const features = [
    { icon: Globe, title: 'Real-Time GPS Tracking', desc: 'See available riders live on the map', color: 'text-violet-500', bg: 'bg-violet-50' },
    { icon: Shield, title: 'Subscription Plans', desc: 'Monthly & annual flexible pricing tiers', color: 'text-sky-500', bg: 'bg-sky-50' },
    { icon: TrendingUp, title: 'Progressive Earnings', desc: 'Riders earn more with every delivery', color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { icon: Zap, title: 'Live Tracking', desc: 'Follow every delivery from pickup to drop', color: 'text-amber-500', bg: 'bg-amber-50' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-violet-400/20 to-purple-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-sky-400/20 to-cyan-600/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-28 sm:py-36 lg:px-8">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              B2B Courier Platform — Tangier, Morocco
            </div>

            <h1 className="text-6xl font-extrabold tracking-tight text-foreground sm:text-8xl">
              The{' '}
              <span className="gradient-text">1000</span>
            </h1>
            <p className="mt-6 text-xl leading-8 text-muted-foreground max-w-2xl mx-auto font-medium">
              See your rider. Track your delivery. Grow your business.
            </p>

            <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
              <Button
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg shadow-violet-200 px-8 h-12 text-base font-semibold"
                onClick={() => router.push('/admin')}
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base font-semibold border-2"
                onClick={() => {
                  document.getElementById('portals')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View Portals
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Strip */}
      <div className="border-y border-border bg-white/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className={`flex-shrink-0 rounded-xl ${f.bg} p-2.5`}>
                    <Icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Portal Selection */}
      <div id="portals" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Portals</p>
          <h2 className="text-4xl font-bold text-foreground">Select Your Portal</h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Choose the application that matches your role in The 1000 platform.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.href}
                className="group relative rounded-2xl border border-border bg-white p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
                onClick={() => router.push(app.href)}
              >
                {/* Top gradient accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${app.gradient}`} />

                {/* Badge */}
                <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${app.bg} ${app.iconColor} mb-5`}>
                  {app.badge}
                </span>

                <div className={`rounded-2xl ${app.bg} p-4 w-fit mb-5`}>
                  <Icon className={`h-8 w-8 ${app.iconColor}`} />
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2">{app.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{app.description}</p>

                <Button
                  className={`w-full bg-gradient-to-r ${app.gradient} text-white border-0 hover:opacity-90 transition-opacity font-semibold`}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(app.href);
                  }}
                >
                  Access Portal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Demo Credentials */}
        <div className="mt-16 rounded-2xl border border-border bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl bg-amber-50 p-2.5">
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Demo Credentials</h3>
              <p className="text-sm text-muted-foreground">Use these to explore all three portals</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-500 mb-2">Admin</p>
              <p className="text-sm text-foreground font-medium">admin@the1000.ma</p>
              <p className="text-sm text-muted-foreground">admin123</p>
            </div>
            <div className="rounded-xl bg-sky-50 border border-sky-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-500 mb-2">Business</p>
              <p className="text-sm text-foreground font-medium">pharmacie@example.ma</p>
              <p className="text-sm text-muted-foreground">business123</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2">Rider</p>
              <p className="text-sm text-foreground font-medium">rider1@the1000.ma</p>
              <p className="text-sm text-muted-foreground">rider123</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">
          © 2024 <span className="font-semibold text-foreground">The 1000</span> — B2B Courier Marketplace, Tangier, Morocco
        </p>
      </div>
    </div>
  );
}
