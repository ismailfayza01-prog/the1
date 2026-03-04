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
  capacityNote: string;
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
  heroStats: Array<{ value: string; label: string }>;
  trustTitle: string;
  trustStats: Array<{ value: string; label: string }>;
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
    heroBadge: 'B2B Courier Platform - Tangier, Morocco',
    getStarted: 'Get Started',
    viewPortals: 'View Portals',
    features: [
      { title: 'Real-Time GPS Tracking', desc: 'See available riders live on the map and track every delivery from pickup to drop-off.' },
      { title: 'Flexible Pricing', desc: 'Pay on use at 30 MAD, prepaid packs at 25 MAD, and wallet top-ups that can go down to 18 MAD per ride.' },
      { title: 'Progressive Earnings', desc: 'Riders earn more with every delivery through our tiered commission system.' },
      { title: 'Live Tracking', desc: 'Follow every delivery from pickup to drop with real-time map updates.' },
    ],
    aboutLabel: 'About The 1000',
    aboutTitle: "Tangier's B2B Courier Marketplace",
    aboutBody:
      'The 1000 is a B2B courier marketplace platform based in Tangier, Morocco. It connects businesses that need same-day and express deliveries with a network of professional riders, offering real-time GPS tracking, subscription-based pricing, and a centralized dashboard for managing every delivery from request to drop-off.',
    portalsLabel: 'Portals',
    portalsTitle: 'Select Your Portal',
    portalsDescription: 'Choose the application that matches your role in The 1000 platform.',
    apps: [
      {
        title: 'Admin Dashboard',
        description: 'Manage riders, businesses, and monitor all deliveries in real time across the platform.',
        badge: 'Platform Control',
      },
      {
        title: 'Business Portal',
        description: 'Request deliveries, track riders, and manage your subscription with ease.',
        badge: 'For Businesses',
      },
      {
        title: 'Rider App',
        description: 'Accept deliveries, track earnings, and grow your income with every ride.',
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
    faqSubtitle: 'Everything you need to know about The 1000 courier platform.',
    faqAriaLabel: 'Frequently Asked Questions',
    footer: 'B2B Courier Marketplace, Tangier, Morocco',
    faqs: [
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
          'The 1000 currently operates in Tangier, Morocco, providing same-day and express B2B courier services across the city. Coverage expansion to other cities in the Tanger-Tetouan-Al Hoceima region is planned.',
      },
      {
        question: 'What types of deliveries does The 1000 handle?',
        answer:
          'The 1000 specializes in B2B deliveries including documents, parcels, and inter-business shipments within Tangier. The platform is designed for businesses such as pharmacies, retailers, suppliers, and service firms that require reliable, trackable same-day delivery.',
      },
      {
        question: 'What pricing options are available?',
        answer:
          'The 1000 uses a 3-level model: Pay on Use at 30 MAD per ride, Pack Credits at 25 MAD per ride, and Wallet+ rates that can go down to 18 MAD per ride as top-up volume increases.',
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
        question: 'What credit packs are available?',
        answer:
          'Current pack options are Starter 8 (200 MAD, 30 days), Trimestrial 24 (600 MAD, 90 days), Semestrial 48 (1200 MAD, 180 days), and Annual 96 (2400 MAD, 365 days).',
      },
      {
        question: 'How does Wallet+ reach 18 MAD per ride?',
        answer:
          'Wallet+ uses top-up tiers: 25 MAD for top-ups below 1500 MAD, 22 MAD for 1500-2999 MAD, 20 MAD for 3000-4999 MAD, and 18 MAD when top-up is 5000 MAD or more.',
      },
      {
        question: 'What happens if rider capacity is full at launch?',
        answer:
          'Launch onboarding is capacity-controlled. If active rider capacity is full, new businesses are moved to a waitlist and onboarded in batches to protect delivery reliability.',
      },
    ],
    navFeatures: 'Features',
    navHowItWorks: 'How It Works',
    navPricing: 'Pricing',
    navPortals: 'Portals',
    navFaq: 'FAQ',
    heroHeadline: 'Deliver Faster Across Tangier',
    heroSubheadline: 'The B2B courier marketplace that connects businesses with professional riders for same-day delivery, real-time tracking, and seamless logistics.',
    heroStats: [
      { value: '500+', label: 'Deliveries' },
      { value: '50+', label: 'Riders' },
      { value: '98%', label: 'On-Time' },
    ],
    trustTitle: 'Trusted by businesses across Tangier',
    trustStats: [
      { value: '500+', label: 'Deliveries Completed' },
      { value: '50+', label: 'Active Riders' },
      { value: '98%', label: 'On-Time Rate' },
      { value: '4.8', label: 'Average Rating' },
    ],
    howItWorksTitle: 'How It Works',
    howItWorksSteps: [
      { title: 'Request a Delivery', desc: 'Submit your delivery details through the business portal in seconds.' },
      { title: 'Rider Assigned', desc: 'Our system instantly matches your request with the nearest available rider.' },
      { title: 'Track & Receive', desc: 'Follow your delivery in real time on the map until it reaches its destination.' },
    ],
    ctaTitle: 'Ready to streamline your deliveries?',
    ctaSubtitle: 'Join businesses in Tangier already using The 1000 for reliable, tracked B2B courier services.',
    ctaButton: 'Get Started Now',
    footerPlatform: 'Platform',
    footerCompany: 'Company',
    footerConnect: 'Connect',
    footerAbout: 'About',
    footerContact: 'Contact',
    footerLocation: 'Tangier, Morocco',
  },
  fr: {
    heroBadge: 'Plateforme de livraison B2B - Tanger, Maroc',
    getStarted: 'Commencer',
    viewPortals: 'Voir les portails',
    features: [
      { title: 'Suivi GPS en temps reel', desc: 'Visualisez les livreurs disponibles en direct et suivez chaque livraison du retrait a la remise.' },
      { title: 'Tarification flexible', desc: 'Paiement a l usage a 30 MAD, packs prepayes a 25 MAD, et wallet top-up pouvant descendre jusqu a 18 MAD par course.' },
      { title: 'Revenus progressifs', desc: 'Les livreurs gagnent plus a chaque livraison grace au systeme de commissions.' },
      { title: 'Suivi en direct', desc: 'Suivez chaque livraison du retrait a la remise avec des mises a jour en temps reel.' },
    ],
    aboutLabel: 'A propos de The 1000',
    aboutTitle: 'La marketplace de coursiers B2B de Tanger',
    aboutBody:
      'The 1000 est une plateforme marketplace de livraison B2B basee a Tanger, au Maroc. Elle connecte les entreprises qui ont besoin de livraisons express et le jour meme avec un reseau de livreurs professionnels, avec suivi GPS en temps reel, tarification par abonnement et tableau de bord centralise pour gerer chaque livraison.',
    portalsLabel: 'Portails',
    portalsTitle: 'Choisissez votre portail',
    portalsDescription: 'Selectionnez l application qui correspond a votre role sur la plateforme The 1000.',
    apps: [
      {
        title: 'Tableau de bord Admin',
        description: 'Gerez les livreurs, les entreprises et suivez toutes les livraisons en temps reel.',
        badge: 'Pilotage plateforme',
      },
      {
        title: 'Portail Entreprise',
        description: 'Demandez des livraisons, suivez les livreurs et gerez votre abonnement facilement.',
        badge: 'Pour les entreprises',
      },
      {
        title: 'Application Livreur',
        description: 'Acceptez des livraisons, suivez vos revenus et augmentez vos gains.',
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
    faqSubtitle: 'Tout ce que vous devez savoir sur la plateforme The 1000.',
    faqAriaLabel: 'Questions frequentes',
    footer: 'Marketplace de coursiers B2B, Tanger, Maroc',
    faqs: [
      {
        question: 'Qu est-ce que The 1000 ?',
        answer:
          'The 1000 est une marketplace B2B de livraison basee a Tanger. Elle relie les entreprises ayant besoin de livraisons rapides a un reseau de livreurs professionnels avec suivi GPS en temps reel et gestion centralisee.',
      },
      {
        question: 'Comment fonctionne The 1000 pour les entreprises a Tanger ?',
        answer:
          'Les entreprises s abonnent a The 1000 et lancent leurs demandes depuis le portail entreprise. La plateforme assigne instantanement un livreur disponible et permet un suivi complet sur carte jusqu a la livraison.',
      },
      {
        question: 'Quelles zones sont actuellement couvertes ?',
        answer:
          'The 1000 opere actuellement a Tanger, au Maroc, avec des livraisons B2B express et le jour meme dans toute la ville. Une extension vers d autres villes de la region est prevue.',
      },
      {
        question: 'Quels types de livraisons sont pris en charge ?',
        answer:
          'The 1000 traite les livraisons B2B de documents, colis et envois inter-entreprises. La plateforme convient aux pharmacies, commerces, fournisseurs et societes de services.',
      },
      {
        question: 'Quelles options de prix sont disponibles ?',
        answer:
          'The 1000 applique un modele a 3 niveaux: Pay on Use a 30 MAD par course, Pack Credits a 25 MAD par course, et Wallet+ avec un tarif pouvant descendre jusqu a 18 MAD par course selon le top-up.',
      },
      {
        question: 'Y a-t-il un suivi en temps reel des livraisons ?',
        answer:
          'Oui. Chaque livraison inclut un suivi GPS en direct. Les entreprises visualisent le deplacement du livreur depuis la prise en charge jusqu a la remise.',
      },
      {
        question: 'Comment les livreurs rejoignent-ils The 1000 ?',
        answer:
          'Les livreurs s inscrivent via le portail livreur. Une fois actives, ils definissent leur disponibilite, acceptent des courses proches et suivent leurs revenus en temps reel.',
      },
      {
        question: 'Quels packs credits sont proposes ?',
        answer:
          'Les packs disponibles sont: Starter 8 (200 MAD, 30 jours), Trimestrial 24 (600 MAD, 90 jours), Semestrial 48 (1200 MAD, 180 jours), et Annual 96 (2400 MAD, 365 jours).',
      },
      {
        question: 'Comment Wallet+ atteint 18 MAD par course ?',
        answer:
          'Wallet+ fonctionne par paliers de top-up: 25 MAD en dessous de 1500 MAD, 22 MAD de 1500 a 2999 MAD, 20 MAD de 3000 a 4999 MAD, puis 18 MAD a partir de 5000 MAD.',
      },
      {
        question: 'Que se passe-t-il si la capacite riders est pleine au lancement ?',
        answer:
          'Le lancement est gere par capacite. Si tous les riders actifs sont occupes, les nouvelles entreprises passent en waitlist puis sont activees par vagues afin de garantir la fiabilite de service.',
      },
    ],
    navFeatures: 'Fonctionnalites',
    navHowItWorks: 'Comment ca marche',
    navPricing: 'Tarifs',
    navPortals: 'Portails',
    navFaq: 'FAQ',
    heroHeadline: 'Livrez plus vite a Tanger',
    heroSubheadline: 'La marketplace B2B qui connecte les entreprises avec des livreurs professionnels pour des livraisons le jour meme, un suivi en temps reel et une logistique simplifiee.',
    heroStats: [
      { value: '500+', label: 'Livraisons' },
      { value: '50+', label: 'Livreurs' },
      { value: '98%', label: 'A l\'heure' },
    ],
    trustTitle: 'Les entreprises de Tanger nous font confiance',
    trustStats: [
      { value: '500+', label: 'Livraisons effectuees' },
      { value: '50+', label: 'Livreurs actifs' },
      { value: '98%', label: 'Taux de ponctualite' },
      { value: '4.8', label: 'Note moyenne' },
    ],
    howItWorksTitle: 'Comment ca marche',
    howItWorksSteps: [
      { title: 'Demandez une livraison', desc: 'Soumettez vos details de livraison depuis le portail entreprise en quelques secondes.' },
      { title: 'Livreur assigne', desc: 'Notre systeme attribue instantanement votre demande au livreur disponible le plus proche.' },
      { title: 'Suivez et recevez', desc: 'Suivez votre livraison en temps reel sur la carte jusqu a destination.' },
    ],
    ctaTitle: 'Pret a optimiser vos livraisons ?',
    ctaSubtitle: 'Rejoignez les entreprises de Tanger qui utilisent deja The 1000 pour un service de coursier B2B fiable et suivi.',
    ctaButton: 'Commencer maintenant',
    footerPlatform: 'Plateforme',
    footerCompany: 'Entreprise',
    footerConnect: 'Contact',
    footerAbout: 'A propos',
    footerContact: 'Nous contacter',
    footerLocation: 'Tanger, Maroc',
  },
  ar: {
    heroBadge: 'منصة توصيل بين الشركات - طنجة، المغرب',
    getStarted: 'ابدأ الآن',
    viewPortals: 'عرض البوابات',
    features: [
      { title: 'تتبع GPS مباشر', desc: 'شاهد السائقين المتاحين مباشرة على الخريطة وتتبع كل عملية توصيل من الاستلام حتى التسليم.' },
      { title: 'خطط اشتراك مرنة', desc: 'باقات شهرية وسنوية مصممة لتناسب جميع أحجام الأعمال.' },
      { title: 'أرباح تصاعدية', desc: 'يزداد دخل السائق مع كل عملية توصيل عبر نظام العمولات المتدرج.' },
      { title: 'تتبع حي', desc: 'تابع كل عملية من الاستلام حتى التسليم مع تحديثات مباشرة على الخريطة.' },
    ],
    aboutLabel: 'حول The 1000',
    aboutTitle: 'سوق التوصيل B2B في طنجة',
    aboutBody:
      'The 1000 هي منصة توصيل بين الشركات في طنجة، المغرب. تربط الشركات التي تحتاج توصيلات فورية أو في نفس اليوم بشبكة من السائقين المحترفين، مع تتبع GPS مباشر، وتسعير بالاشتراك، ولوحة تحكم مركزية لإدارة كل عملية توصيل من الطلب حتى التسليم.',
    portalsLabel: 'البوابات',
    portalsTitle: 'اختر بوابتك',
    portalsDescription: 'اختر التطبيق المناسب لدورك داخل منصة The 1000.',
    apps: [
      {
        title: 'لوحة تحكم الإدارة',
        description: 'إدارة السائقين والشركات ومتابعة كل عمليات التوصيل في الوقت الحقيقي.',
        badge: 'تحكم المنصة',
      },
      {
        title: 'بوابة الشركات',
        description: 'اطلب التوصيل، تتبع السائقين، وأدر اشتراكك بسهولة.',
        badge: 'للشركات',
      },
      {
        title: 'تطبيق السائق',
        description: 'اقبل الطلبات، تابع أرباحك، وزد دخلك مع كل رحلة.',
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
    faqSubtitle: 'كل ما تحتاج معرفته عن منصة التوصيل The 1000.',
    faqAriaLabel: 'الأسئلة الشائعة',
    footer: 'منصة توصيل B2B، طنجة، المغرب',
    faqs: [
      {
        question: 'ما هي منصة The 1000؟',
        answer:
          'The 1000 منصة توصيل بين الشركات مقرها طنجة، المغرب. تربط الشركات التي تحتاج توصيلًا سريعًا بشبكة من السائقين المحترفين مع تتبع مباشر وإدارة مركزية للطلبات.',
      },
      {
        question: 'كيف تعمل The 1000 للشركات في طنجة؟',
        answer:
          'تشترك الشركة في The 1000 وتطلب عمليات التوصيل من بوابة الشركات. المنصة تعيّن سائقًا متاحًا فورًا، ويمكن متابعة الرحلة بالكامل على الخريطة حتى التسليم.',
      },
      {
        question: 'ما المناطق التي تغطيها المنصة حاليًا؟',
        answer:
          'تعمل The 1000 حاليًا داخل مدينة طنجة مع خدمات توصيل B2B في نفس اليوم وبشكل سريع، مع خطط للتوسع لاحقًا داخل المنطقة.',
      },
      {
        question: 'ما أنواع الشحنات التي تتعامل معها The 1000؟',
        answer:
          'تدعم المنصة شحنات B2B مثل الوثائق والطرود والشحنات بين الشركات، وهي مناسبة للصيدليات والمتاجر والموردين وشركات الخدمات.',
      },
      {
        question: 'كيف يتم تنظيم خطط الاشتراك؟',
        answer:
          'توفر The 1000 باقات شهرية وسنوية. كل باقة تحدد حجم التوصيلات والسعر لكل توصيل ومستوى المزايا المتاحة.',
      },
      {
        question: 'هل يوجد تتبع مباشر للتوصيل؟',
        answer:
          'نعم، كل عملية توصيل تتضمن تتبع GPS مباشر. يمكن للشركة متابعة حركة السائق لحظة بلحظة حتى إتمام التسليم.',
      },
      {
        question: 'كيف ينضم السائقون إلى The 1000؟',
        answer:
          'يسجل السائقون عبر بوابة السائق، ثم يحددون توفرهم ويقبلون الطلبات القريبة ويتابعون أرباحهم مباشرة داخل التطبيق.',
      },
      {
        question: 'كيف يتم احتساب تكلفة التوصيل؟',
        answer:
          'التسعير يعتمد أساسًا على الاشتراك. تدفع الشركة باقة شهرية أو سنوية تشمل حجمًا محددًا من الطلبات، ثم رسومًا إضافية عند تجاوز الحد.',
      },
    ],
    navFeatures: 'المزايا',
    navHowItWorks: 'كيف تعمل',
    navPricing: 'الاسعار',
    navPortals: 'البوابات',
    navFaq: 'الأسئلة الشائعة',
    heroHeadline: 'وصّل أسرع في طنجة',
    heroSubheadline: 'سوق التوصيل B2B الذي يربط الشركات بسائقين محترفين للتوصيل في نفس اليوم، مع تتبع مباشر ولوجستيات سلسة.',
    heroStats: [
      { value: '500+', label: 'عملية توصيل' },
      { value: '50+', label: 'سائق' },
      { value: '98%', label: 'في الوقت' },
    ],
    trustTitle: 'موثوق من طرف شركات طنجة',
    trustStats: [
      { value: '500+', label: 'عملية توصيل مكتملة' },
      { value: '50+', label: 'سائق نشط' },
      { value: '98%', label: 'نسبة الالتزام' },
      { value: '4.8', label: 'التقييم' },
    ],
    howItWorksTitle: 'كيف تعمل المنصة',
    howItWorksSteps: [
      { title: 'اطلب توصيلة', desc: 'أدخل تفاصيل التوصيل عبر بوابة الشركات في ثوانٍ.' },
      { title: 'تعيين سائق', desc: 'يعيّن النظام فورًا أقرب سائق متاح لطلبك.' },
      { title: 'تتبع واستلم', desc: 'تابع توصيلتك على الخريطة مباشرة حتى تصل لوجهتها.' },
    ],
    ctaTitle: 'مستعد لتحسين عمليات التوصيل؟',
    ctaSubtitle: 'انضم إلى شركات طنجة التي تستخدم The 1000 بالفعل لخدمات توصيل B2B موثوقة ومتتبعة.',
    ctaButton: 'ابدأ الآن',
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
    title: 'The1 Capacity-Smart Credits',
    subtitle:
      'Pick the model that fits your delivery volume: pay per ride, lock pack rates, or unlock Wallet+ discounted pricing as you scale.',
    ratesTitle: 'Rate Ladder',
    rates: [
      { label: 'Pay on Use', value: '30 MAD / ride', note: 'Best for occasional delivery demand.' },
      { label: 'Pack Credits', value: '25 MAD / ride', note: 'Prepaid packs with fixed ride credits.' },
      { label: 'Wallet+', value: 'Down to 18 MAD / ride', note: 'Volume top-up model for recurring high usage.' },
    ],
    packsTitle: 'Credit Packs',
    packs: [
      { name: 'Starter 8', details: '8 rides - 30 days', price: '200 MAD' },
      { name: 'Trimestrial 24', details: '24 rides - 90 days', price: '600 MAD' },
      { name: 'Semestrial 48', details: '48 rides - 180 days', price: '1200 MAD' },
      { name: 'Annual 96', details: '96 rides - 365 days', price: '2400 MAD' },
    ],
    walletTierNote:
      'Wallet+ tiers by top-up amount: 25 (<1500 MAD), 22 (1500-2999 MAD), 20 (3000-4999 MAD), 18 (>=5000 MAD).',
    capacityNote:
      'Launch mode: capacity-controlled onboarding with 4 riders online. New accounts enter waitlist when rider capacity is full.',
  },
  fr: {
    label: 'Tarifs',
    title: 'The1 Capacity-Smart Credits',
    subtitle:
      'Choisissez le modele adapte a votre volume: paiement a l usage, packs prepayes, ou Wallet+ avec tarif reduit quand votre volume augmente.',
    ratesTitle: 'Echelle Tarifaire',
    rates: [
      { label: 'Pay on Use', value: '30 MAD / course', note: 'Ideal pour les besoins occasionnels.' },
      { label: 'Pack Credits', value: '25 MAD / course', note: 'Packs prepayes avec credits de courses fixes.' },
      { label: 'Wallet+', value: 'Jusqu a 18 MAD / course', note: 'Mode top-up volume pour usage recurrent.' },
    ],
    packsTitle: 'Packs Credits',
    packs: [
      { name: 'Starter 8', details: '8 courses - 30 jours', price: '200 MAD' },
      { name: 'Trimestrial 24', details: '24 courses - 90 jours', price: '600 MAD' },
      { name: 'Semestrial 48', details: '48 courses - 180 jours', price: '1200 MAD' },
      { name: 'Annual 96', details: '96 courses - 365 jours', price: '2400 MAD' },
    ],
    walletTierNote:
      'Paliers Wallet+ par montant de top-up: 25 (<1500 MAD), 22 (1500-2999 MAD), 20 (3000-4999 MAD), 18 (>=5000 MAD).',
    capacityNote:
      'Mode lancement: onboarding controle par capacite avec 4 riders en ligne. Les nouveaux comptes passent en waitlist si la capacite est pleine.',
  },
  ar: {
    label: 'الاسعار',
    title: 'The1 Capacity-Smart Credits',
    subtitle:
      'اختر النموذج المناسب لحجم الطلب: الدفع لكل طلب، باقات مسبقة، او Wallet+ بسعر اقل مع زيادة الحجم.',
    ratesTitle: 'مستويات التسعير',
    rates: [
      { label: 'Pay on Use', value: '30 MAD / طلب', note: 'مناسب للطلبات المتقطعة.' },
      { label: 'Pack Credits', value: '25 MAD / طلب', note: 'باقات مسبقة مع رصيد طلبات ثابت.' },
      { label: 'Wallet+', value: 'حتى 18 MAD / طلب', note: 'تسعير مخفض حسب حجم التعبئة.' },
    ],
    packsTitle: 'باقات الرصيد',
    packs: [
      { name: 'Starter 8', details: '8 طلبات - 30 يوم', price: '200 MAD' },
      { name: 'Trimestrial 24', details: '24 طلب - 90 يوم', price: '600 MAD' },
      { name: 'Semestrial 48', details: '48 طلب - 180 يوم', price: '1200 MAD' },
      { name: 'Annual 96', details: '96 طلب - 365 يوم', price: '2400 MAD' },
    ],
    walletTierNote:
      'مستويات Wallet+ حسب مبلغ التعبئة: 25 (<1500 MAD)، 22 (1500-2999 MAD)، 20 (3000-4999 MAD)، 18 (>=5000 MAD).',
    capacityNote:
      'وضع الاطلاق: انضمام تدريجي بسعة 4 سائقين متاحين. عند الامتلاء يتم تحويل الحسابات الجديدة الى قائمة انتظار.',
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

            {/* Stats bar */}
            <div className="mt-10 flex items-center justify-center gap-8 lg:justify-start">
              {content.heroStats.map((stat, i) => (
                <div key={i} className="text-center lg:text-start">
                  <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
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

      {/* ── Trust Stats Strip ── */}
      <section className="bg-emerald-50/60 py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <h2 className="mb-10 text-center text-2xl font-bold text-foreground">{content.trustTitle}</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {content.trustStats.map((stat, i) => (
              <div key={i} className="rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
                <p className="text-4xl font-extrabold text-emerald-600">{stat.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
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
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {pricing.capacityNote}
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
