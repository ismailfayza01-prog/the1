'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService } from '@/lib/storage';
import { MapPin, ArrowLeft, AlertCircle, Package, TrendingUp, Clock } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import Link from 'next/link';

export default function BusinessLoginPage() {
  const router = useRouter();
  const isDev = process.env.NODE_ENV !== 'production';
  const [email, setEmail] = useState(isDev ? 'pharmacie@example.ma' : '');
  const [password, setPassword] = useState(isDev ? 'Business1234!' : '');
  const [error, setError] = useState('');

  useEffect(() => {
    userService.getCurrentUser().then(currentUser => {
      if (currentUser?.role === 'business') {
        router.push('/business/dashboard');
      }
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = await userService.login(email, password);

    if (!user) {
      setError('Invalid email or password');
      return;
    }

    if (user.role !== 'business') {
      setError('Access denied. Business credentials required.');
      await userService.logout();
      return;
    }

    router.push('/business/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-slate-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 right-20 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 left-20 h-48 w-48 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
          <div>
            <div className="mb-8 rounded-2xl bg-white/10 backdrop-blur p-4 w-fit">
              <BrandLogo withText={false} imageClassName="h-14 w-14 rounded-2xl" />
            </div>
            <h2 className="text-4xl font-extrabold mb-4">Business Portal</h2>
            <p className="text-white/70 text-lg leading-relaxed max-w-sm">
              Request deliveries instantly, track your riders live, and manage your subscription seamlessly.
            </p>
            <div className="mt-10 space-y-4">
              {[
                { icon: Package, label: 'Request deliveries in seconds' },
                { icon: TrendingUp, label: 'Flexible subscription plans' },
                { icon: Clock, label: 'Real-time delivery tracking' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="rounded-xl bg-white/15 p-2.5">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-white/80 text-sm font-medium">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-white/40 text-sm">The 1000 — Tangier, Morocco</p>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <BrandLogo withText={false} imageClassName="h-14 w-14 rounded-2xl shadow-sm" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Business Portal</p>
                <h1 className="text-2xl font-extrabold text-foreground">Sign In</h1>
              </div>
            </div>
            <p className="text-muted-foreground">Request deliveries and track your riders in real-time.</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="business@example.ma"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-border/80 focus-visible:ring-emerald-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-border/80 focus-visible:ring-emerald-500"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-slate-800 hover:from-emerald-600 hover:to-slate-900 text-white font-semibold shadow-md shadow-emerald-200 transition-all"
              >
                Sign In to Portal
              </Button>
            </form>
          </div>

          {isDev && (
            <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm">
              <p className="font-semibold text-emerald-700 mb-1">Demo Credentials</p>
              <p className="text-emerald-700/80">pharmacie@example.ma / Business1234!</p>
              <p className="text-emerald-600/70 text-xs mt-1">or cafe@example.ma / Business1234!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
