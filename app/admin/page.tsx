'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService } from '@/lib/storage';
import { BarChart3, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@the1000.ma');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  useEffect(() => {
    const currentUser = userService.getCurrentUser();
    if (currentUser?.role === 'admin') {
      router.push('/admin/dashboard');
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const user = userService.login(email, password);

    if (!user) {
      setError('Invalid email or password');
      return;
    }

    if (user.role !== 'admin') {
      setError('Access denied. Admin credentials required.');
      userService.logout();
      return;
    }

    router.push('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
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
              <BarChart3 className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-4xl font-extrabold mb-4">Admin Control Center</h2>
            <p className="text-white/70 text-lg leading-relaxed max-w-sm">
              Monitor deliveries, manage riders & businesses, and track platform performance in real-time.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4">
              {[
                { label: 'Active Riders', value: '2+' },
                { label: 'Businesses', value: '2+' },
                { label: 'Deliveries', value: 'Live' },
                { label: 'Revenue', value: 'MAD' },
              ].map((stat, i) => (
                <div key={i} className="rounded-xl bg-white/10 p-4">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-white/60 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-white/40 text-sm">The 1000 — Tangier, Morocco</p>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile back link */}
          <Link href="/" className="lg:hidden inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-2xl bg-violet-100 p-3">
                <BarChart3 className="h-7 w-7 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-500">Admin Portal</p>
                <h1 className="text-2xl font-extrabold text-foreground">Sign In</h1>
              </div>
            </div>
            <p className="text-muted-foreground">Access the platform management console.</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@the1000.ma"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-border/80 focus-visible:ring-violet-500"
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
                  className="h-11 rounded-xl border-border/80 focus-visible:ring-violet-500"
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
                className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold shadow-md shadow-violet-200 transition-all"
              >
                Sign In to Dashboard
              </Button>
            </form>
          </div>

          <div className="mt-6 rounded-xl bg-violet-50 border border-violet-100 p-4 text-sm">
            <p className="font-semibold text-violet-700 mb-1">Demo Credentials</p>
            <p className="text-violet-600/80">admin@the1000.ma / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
