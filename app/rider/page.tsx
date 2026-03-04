'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService } from '@/lib/storage';
import { ArrowLeft, AlertCircle, DollarSign, TrendingUp, Zap } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AppLanguage } from '@/lib/i18n';
import Link from 'next/link';

type RiderCopy = {
  backHome: string;
  leftTitle: string;
  leftDescription: string;
  bulletItems: [string, string, string];
  tiersTitle: string;
  tierLabels: [string, string, string, string];
  footer: string;
  portalTag: string;
  signIn: string;
  formDescription: string;
  emailLabel: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  signInButton: string;
  demoTitle: string;
  invalidCredentials: string;
  accessDenied: string;
};

const RIDER_COPY: Record<AppLanguage, RiderCopy> = {
  en: {
    backHome: 'Back to Home',
    leftTitle: 'Rider App',
    leftDescription: 'Accept deliveries, grow your earnings, and unlock higher commission tiers with every ride.',
    bulletItems: ['Earn from 14 MAD per delivery', 'Progressive commission tiers', 'Instant delivery notifications'],
    tiersTitle: 'Commission Tiers',
    tierLabels: ['Starter', 'Bronze', 'Silver', 'Gold'],
    footer: 'The 1000 - Tangier, Morocco',
    portalTag: 'Rider App',
    signIn: 'Sign In',
    formDescription: 'Accept deliveries and track your earnings on the go.',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter password',
    signInButton: 'Sign In to App',
    demoTitle: 'Demo Credentials',
    invalidCredentials: 'Invalid email or password',
    accessDenied: 'Access denied. Rider credentials required.',
  },
  fr: {
    backHome: "Retour a l'accueil",
    leftTitle: 'Application Livreur',
    leftDescription: 'Acceptez des livraisons, augmentez vos revenus et debloquez des commissions plus elevees.',
    bulletItems: ['A partir de 14 MAD par livraison', 'Commissions progressives', 'Notifications instantanees'],
    tiersTitle: 'Paliers de commission',
    tierLabels: ['Debutant', 'Bronze', 'Argent', 'Or'],
    footer: 'The 1000 - Tanger, Maroc',
    portalTag: 'Application Livreur',
    signIn: 'Connexion',
    formDescription: 'Acceptez des livraisons et suivez vos revenus partout.',
    emailLabel: 'Adresse email',
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: 'Saisir le mot de passe',
    signInButton: "Se connecter a l'application",
    demoTitle: 'Identifiants de demonstration',
    invalidCredentials: 'Email ou mot de passe invalide',
    accessDenied: 'Acces refuse. Identifiants livreur requis.',
  },
  ar: {
    backHome: 'العودة للرئيسية',
    leftTitle: 'تطبيق السائق',
    leftDescription: 'اقبل الطلبات، زد أرباحك، وافتح مستويات عمولة أعلى مع كل رحلة.',
    bulletItems: ['ابتداءً من 14 درهم لكل توصيل', 'عمولات تصاعدية', 'إشعارات فورية للطلبات'],
    tiersTitle: 'مستويات العمولة',
    tierLabels: ['مبتدئ', 'برونزي', 'فضي', 'ذهبي'],
    footer: 'The 1000 - طنجة، المغرب',
    portalTag: 'تطبيق السائق',
    signIn: 'تسجيل الدخول',
    formDescription: 'اقبل عمليات التوصيل وتابع أرباحك أثناء العمل.',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    signInButton: 'الدخول إلى التطبيق',
    demoTitle: 'بيانات تجريبية',
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    accessDenied: 'تم رفض الوصول. يلزم حساب سائق.',
  },
};

export default function RiderLoginPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const content = RIDER_COPY[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    userService.getCurrentUser().then((currentUser) => {
      if (currentUser?.role === 'rider') {
        router.push('/rider/dashboard');
      }
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const user = await userService.login(email, password);

      if (!user) {
        setError(content.invalidCredentials);
        return;
      }

      if (user.role !== 'rider') {
        setError(content.accessDenied);
        await userService.logout();
        return;
      }

      router.push('/rider/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : content.invalidCredentials);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-slate-900 lg:flex lg:w-1/2">
        <div className="dot-pattern absolute inset-0" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              {content.backHome}
            </Link>
          </div>
          <div>
            <div className="mb-8 w-fit rounded-2xl bg-white/10 p-4 backdrop-blur">
              <BrandLogo withText={false} imageClassName="h-14 w-14 rounded-2xl" />
            </div>
            <h2 className="mb-4 text-4xl font-extrabold">{content.leftTitle}</h2>
            <p className="max-w-sm text-lg leading-relaxed text-white/70">{content.leftDescription}</p>
            <div className="mt-10 space-y-4">
              {[
                { icon: DollarSign, label: content.bulletItems[0] },
                { icon: TrendingUp, label: content.bulletItems[1] },
                { icon: Zap, label: content.bulletItems[2] },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/15 p-2.5 backdrop-blur-sm">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-white/80">{item.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">{content.tiersTitle}</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { tier: '14', label: content.tierLabels[0], range: '0-30' },
                  { tier: '15', label: content.tierLabels[1], range: '31-70' },
                  { tier: '16', label: content.tierLabels[2], range: '71-199' },
                  { tier: '17', label: content.tierLabels[3], range: '200+' },
                ].map((t, i) => (
                  <div key={i} className="text-center">
                    <p className="text-lg font-bold text-white">{t.tier}</p>
                    <p className="text-xs text-white/50">MAD</p>
                    <p className="mt-1 text-xs text-white/40">{t.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-white/40">{content.footer}</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {content.backHome}
            </Link>
            <LanguageSwitcher inline />
          </div>

          <div className="mb-2 hidden justify-end lg:flex">
            <LanguageSwitcher inline />
          </div>

          <div className="mb-8">
            <div className="mb-6 flex items-center gap-3">
              <BrandLogo withText={false} imageClassName="h-14 w-14 rounded-2xl shadow-sm" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">{content.portalTag}</p>
                <h1 className="text-2xl font-extrabold text-foreground">{content.signIn}</h1>
              </div>
            </div>
            <p className="text-muted-foreground">{content.formDescription}</p>
          </div>

          <div className="rounded-2xl border border-border border-t-4 border-t-emerald-500 bg-white p-8 shadow-sm">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">
                  {content.emailLabel}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="rider@the1000.ma"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border-border/80 bg-emerald-50/30 focus-visible:ring-emerald-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  {content.passwordLabel}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={content.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl border-border/80 bg-emerald-50/30 focus-visible:ring-emerald-500"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-md shadow-emerald-200 transition-all hover:bg-emerald-700"
              >
                {content.signInButton}
              </Button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
