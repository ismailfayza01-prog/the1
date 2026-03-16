'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AppLanguage } from '@/lib/i18n';
import {
  MapPin,
  Users,
  BarChart3,
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  Globe,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';

type FaqItem = {
  question: string;
  answer: string;
};

type PricingRateItem = {
  label: string;
  value: string;
  note: string;
};

type PricingPackItem = {
  name: string;
  details: string;
  price: string;
};

type PricingContent = {
  label: string;
  title: string;
  subtitle: string;
  ratesTitle: string;
  rates: PricingRateItem[];
  packsTitle: string;
  packs: PricingPackItem[];
  walletTierNote: string;
};

type HomeCopy = {
  heroBadge: string;
  getStarted: string;
  viewPortals: string;
  features: Array<{ title: string; desc: string }>;
  aboutLabel: string;
  aboutTitle: string;
  aboutBody: string;
  portalsLabel: string;
  portalsTitle: string;
  portalsDescription: string;
  apps: Array<{ title: string; description: string; badge: string }>;
  accessPortal: string;
  demoTitle: string;
  demoSubtitle: string;
  show: string;
  hide: string;
  emailLabel: string;
  passwordLabel: string;
  copyEmail: string;
  copyPassword: string;
  hiddenCredentialsTitle: string;
  hiddenCredentialsSubtitle: string;
  hiddenCredentialsNote: string;
  faqLabel: string;
  faqTitle: string;
  faqSubtitle: string;
  faqAriaLabel: string;
  footer: string;
  faqs: FaqItem[];
  navFeatures: string;
  navHowItWorks: string;
  navPricing: string;
  navPortals: string;
  navFaq: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroValueProps: Array<{ label: string }>;
  trustTitle: string;
  trustPillars: Array<{ label: string }>;
  howItWorksTitle: string;
  howItWorksSteps: Array<{ title: string; desc: string }>;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButton: string;
  footerPlatform: string;
  footerCompany: string;
  footerConnect: string;
  footerAbout: string;
  footerContact: string;
  footerLocation: string;
};

const HOME_COPY: Record<AppLanguage, HomeCopy> = {
  en: {
    heroBadge: 'B2B Courier Platform — Tangier, Morocco',
    getStarted: 'Request a Demo',
    viewPortals: 'See How It Works',
    features: [
      { title: 'Know where your rider is. Always.', desc: 'Open your dashboard, see every active rider on the map. No more calling to ask "where are you?" — just check the live view.' },
      { title: 'Pay only for what you use', desc: 'Start at 30 MAD per delivery with no commitment. As your volume grows, unlock rates down to 18 MAD with Wallet+.' },
      { title: 'Riders earn more, you get better service', desc: 'Our progressive commission rewards riders who deliver more — so you always get motivated, experienced professionals.' },
      { title: 'From request to proof of delivery', desc: 'Create a delivery, watch it move through pickup, transit, and drop-off. Get OTP or photo confirmation when it arrives.' },
    ],
    aboutLabel: 'Why The 1000',
    aboutTitle: 'Your deliveries, under control',
    aboutBody:
      'The 1000 is a courier platform built for Tangier businesses. Request a delivery, get matched with a professional rider, and track every step on a live map — from pickup to proof of delivery. No subscriptions required, no minimum volume.',
    portalsLabel: 'Portals',
    portalsTitle: 'Choose Your Portal',
    portalsDescription: 'Each portal is designed for a specific role on the platform.',
    apps: [
      {
        title: 'Admin Dashboard',
        description: 'Monitor every rider and delivery across Tangier, manage businesses, and handle escalations.',
        badge: 'Platform Control',
      },
      {
        title: 'Business Portal',
        description: 'Create deliveries, track riders in real time, and see your complete delivery history — all from one screen.',
        badge: 'For Businesses',
      },
      {
        title: 'Rider App',
        description: 'See incoming delivery offers, navigate to pickups, and track your earnings as they grow.',
        badge: 'For Riders',
      },
    ],
    accessPortal: 'Access Portal',
    demoTitle: 'Demo Credentials',
    demoSubtitle: 'Use these to explore all three portals',
    show: 'Show',
    hide: 'Hide',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    copyEmail: 'Copy email',
    copyPassword: 'Copy password',
    hiddenCredentialsTitle: 'Demo credentials are hidden',
    hiddenCredentialsSubtitle: 'Click "Show" above to reveal test accounts for each portal',
    hiddenCredentialsNote: 'Note: These accounts are reset regularly for security.',
    faqLabel: 'FAQ',
    faqTitle: 'Frequently Asked Questions',
    faqSubtitle: 'Common questions about using The 1000 for your deliveries.',
    faqAriaLabel: 'Frequently Asked Questions',
    footer: 'B2B Courier Platform, Tangier, Morocco',
    faqs: [
      {
        question: 'What is The 1000?',
        answer:
          'A courier platform for Tangier businesses. You request a delivery, we match you with a professional rider, and you track everything live on a map until it arrives.',
      },
      {
        question: 'How does it work?',
        answer:
          'Open the business portal, set your pickup and drop-off, and submit. A nearby rider accepts within minutes. You watch the whole thing happen on the map.',
      },
      {
        question: 'What areas do you cover?',
        answer:
          'We currently operate across Tangier. Expansion to the Tanger-Tetouan-Al Hoceima region is planned.',
      },
      {
        question: 'What can I send?',
        answer:
          'Documents, parcels, and inter-business shipments. We work with pharmacies, retailers, suppliers, and service companies that need same-day delivery within Tangier.',
      },
      {
        question: 'How much does it cost?',
        answer:
          '30 MAD per delivery with pay-as-you-go. Buy a credit pack at 25 MAD per delivery, or use Wallet+ to unlock rates as low as 18 MAD. No subscriptions, no hidden fees.',
      },
      {
        question: 'Can I track my delivery in real time?',
        answer:
          'Yes. Every delivery includes live GPS tracking. You see your rider moving on the map from the moment they accept until they deliver.',
      },
      {
        question: 'How do riders join?',
        answer:
          'Riders sign up through the Rider Portal, set their availability, and start accepting nearby deliveries. They earn a progressive commission that increases with volume.',
      },
    ],
    navFeatures: 'Features',
    navHowItWorks: 'How It Works',
    navPricing: 'Pricing',
    navPortals: 'Portals',
    navFaq: 'FAQ',
    heroHeadline: 'Stop Chasing Riders. Start Tracking Deliveries.',
    heroSubheadline: 'The 1000 gives Tangier businesses a single dashboard to request, assign, and track same-day deliveries with professional riders — no more WhatsApp juggling.',
    heroValueProps: [
      { label: 'Same-Day Delivery' },
      { label: 'Live GPS Tracking' },
      { label: 'Proof of Delivery' },
    ],
    trustTitle: 'Trusted by pharmacies, retailers, and suppliers across Tangier',
    trustPillars: [
      { label: 'Same-Day Delivery' },
      { label: 'Live GPS Tracking' },
      { label: 'Professional Riders' },
      { label: 'Proof of Delivery' },
    ],
    howItWorksTitle: 'How It Works',
    howItWorksSteps: [
      { title: 'Drop a pin, describe your package', desc: 'Open the business portal, set your pickup and drop-off locations, and add delivery details. Takes about 30 seconds.' },
      { title: 'We find the nearest rider', desc: 'The platform instantly offers the job to available riders nearby. Someone accepts within minutes.' },
      { title: 'Watch it happen live', desc: 'Track your rider on the map from pickup to delivery. You get a confirmation the moment it arrives.' },
    ],
    ctaTitle: 'Your first delivery is 30 minutes away',
    ctaSubtitle: 'Create your business account, request a delivery, and watch it happen live on the map.',
    ctaButton: 'Create Your Account',
    footerPlatform: 'Platform',
    footerCompany: 'Company',
    footerConnect: 'Connect',
    footerAbout: 'About',
    footerContact: 'Contact',
    footerLocation: 'Tangier, Morocco',
  },
  fr: {
    heroBadge: 'Plateforme de livraison B2B — Tanger, Maroc',
    getStarted: 'Demander une demo',
    viewPortals: 'Voir comment ca marche',
    features: [
      { title: 'Sachez ou est votre livreur. Toujours.', desc: 'Ouvrez votre tableau de bord, voyez chaque livreur actif sur la carte. Plus besoin d appeler pour demander "ou es-tu ?" — consultez la vue en direct.' },
      { title: 'Payez uniquement ce que vous utilisez', desc: 'Commencez a 30 MAD par livraison sans engagement. En augmentant votre volume, debloquez des tarifs jusqu a 18 MAD avec Wallet+.' },
      { title: 'Les livreurs gagnent plus, vous avez un meilleur service', desc: 'Notre commission progressive recompense les livreurs les plus actifs — vous beneficiez toujours de professionnels motives et experimentes.' },
      { title: 'De la demande a la preuve de livraison', desc: 'Creez une livraison, suivez-la du retrait au transit jusqu a la remise. Recevez une confirmation OTP ou photo a l arrivee.' },
    ],
    aboutLabel: 'Pourquoi The 1000',
    aboutTitle: 'Vos livraisons, sous controle',
    aboutBody:
      'The 1000 est une plateforme de livraison concue pour les entreprises de Tanger. Demandez une livraison, soyez mis en relation avec un livreur professionnel, et suivez chaque etape sur une carte en direct — du retrait a la preuve de livraison. Sans abonnement, sans volume minimum.',
    portalsLabel: 'Portails',
    portalsTitle: 'Choisissez votre portail',
    portalsDescription: 'Chaque portail est concu pour un role specifique sur la plateforme.',
    apps: [
      {
        title: 'Tableau de bord Admin',
        description: 'Supervisez chaque livreur et livraison a Tanger, gerez les entreprises et traitez les incidents.',
        badge: 'Pilotage plateforme',
      },
      {
        title: 'Portail Entreprise',
        description: 'Creez des livraisons, suivez les livreurs en temps reel et consultez votre historique complet — le tout depuis un seul ecran.',
        badge: 'Pour les entreprises',
      },
      {
        title: 'Application Livreur',
        description: 'Consultez les offres de livraison, naviguez vers les points de retrait et suivez vos gains au fil du temps.',
        badge: 'Pour les livreurs',
      },
    ],
    accessPortal: 'Acceder au portail',
    demoTitle: 'Identifiants de demonstration',
    demoSubtitle: 'Utilisez-les pour explorer les trois portails',
    show: 'Afficher',
    hide: 'Masquer',
    emailLabel: 'Email',
    passwordLabel: 'Mot de passe',
    copyEmail: "Copier l email",
    copyPassword: 'Copier le mot de passe',
    hiddenCredentialsTitle: 'Les identifiants demo sont masques',
    hiddenCredentialsSubtitle: 'Cliquez sur "Afficher" pour reveler les comptes de test de chaque portail',
    hiddenCredentialsNote: 'Note: ces comptes sont reinitialises regulierement pour des raisons de securite.',
    faqLabel: 'FAQ',
    faqTitle: 'Questions frequentes',
    faqSubtitle: 'Les questions les plus courantes sur The 1000.',
    faqAriaLabel: 'Questions frequentes',
    footer: 'Plateforme de livraison B2B, Tanger, Maroc',
    faqs: [
      {
        question: 'C est quoi The 1000 ?',
        answer:
          'Une plateforme de livraison pour les entreprises de Tanger. Vous demandez une livraison, on vous met en relation avec un livreur professionnel, et vous suivez tout en direct sur la carte.',
      },
      {
        question: 'Comment ca fonctionne ?',
        answer:
          'Ouvrez le portail entreprise, indiquez vos points de retrait et de livraison, et validez. Un livreur a proximite accepte en quelques minutes. Vous suivez tout sur la carte.',
      },
      {
        question: 'Quelles zones couvrez-vous ?',
        answer:
          'Nous operons actuellement dans toute la ville de Tanger. Une extension a la region Tanger-Tetouan-Al Hoceima est prevue.',
      },
      {
        question: 'Que puis-je envoyer ?',
        answer:
          'Documents, colis et envois inter-entreprises. Nous travaillons avec des pharmacies, commerces, fournisseurs et societes de services qui ont besoin de livraisons le jour meme a Tanger.',
      },
      {
        question: 'Combien ca coute ?',
        answer:
          '30 MAD par livraison en paiement a l usage. Achetez un pack credits a 25 MAD par livraison, ou utilisez Wallet+ pour debloquer des tarifs des 18 MAD. Sans abonnement, sans frais caches.',
      },
      {
        question: 'Puis-je suivre ma livraison en temps reel ?',
        answer:
          'Oui. Chaque livraison inclut le suivi GPS en direct. Vous voyez votre livreur se deplacer sur la carte depuis l acceptation jusqu a la livraison.',
      },
      {
        question: 'Comment les livreurs rejoignent The 1000 ?',
        answer:
          'Les livreurs s inscrivent via le portail livreur, definissent leur disponibilite et commencent a accepter les livraisons proches. Ils beneficient d une commission progressive qui augmente avec le volume.',
      },
    ],
    navFeatures: 'Fonctionnalites',
    navHowItWorks: 'Comment ca marche',
    navPricing: 'Tarifs',
    navPortals: 'Portails',
    navFaq: 'FAQ',
    heroHeadline: 'Arretez de courir apres vos livreurs. Suivez vos livraisons.',
    heroSubheadline: 'The 1000 donne aux entreprises de Tanger un tableau de bord unique pour demander, assigner et suivre les livraisons du jour avec des livreurs professionnels — fini le chaos WhatsApp.',
    heroValueProps: [
      { label: 'Livraison le jour meme' },
      { label: 'Suivi GPS en direct' },
      { label: 'Preuve de livraison' },
    ],
    trustTitle: 'La confiance des pharmacies, commerces et fournisseurs de Tanger',
    trustPillars: [
      { label: 'Livraison le jour meme' },
      { label: 'Suivi GPS en direct' },
      { label: 'Livreurs professionnels' },
      { label: 'Preuve de livraison' },
    ],
    howItWorksTitle: 'Comment ca marche',
    howItWorksSteps: [
      { title: 'Placez un point, decrivez votre colis', desc: 'Ouvrez le portail entreprise, indiquez vos points de retrait et de livraison, et ajoutez les details. Ca prend environ 30 secondes.' },
      { title: 'On trouve le livreur le plus proche', desc: 'La plateforme propose instantanement la course aux livreurs disponibles a proximite. Quelqu un accepte en quelques minutes.' },
      { title: 'Suivez tout en direct', desc: 'Suivez votre livreur sur la carte du retrait a la livraison. Vous recevez une confirmation des que c est fait.' },
    ],
    ctaTitle: 'Votre premiere livraison est a 30 minutes',
    ctaSubtitle: 'Creez votre compte entreprise, demandez une livraison, et suivez-la en direct sur la carte.',
    ctaButton: 'Creer votre compte',
    footerPlatform: 'Plateforme',
    footerCompany: 'Entreprise',
    footerConnect: 'Contact',
    footerAbout: 'A propos',
    footerContact: 'Nous contacter',
    footerLocation: 'Tanger, Maroc',
  },
  ar: {
    heroBadge: 'منصة توصيل بين الشركات — طنجة، المغرب',
    getStarted: 'اطلب عرضًا تجريبيًا',
    viewPortals: 'شاهد كيف تعمل',
    features: [
      { title: 'اعرف أين سائقك. دائمًا.', desc: 'افتح لوحة التحكم وشاهد كل سائق نشط على الخريطة. لا حاجة للاتصال والسؤال "وين نتا؟" — فقط تحقق من العرض المباشر.' },
      { title: 'ادفع فقط مقابل ما تستخدمه', desc: 'ابدأ بـ 30 درهم للتوصيلة بدون التزام. كلما زاد حجمك، افتح أسعارًا تصل إلى 18 درهم مع Wallet+.' },
      { title: 'السائقون يكسبون أكثر، وأنت تحصل على خدمة أفضل', desc: 'عمولتنا التصاعدية تكافئ السائقين الأكثر نشاطًا — فتحصل دائمًا على محترفين متحمسين وذوي خبرة.' },
      { title: 'من الطلب إلى إثبات التسليم', desc: 'أنشئ طلب توصيل وتابعه من الاستلام إلى النقل حتى التسليم. احصل على تأكيد OTP أو صورة عند الوصول.' },
    ],
    aboutLabel: 'لماذا The 1000',
    aboutTitle: 'توصيلاتك، تحت السيطرة',
    aboutBody:
      'The 1000 منصة توصيل مصممة لشركات طنجة. اطلب توصيلة، نربطك بسائق محترف، وتتبع كل خطوة على خريطة مباشرة — من الاستلام إلى إثبات التسليم. بدون اشتراك، بدون حد أدنى.',
    portalsLabel: 'البوابات',
    portalsTitle: 'اختر بوابتك',
    portalsDescription: 'كل بوابة مصممة لدور محدد على المنصة.',
    apps: [
      {
        title: 'لوحة تحكم الإدارة',
        description: 'راقب كل سائق وتوصيلة في طنجة، أدر الشركات وتعامل مع المشكلات.',
        badge: 'تحكم المنصة',
      },
      {
        title: 'بوابة الشركات',
        description: 'أنشئ طلبات التوصيل، تتبع السائقين مباشرة، واطلع على سجل التوصيلات الكامل — كل شيء من شاشة واحدة.',
        badge: 'للشركات',
      },
      {
        title: 'تطبيق السائق',
        description: 'استعرض عروض التوصيل، انتقل إلى نقاط الاستلام، وتابع أرباحك وهي تنمو.',
        badge: 'للسائقين',
      },
    ],
    accessPortal: 'دخول البوابة',
    demoTitle: 'بيانات تجريبية',
    demoSubtitle: 'استخدمها لاستكشاف البوابات الثلاث',
    show: 'إظهار',
    hide: 'إخفاء',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    copyEmail: 'نسخ البريد',
    copyPassword: 'نسخ كلمة المرور',
    hiddenCredentialsTitle: 'بيانات الدخول التجريبية مخفية',
    hiddenCredentialsSubtitle: 'اضغط "إظهار" لعرض حسابات الاختبار لكل بوابة',
    hiddenCredentialsNote: 'ملاحظة: تتم إعادة تعيين هذه الحسابات بشكل دوري لأسباب أمنية.',
    faqLabel: 'الأسئلة الشائعة',
    faqTitle: 'أسئلة متكررة',
    faqSubtitle: 'الأسئلة الأكثر شيوعًا حول استخدام The 1000 لتوصيلاتك.',
    faqAriaLabel: 'الأسئلة الشائعة',
    footer: 'منصة توصيل B2B، طنجة، المغرب',
    faqs: [
      {
        question: 'ما هي The 1000؟',
        answer:
          'منصة توصيل لشركات طنجة. تطلب توصيلة، نربطك بسائق محترف، وتتابع كل شيء مباشرة على الخريطة حتى الوصول.',
      },
      {
        question: 'كيف تعمل؟',
        answer:
          'افتح بوابة الشركات، حدد نقطة الاستلام والتسليم، وأرسل الطلب. سائق قريب يقبل خلال دقائق. تتابع كل شيء على الخريطة.',
      },
      {
        question: 'ما المناطق التي تغطونها؟',
        answer:
          'نعمل حاليًا في جميع أنحاء مدينة طنجة. التوسع نحو جهة طنجة-تطوان-الحسيمة مخطط له.',
      },
      {
        question: 'ماذا يمكنني إرسال؟',
        answer:
          'وثائق وطرود وشحنات بين الشركات. نعمل مع الصيدليات والمتاجر والموردين وشركات الخدمات التي تحتاج توصيلًا في نفس اليوم داخل طنجة.',
      },
      {
        question: 'كم التكلفة؟',
        answer:
          '30 درهم للتوصيلة بنظام الدفع عند الاستخدام. اشترِ باقة رصيد بـ 25 درهم للتوصيلة، أو استخدم Wallet+ لفتح أسعار تبدأ من 18 درهم. بدون اشتراك، بدون رسوم مخفية.',
      },
      {
        question: 'هل يمكنني تتبع توصيلتي مباشرة؟',
        answer:
          'نعم. كل توصيلة تتضمن تتبع GPS مباشر. تشاهد سائقك يتحرك على الخريطة من لحظة القبول حتى التسليم.',
      },
      {
        question: 'كيف ينضم السائقون؟',
        answer:
          'يسجل السائقون عبر بوابة السائق، يحددون توفرهم، ويبدأون بقبول التوصيلات القريبة. يحصلون على عمولة تصاعدية تزداد مع حجم العمل.',
      },
    ],
    navFeatures: 'المزايا',
    navHowItWorks: 'كيف تعمل',
    navPricing: 'الأسعار',
    navPortals: 'البوابات',
    navFaq: 'الأسئلة الشائعة',
    heroHeadline: 'توقّف عن ملاحقة السائقين. تتبّع توصيلاتك.',
    heroSubheadline: 'The 1000 يمنح شركات طنجة لوحة تحكم واحدة لطلب وتعيين وتتبع التوصيلات في نفس اليوم مع سائقين محترفين — بدون فوضى واتساب.',
    heroValueProps: [
      { label: 'توصيل في نفس اليوم' },
      { label: 'تتبع GPS مباشر' },
      { label: 'إثبات التسليم' },
    ],
    trustTitle: 'موثوق من الصيدليات والمتاجر والموردين في طنجة',
    trustPillars: [
      { label: 'توصيل في نفس اليوم' },
      { label: 'تتبع GPS مباشر' },
      { label: 'سائقون محترفون' },
      { label: 'إثبات التسليم' },
    ],
    howItWorksTitle: 'كيف تعمل المنصة',
    howItWorksSteps: [
      { title: 'حدد نقطة، وصف طردك', desc: 'افتح بوابة الشركات، حدد نقاط الاستلام والتسليم، وأضف تفاصيل الطلب. يستغرق حوالي 30 ثانية.' },
      { title: 'نجد أقرب سائق', desc: 'المنصة تعرض الطلب فورًا على السائقين المتاحين بالقرب. أحدهم يقبل خلال دقائق.' },
      { title: 'تابع كل شيء مباشرة', desc: 'تتبع سائقك على الخريطة من الاستلام حتى التسليم. تحصل على تأكيد لحظة الوصول.' },
    ],
    ctaTitle: 'أول توصيلة لك على بُعد 30 دقيقة',
    ctaSubtitle: 'أنشئ حساب شركتك، اطلب توصيلة، وتابعها مباشرة على الخريطة.',
    ctaButton: 'أنشئ حسابك',
    footerPlatform: 'المنصة',
    footerCompany: 'الشركة',
    footerConnect: 'تواصل',
    footerAbout: 'من نحن',
    footerContact: 'اتصل بنا',
    footerLocation: 'طنجة، المغرب',
  },
};

const PRICING_COPY: Record<AppLanguage, PricingContent> = {
  en: {
    label: 'Pricing',
    title: 'Simple pricing that scales with you',
    subtitle:
      'Start with pay-per-delivery. As your business grows, unlock lower rates automatically.',
    ratesTitle: 'How It Works',
    rates: [
      { label: 'Pay as You Go', value: '30 MAD / delivery', note: 'No commitment. Pay only when you need a delivery.' },
      { label: 'Credit Packs', value: '25 MAD / delivery', note: 'Buy a pack upfront and save on every delivery.' },
      { label: 'Wallet+', value: 'From 18 MAD / delivery', note: 'Top up your wallet — the more you add, the lower your rate.' },
    ],
    packsTitle: 'Credit Packs',
    packs: [
      { name: 'Starter 8', details: '8 deliveries — 30 days', price: '200 MAD' },
      { name: 'Trimestrial 24', details: '24 deliveries — 90 days', price: '600 MAD' },
      { name: 'Semestrial 48', details: '48 deliveries — 180 days', price: '1200 MAD' },
      { name: 'Annual 96', details: '96 deliveries — 365 days', price: '2400 MAD' },
    ],
    walletTierNote:
      'Wallet+ rates by top-up amount: 25 MAD (<1500), 22 MAD (1500-2999), 20 MAD (3000-4999), 18 MAD (5000+).',
  },
  fr: {
    label: 'Tarifs',
    title: 'Des tarifs simples qui evoluent avec vous',
    subtitle:
      'Commencez avec le paiement a la livraison. En grandissant, debloquez automatiquement des tarifs reduits.',
    ratesTitle: 'Comment ca marche',
    rates: [
      { label: 'Paiement a l usage', value: '30 MAD / livraison', note: 'Sans engagement. Payez uniquement quand vous avez besoin d une livraison.' },
      { label: 'Packs Credits', value: '25 MAD / livraison', note: 'Achetez un pack a l avance et economisez sur chaque livraison.' },
      { label: 'Wallet+', value: 'Des 18 MAD / livraison', note: 'Rechargez votre wallet — plus vous ajoutez, plus le tarif baisse.' },
    ],
    packsTitle: 'Packs Credits',
    packs: [
      { name: 'Starter 8', details: '8 livraisons — 30 jours', price: '200 MAD' },
      { name: 'Trimestrial 24', details: '24 livraisons — 90 jours', price: '600 MAD' },
      { name: 'Semestrial 48', details: '48 livraisons — 180 jours', price: '1200 MAD' },
      { name: 'Annual 96', details: '96 livraisons — 365 jours', price: '2400 MAD' },
    ],
    walletTierNote:
      'Tarifs Wallet+ par montant de recharge: 25 MAD (<1500), 22 MAD (1500-2999), 20 MAD (3000-4999), 18 MAD (5000+).',
  },
  ar: {
    label: 'الأسعار',
    title: 'تسعير بسيط ينمو معك',
    subtitle:
      'ابدأ بالدفع عند كل توصيلة. كلما نما نشاطك، تفتح تلقائيًا أسعارًا أقل.',
    ratesTitle: 'كيف يعمل',
    rates: [
      { label: 'ادفع عند الاستخدام', value: '30 درهم / توصيلة', note: 'بدون التزام. ادفع فقط عندما تحتاج توصيلة.' },
      { label: 'باقات الرصيد', value: '25 درهم / توصيلة', note: 'اشترِ باقة مسبقًا ووفّر على كل توصيلة.' },
      { label: 'Wallet+', value: 'من 18 درهم / توصيلة', note: 'اشحن محفظتك — كلما أضفت أكثر، انخفض السعر.' },
    ],
    packsTitle: 'باقات الرصيد',
    packs: [
      { name: 'Starter 8', details: '8 توصيلات — 30 يوم', price: '200 درهم' },
      { name: 'Trimestrial 24', details: '24 توصيلة — 90 يوم', price: '600 درهم' },
      { name: 'Semestrial 48', details: '48 توصيلة — 180 يوم', price: '1200 درهم' },
      { name: 'Annual 96', details: '96 توصيلة — 365 يوم', price: '2400 درهم' },
    ],
    walletTierNote:
      'أسعار Wallet+ حسب مبلغ الشحن: 25 درهم (أقل من 1500)، 22 درهم (1500-2999)، 20 درهم (3000-4999)، 18 درهم (5000+).',
  },
};

const APP_CONFIG = [
  {
    icon: BarChart3,
    href: '/admin',
    bg: 'bg-slate-100',
    iconColor: 'text-slate-800',
  },
  {
    icon: MapPin,
    href: '/business',
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
  },
  {
    icon: Users,
    href: '/rider',
    bg: 'bg-lime-50',
    iconColor: 'text-lime-700',
  },
] as const;

const FEATURE_CONFIG = [
  { icon: Globe, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: Shield, color: 'text-slate-700', bg: 'bg-slate-100' },
  { icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50' },
  { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
] as const;

const NAV_LINKS = [
  { id: 'features', key: 'navFeatures' as const },
  { id: 'how-it-works', key: 'navHowItWorks' as const },
  { id: 'pricing', key: 'navPricing' as const },
  { id: 'portals', key: 'navPortals' as const },
  { id: 'faq', key: 'navFaq' as const },
];

export default function HomePage() {
  const router = useRouter();
  const isDev = process.env.NODE_ENV !== 'production';
  const { language } = useLanguage();
  const content = HOME_COPY[language];
  const pricing = PRICING_COPY[language];
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const faqSchema = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    }),
    [content.faqs],
  );

  const apps = APP_CONFIG.map((app, index) => ({
    ...app,
    ...content.apps[index],
  }));

  const features = FEATURE_CONFIG.map((feature, index) => ({
    ...feature,
    ...content.features[index],
  }));

  const credentials = [
    {
      label: content.apps[0].title,
      email: 'admin@the1000.ma',
      password: 'Admin1234!',
      wrapperClass: 'rounded-xl border border-slate-100 bg-slate-50 p-4',
      labelClass: 'mb-3 text-xs font-bold uppercase tracking-wider text-slate-500',
    },
    {
      label: content.apps[1].title,
      email: 'pharmacie@example.ma',
      password: 'Business1234!',
      wrapperClass: 'rounded-xl border border-teal-100 bg-teal-50 p-4',
      labelClass: 'mb-3 text-xs font-bold uppercase tracking-wider text-teal-500',
    },
    {
      label: content.apps[2].title,
      email: 'rider1@the1000.ma',
      password: 'Rider1234!',
      wrapperClass: 'rounded-xl border border-emerald-100 bg-emerald-50 p-4',
      labelClass: 'mb-3 text-xs font-bold uppercase tracking-wider text-emerald-500',
    },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* ── Sticky Navigation ── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? 'nav-scrolled' : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/brand-logo.svg" alt="The 1000" className="h-10 w-10 rounded-xl" />
            <span className="text-xl font-extrabold text-foreground">THE 1000</span>
          </div>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {content[link.key]}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher inline />
            <Button
              size="sm"
              className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onClick={() => scrollTo('portals')}
            >
              {content.getStarted}
            </Button>
          </div>

          <button
            className="rounded-lg p-2 text-foreground transition-colors hover:bg-muted md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border bg-white/95 px-6 pb-4 pt-2 backdrop-blur md:hidden">
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {content[link.key]}
                </button>
              ))}
              <div className="flex items-center gap-3 pt-2">
                <LanguageSwitcher inline />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Split-Panel Hero ── */}
      <div className="section-wave relative overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-400/20 to-teal-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-slate-400/15 to-slate-900/20 blur-3xl" />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 py-20 sm:py-28 lg:flex-row lg:px-8">
          {/* Left - Text */}
          <div className="flex-1 text-center lg:text-start">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {content.heroBadge}
            </div>

            <h1 className="mb-6 text-5xl font-extrabold leading-tight text-foreground lg:text-7xl">
              {content.heroHeadline}
            </h1>

            <p className="mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground lg:text-xl">
              {content.heroSubheadline}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Button
                size="lg"
                className="h-12 bg-emerald-600 px-8 text-base font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
                onClick={() => scrollTo('portals')}
              >
                {content.getStarted}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-2 px-8 text-base font-semibold"
                onClick={() => scrollTo('features')}
              >
                {content.viewPortals}
              </Button>
            </div>

            {/* Value props */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              {content.heroValueProps.map((prop, i) => (
                <span key={i} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
                  {prop.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right - Logo visual */}
          <div className="relative flex flex-shrink-0 items-center justify-center">
            <div className="absolute h-80 w-80 rounded-full bg-emerald-100/60 lg:h-[420px] lg:w-[420px]" />
            <img
              src="/brand-logo.svg"
              alt="THE 1000 logo"
              className="relative z-10 h-64 w-64 sm:h-80 sm:w-80 lg:h-[400px] lg:w-[400px]"
            />
          </div>
        </div>
      </div>

      {/* ── Trust / Value Pillars Strip ── */}
      <section className="bg-emerald-50/60 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">{content.trustTitle}</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {content.trustPillars.map((pillar, i) => (
              <div key={i} className="rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
                <p className="text-lg font-bold text-emerald-700">{pillar.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Bento Grid ── */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-14 text-center">
          <span className="mb-3 inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            {content.aboutLabel}
          </span>
          <h2 className="mt-4 text-3xl font-bold text-foreground lg:text-4xl">{content.aboutTitle}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{content.aboutBody}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className={`group rounded-2xl border border-border bg-white p-8 shadow-sm transition-all duration-300 hover:border-emerald-300 hover:shadow-md ${
                  i === 0 ? 'md:col-span-2' : ''
                }`}
              >
                <div className={`mb-4 inline-flex rounded-xl ${feature.bg} p-3 pulse-ring`}>
                  <Icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="mb-2 text-xl font-bold text-foreground">{feature.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-14 text-center text-3xl font-bold text-foreground lg:text-4xl">
            {content.howItWorksTitle}
          </h2>

          <div className="relative flex flex-col items-start gap-12 md:flex-row md:items-start md:gap-8">
            {/* Dashed connector line (desktop only) */}
            <div className="absolute left-0 right-0 top-6 hidden h-px border-t-2 border-dashed border-emerald-200 md:block" />

            {content.howItWorksSteps.map((step, i) => (
              <div key={i} className="relative z-10 flex flex-1 flex-col items-center text-center">
                <div className="step-number mb-4">{i + 1}</div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{step.title}</h3>
                <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Header */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12 text-center">
            <span className="mb-3 inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              {pricing.label}
            </span>
            <h2 className="mt-4 text-3xl font-bold text-foreground lg:text-4xl">{pricing.title}</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-muted-foreground">{pricing.subtitle}</p>
          </div>

          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">{pricing.ratesTitle}</h3>
          <div className="grid gap-6 lg:grid-cols-3">
            {pricing.rates.map((rate) => (
              <div key={rate.label} className="rounded-2xl border border-border bg-slate-50 p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{rate.label}</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-700">{rate.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{rate.note}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-foreground">{pricing.packsTitle}</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {pricing.packs.map((pack) => (
                <div key={pack.name} className="rounded-xl border border-border bg-emerald-50/50 p-4">
                  <p className="text-sm font-bold text-foreground">{pack.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{pack.details}</p>
                  <p className="mt-2 text-lg font-extrabold text-emerald-700">{pack.price}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {pricing.walletTierNote}
            </p>
          </div>
        </div>
      </section>

      {/* Portal Cards */}
      <div id="portals" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="mb-14 text-center">
          <span className="mb-3 inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            {content.portalsLabel}
          </span>
          <h2 className="mt-4 text-3xl font-bold text-foreground lg:text-4xl">{content.portalsTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{content.portalsDescription}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {apps.map((app) => {
            const Icon = app.icon;
            return (
              <div
                key={app.href}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border border-l-4 border-l-emerald-500 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                onClick={() => router.push(app.href)}
              >
                <span className={`mb-5 inline-block rounded-full px-3 py-1 text-xs font-semibold ${app.bg} ${app.iconColor}`}>
                  {app.badge}
                </span>

                <div className={`mb-5 w-fit rounded-2xl p-4 ${app.bg}`}>
                  <Icon className={`h-8 w-8 ${app.iconColor}`} />
                </div>

                <h3 className="mb-2 text-xl font-bold text-foreground">{app.title}</h3>
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{app.description}</p>

                <Button
                  className="w-full bg-emerald-600 font-semibold text-white transition-colors hover:bg-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(app.href);
                  }}
                >
                  {content.accessPortal}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* ── Demo Credentials ── */}
        {isDev && (
          <div className="mt-16 rounded-2xl border border-border border-l-4 border-l-amber-400 bg-white p-8 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-50 p-2.5">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{content.demoTitle}</h3>
                  <p className="text-sm text-muted-foreground">{content.demoSubtitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCredentials(!showCredentials)}
                className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
              >
                {showCredentials ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    {content.hide}
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    {content.show}
                  </>
                )}
              </button>
            </div>

            {showCredentials ? (
              <div className="grid gap-4 md:grid-cols-3">
                {credentials.map((cred, idx) => (
                  <div key={idx} className={cred.wrapperClass}>
                    <p className={cred.labelClass}>{cred.label}</p>

                    <div className="space-y-3">
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">{content.emailLabel}</p>
                        <div className="flex items-center justify-between gap-2">
                          <code className="flex-1 rounded bg-white px-2 py-1 font-mono text-xs text-foreground">{cred.email}</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(cred.email);
                              setCopiedIndex(idx * 2);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            className="rounded p-1 transition-colors hover:bg-white/50"
                            title={content.copyEmail}
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
                        <p className="mb-1 text-xs text-muted-foreground">{content.passwordLabel}</p>
                        <div className="flex items-center justify-between gap-2">
                          <code className="flex-1 rounded bg-white px-2 py-1 font-mono text-xs text-foreground">{cred.password}</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(cred.password);
                              setCopiedIndex(idx * 2 + 1);
                              setTimeout(() => setCopiedIndex(null), 2000);
                            }}
                            className="rounded p-1 transition-colors hover:bg-white/50"
                            title={content.copyPassword}
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
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                <p className="mb-3 text-sm text-amber-900">{content.hiddenCredentialsTitle}</p>
                <p className="mb-4 text-xs text-amber-700">{content.hiddenCredentialsSubtitle}</p>
                <p className="text-xs text-amber-600">{content.hiddenCredentialsNote}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FAQ Section ── */}
      <section id="faq" aria-label={content.faqAriaLabel} className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
        <div className="mb-12 text-center">
          <span className="mb-3 inline-block rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            {content.faqLabel}
          </span>
          <h2 className="mt-4 text-3xl font-bold text-foreground">{content.faqTitle}</h2>
          <p className="mt-3 text-muted-foreground">{content.faqSubtitle}</p>
        </div>

        <dl className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          {content.faqs.map((faq, i) => (
            <div key={i} className="border-b border-border last:border-b-0">
              <dt>
                <button
                  className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-muted/40"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span className="pr-4 font-semibold text-foreground">{faq.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </dt>
              {openFaq === i && <dd className="px-6 pb-5 leading-relaxed text-muted-foreground">{faq.answer}</dd>}
            </div>
          ))}
        </dl>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-gradient-to-r from-emerald-600 to-slate-900 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <h2 className="mb-4 text-3xl font-extrabold text-white lg:text-4xl">{content.ctaTitle}</h2>
          <p className="mb-8 text-lg text-white/70">{content.ctaSubtitle}</p>
          <Button
            size="lg"
            variant="outline"
            className="h-12 border-2 border-white px-8 text-base font-semibold text-white hover:bg-white hover:text-slate-900"
            onClick={() => scrollTo('portals')}
          >
            {content.ctaButton}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ── Professional Footer ── */}
      <footer className="bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <img src="/brand-logo.svg" alt="The 1000" className="h-10 w-10 rounded-xl" />
                <span className="text-xl font-extrabold">THE 1000</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-400">{content.footer}</p>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">{content.footerPlatform}</h4>
              <ul className="space-y-2">
                {apps.map((app) => (
                  <li key={app.href}>
                    <button
                      onClick={() => router.push(app.href)}
                      className="text-sm text-slate-300 transition-colors hover:text-white"
                    >
                      {app.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">{content.footerCompany}</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => scrollTo('features')}
                    className="text-sm text-slate-300 transition-colors hover:text-white"
                  >
                    {content.footerAbout}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollTo('faq')}
                    className="text-sm text-slate-300 transition-colors hover:text-white"
                  >
                    {content.faqLabel}
                  </button>
                </li>
                <li>
                  <span className="text-sm text-slate-300">{content.footerContact}</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">{content.footerConnect}</h4>
              <p className="text-sm text-slate-300">{content.footerLocation}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
            <p className="text-center text-sm text-slate-500">
              &copy; {new Date().getFullYear()} <span className="font-semibold text-slate-400">The 1000</span> — {content.footer}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
