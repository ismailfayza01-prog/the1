'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService } from '@/lib/storage';
import { Users, ArrowLeft, AlertCircle, DollarSign, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';

export default function RiderLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('rider1@the1000.ma');
  const [password, setPassword] = useState('Rider1234!');
  const [error, setError] = useState('');

  useEffect(() => {
    userService.getCurrentUser().then(currentUser => {
      if (currentUser?.role === 'rider') {
        router.push('/rider/dashboard');
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

    if (user.role !== 'rider') {
      setError('Access denied. Rider credentials required.');
      await userService.logout();
      return;
    }

    router.push('/rider/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 h-48 w-48 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
          <div>
            <div className="rounded-2xl bg-white/10 backdrop-blur p-5 w-fit mb-8">
              <Users className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-4xl font-extrabold mb-4">Rider App</h2>
            <p className="text-white/70 text-lg leading-relaxed max-w-sm">
              Accept deliveries, grow your earnings, and unlock higher commission tiers with every ride.
            </p>
            <div className="mt-10 space-y-4">
              {[
                { icon: DollarSign, label: 'Earn from 14 MAD per delivery' },
                { icon: TrendingUp, label: 'Progressive commission tiers' },
                { icon: Zap, label: 'Instant delivery notifications' },
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

            {/* Tier preview */}
            <div className="mt-8 rounded-2xl bg-white/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">Commission Tiers</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { tier: '14', label: 'Starter', range: '0-30' },
                  { tier: '15', label: 'Bronze', range: '31-70' },
                  { tier: '16', label: 'Silver', range: '71-199' },
                  { tier: '17', label: 'Gold', range: '200+' },
                ].map((t, i) => (
                  <div key={i} className="text-center">
                    <p className="text-lg font-bold text-white">{t.tier}</p>
                    <p className="text-xs text-white/50">MAD</p>
                    <p className="text-xs text-white/40 mt-1">{t.label}</p>
                  </div>
                ))}
              </div>
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
              <div className="rounded-2xl bg-emerald-100 p-3">
                <Users className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Rider App</p>
                <h1 className="text-2xl font-extrabold text-foreground">Sign In</h1>
              </div>
            </div>
            <p className="text-muted-foreground">Accept deliveries and track your earnings on the go.</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="rider@the1000.ma"
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
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold shadow-md shadow-emerald-200 transition-all"
              >
                Sign In to App
              </Button>
            </form>
          </div>

          <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm">
            <p className="font-semibold text-emerald-700 mb-1">Demo Credentials</p>
            <p className="text-emerald-600/80">rider1@the1000.ma / Rider1234!</p>
            <p className="text-emerald-500/60 text-xs mt-1">or rider2@the1000.ma / Rider1234!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
