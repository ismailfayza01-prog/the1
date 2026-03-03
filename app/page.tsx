'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MapPin, Users, BarChart3, ArrowRight, Zap, Shield, TrendingUp, Globe, Eye, EyeOff, Copy, Check, ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'What is The 1000?',
    answer:
      'The 1000 is a B2B courier marketplace platform based in Tangier, Morocco. It connects businesses that need same-day and express deliveries with a network of professional riders, offering real-time GPS tracking, subscription-based pricing, and a centralized dashboard for managing every delivery.',
  },
  {
    question: 'How does The 1000 work for businesses in Tangier?',
    answer:
      'Businesses subscribe to The 1000 and request deliveries through a dedicated business portal. The platform instantly matches each request to an available rider in Tangier. Businesses track their rider live on a map from pickup to drop-off and receive full delivery history through their dashboard.',
  },
  {
    question: 'What areas does The 1000 currently serve?',
    answer:
      'The 1000 currently operates in Tangier, Morocco, providing same-day and express B2B courier services across the city. Coverage expansion to other cities in the Tanger-Tétouan-Al Hoceïma region is planned.',
  },
  {
    question: 'What types of deliveries does The 1000 handle?',
    answer:
      'The 1000 specializes in B2B deliveries including documents, parcels, and inter-business shipments within Tangier. The platform is designed for businesses — such as pharmacies, retailers, suppliers, and service firms — that require reliable, trackable same-day delivery.',
  },
  {
    question: 'How are subscription plans structured?',
    answer:
      'The 1000 offers monthly and annual subscription tiers for B2B clients. Each plan determines delivery volume, per-delivery pricing, and access to platform features. Plans are designed to scale with business needs, from small shops to high-volume operations.',
  },
  {
    question: 'Does The 1000 offer real-time delivery tracking?',
    answer:
      'Yes. Every delivery on The 1000 includes live GPS tracking. Businesses see their assigned rider moving on an interactive map in real time, from the moment a delivery is accepted until it is marked as delivered.',
  },
  {
    question: 'How do riders join The 1000?',
    answer:
      'Riders sign up through the dedicated Rider Portal on The 1000 platform. Once onboarded, they set their availability, accept nearby delivery requests, and track their earnings in real time. The platform uses a progressive commission model that rewards higher delivery volume.',
  },
  {
    question: 'How is delivery pricing calculated?',
    answer:
      'Delivery pricing on The 1000 is primarily subscription-based. Businesses pay a monthly or annual fee that includes a set delivery volume, with additional deliveries billed at a per-delivery rate determined by their plan tier.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

export default function HomePage() {
  const router = useRouter();
  const isDev = process.env.NODE_ENV !== 'production';
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const apps = [
    {
      title: 'Admin Dashboard',
      description: 'Manage riders, businesses, and monitor all deliveries in real-time across the platform.',
      icon: BarChart3,
      href: '/admin',
      gradient: 'from-slate-900 to-emerald-600',
      bg: 'bg-slate-100',
      iconColor: 'text-slate-800',
      badge: 'Platform Control',
    },
    {
      title: 'Business Portal',
      description: 'Request deliveries, track riders, and manage your subscription with ease.',
      icon: MapPin,
      href: '/business',
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-700',
      badge: 'For Businesses',
    },
    {
      title: 'Rider App',
      description: 'Accept deliveries, track earnings, and grow your income with every ride.',
      icon: Users,
      href: '/rider',
      gradient: 'from-lime-500 to-emerald-600',
      bg: 'bg-lime-50',
      iconColor: 'text-lime-700',
      badge: 'For Riders',
    },
  ];

  const features = [
    { icon: Globe, title: 'Real-Time GPS Tracking', desc: 'See available riders live on the map', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: Shield, title: 'Subscription Plans', desc: 'Monthly & annual flexible pricing tiers', color: 'text-slate-700', bg: 'bg-slate-100' },
    { icon: TrendingUp, title: 'Progressive Earnings', desc: 'Riders earn more with every delivery', color: 'text-teal-600', bg: 'bg-teal-50' },
    { icon: Zap, title: 'Live Tracking', desc: 'Follow every delivery from pickup to drop', color: 'text-amber-500', bg: 'bg-amber-50' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-slate-400/15 to-slate-900/20 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-28 sm:py-36 lg:px-8">
          <div className="text-center">
            <div className="mb-10 flex justify-center">
              <img
                src="/brand-logo.svg"
                alt="THE 1000 logo"
                className="h-[340px] w-[340px] sm:h-[460px] sm:w-[460px] lg:h-[620px] lg:w-[620px]"
              />
            </div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              B2B Courier Platform — Tangier, Morocco
            </div>

            <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
              <Button
                size="lg"
                className="bg-gradient-to-r from-emerald-500 to-slate-800 hover:from-emerald-600 hover:to-slate-900 text-white shadow-lg shadow-emerald-200 px-8 h-12 text-base font-semibold"
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

      {/* Brand Definition — AI-extractable description block */}
      <section aria-label="About The 1000" className="mx-auto max-w-4xl px-6 py-14 lg:px-8 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Tangier&apos;s B2B Courier Marketplace
        </h2>
        <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl mx-auto">
          <strong>The 1000</strong> is a B2B courier marketplace platform based in{' '}
          <strong>Tangier, Morocco</strong>. It connects businesses that need same-day and express
          deliveries with a network of professional riders — offering real-time GPS tracking,
          subscription-based pricing, and a centralized dashboard for managing every delivery from
          request to drop-off.
        </p>
      </section>

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
        {isDev && (
          <div className="mt-16 rounded-2xl border border-border bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-50 p-2.5">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Demo Credentials</h3>
                  <p className="text-sm text-muted-foreground">Use these to explore all three portals</p>
                </div>
              </div>
              <button
                onClick={() => setShowCredentials(!showCredentials)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold text-sm"
              >
                {showCredentials ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Show
                  </>
                )}
              </button>
            </div>

            {showCredentials ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { label: 'Admin', email: 'admin@the1000.ma', password: 'Admin1234!', color: 'slate' },
                  { label: 'Business', email: 'pharmacie@example.ma', password: 'Business1234!', color: 'teal' },
                  { label: 'Rider', email: 'rider1@the1000.ma', password: 'Rider1234!', color: 'emerald' },
                ].map((cred, idx) => (
                  <div key={idx} className={`rounded-xl bg-${cred.color}-50 border border-${cred.color}-100 p-4`}>
                    <p className={`text-xs font-bold uppercase tracking-wider text-${cred.color}-500 mb-3`}>{cred.label}</p>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Email</p>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs font-mono text-foreground bg-white rounded px-2 py-1 flex-1">{cred.email}</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(cred.email);
                              setCopiedIndex(idx * 2);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            className="p-1 hover:bg-white/50 rounded transition-colors"
                            title="Copy email"
                          >
                            {copiedIndex === idx * 2 ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Password</p>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs font-mono text-foreground bg-white rounded px-2 py-1 flex-1">{cred.password}</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(cred.password);
                              setCopiedIndex(idx * 2 + 1);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            className="p-1 hover:bg-white/50 rounded transition-colors"
                            title="Copy password"
                          >
                            {copiedIndex === idx * 2 + 1 ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-6 text-center">
                <p className="text-sm text-amber-900 mb-3">Demo credentials are hidden</p>
                <p className="text-xs text-amber-700 mb-4">Click "Show" above to reveal test accounts for each portal</p>
                <p className="text-xs text-amber-600">Note: These accounts will be reset regularly for security</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <section aria-label="Frequently Asked Questions" className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">FAQ</p>
          <h2 className="text-3xl font-bold text-foreground">Frequently Asked Questions</h2>
          <p className="mt-3 text-muted-foreground">
            Everything you need to know about The 1000 courier platform.
          </p>
        </div>

        <dl className="divide-y divide-border rounded-2xl border border-border bg-white overflow-hidden shadow-sm">
          {faqs.map((faq, i) => (
            <div key={i}>
              <dt>
                <button
                  className="flex w-full items-center justify-between px-6 py-5 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span className="font-semibold text-foreground pr-4">{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </dt>
              {openFaq === i && (
                <dd className="px-6 pb-5 text-muted-foreground leading-relaxed">
                  {faq.answer}
                </dd>
              )}
            </div>
          ))}
        </dl>
      </section>

      {/* Footer */}
      <div className="border-t border-border py-8 text-center">
        <p className="text-sm text-muted-foreground">
          © 2024 <span className="font-semibold text-foreground">The 1000</span> — B2B Courier Marketplace, Tangier, Morocco
        </p>
      </div>
    </div>
  );
}
