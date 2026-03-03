'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { userService } from '@/lib/storage';
import type { User } from '@/lib/types';
import { UserCreateForm } from './components/UserCreateForm';
import { UserTable } from './components/UserTable';

export default function AdminUsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function init() {
      const user = await userService.getCurrentUser();
      if (!user || user.role !== 'admin') {
        router.push('/admin');
        return;
      }
      setCurrentUser(user);
    }
    void init();
  }, [router]);

  async function handleLogout() {
    await userService.logout();
    router.push('/admin');
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-violet-50">
                <Home className="h-5 w-5 text-violet-600" />
              </Button>
            </Link>
            <Link href="/admin/dashboard">
              <Button variant="ghost" className="rounded-xl">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              <div className="rounded-xl bg-violet-100 p-1.5">
                <Users className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground leading-tight">User Management</h1>
                <p className="text-xs text-muted-foreground leading-tight">Admin-only account provisioning</p>
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

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <UserCreateForm onCreated={() => setRefreshKey((prev) => prev + 1)} />
        <UserTable refreshKey={refreshKey} />
      </main>
    </div>
  );
}
