'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { userService } from '@/lib/storage';
import { ArrowLeft, AlertCircle, Package, TrendingUp, Clock } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AppLanguage } from '@/lib/i18n';
import Link from 'next/link';

type BusinessCopy = {
  backHome: string;
  leftTitle: string;
  leftDescription: string;
  bulletItems: [string, string, string];
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

const BUSINESS_COPY: Record<AppLanguage, BusinessCopy> = {
  en: {
    backHome: 'Back to Home',
    leftTitle: 'Business Portal',
    leftDescription: 'Request deliveries instantly, track your riders live, and manage operations seamlessly.',
    bulletItems: ['Request deliveries in seconds', 'Subscription managed by admin', 'Real-time delivery tracking'],
    footer: 'The 1000 - Tangier, Morocco',
    portalTag: 'Business Portal',
    signIn: 'Sign In',
    formDescription: 'Request deliveries and track your riders in real time.',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter password',
    signInButton: 'Sign In to Portal',
    demoTitle: 'Demo Credentials',
    invalidCredentials: 'Invalid email or password',
    accessDenied: 'Access denied. Business credentials required.',
  },
  fr: {
    backHome: "Retour a l'accueil",
    leftTitle: 'Portail Entreprise',
    leftDescription: 'Demandez des livraisons instantanement, suivez vos livreurs en direct et gerez vos operations facilement.',
    bulletItems: ['Demande de livraison en quelques secondes', "Abonnement gere par l'admin", 'Suivi des livraisons en temps reel'],
    footer: 'The 1000 - Tanger, Maroc',
    portalTag: 'Portail Entreprise',
    signIn: 'Connexion',
    formDescription: 'Demandez des livraisons et suivez vos livreurs en temps reel.',
    emailLabel: 'Adresse email',
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: 'Saisir le mot de passe',
    signInButton: 'Se connecter au portail',
    demoTitle: 'Identifiants de demonstration',
    invalidCredentials: 'Email ou mot de passe invalide',
    accessDenied: 'Acces refuse. Identifiants entreprise requis.',
  },
  ar: {
    backHome: 'العودة للرئيسية',
    leftTitle: 'بوابة الشركات',
    leftDescription: 'اطلب التوصيل فورًا، تتبع السائقين مباشرة، وأدر اشتراكك بسهولة.',
    bulletItems: ['طلب التوصيل خلال ثوانٍ', 'خطط اشتراك مرنة', 'تتبع التوصيل في الوقت الحقيقي'],
    footer: 'The 1000 - طنجة، المغرب',
    portalTag: 'بوابة الشركات',
    signIn: 'تسجيل الدخول',
    formDescription: 'اطلب عمليات التوصيل وتابع السائقين مباشرة.',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    signInButton: 'الدخول إلى البوابة',
    demoTitle: 'بيانات تجريبية',
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    accessDenied: 'تم رفض الوصول. يلزم حساب شركة.',
  },
};

export default function BusinessLoginPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const content = BUSINESS_COPY[language];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    userService.getCurrentUser().then((currentUser) => {
      if (currentUser?.role === 'business') {
        router.push('/business/dashboard');
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

      if (user.role !== 'business') {
        setError(content.accessDenied);
        await userService.logout();
        return;
      }

      router.push('/business/dashboard');
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
                { icon: Package, label: content.bulletItems[0] },
                { icon: TrendingUp, label: content.bulletItems[1] },
                { icon: Clock, label: content.bulletItems[2] },
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
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">{content.portalTag}</p>
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
                  placeholder="business@example.ma"
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
