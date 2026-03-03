import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm',
  display: 'swap',
});

const siteUrl = 'https://the1000.ma';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'The 1000 — B2B Courier Marketplace in Tangier, Morocco',
    template: '%s | The 1000',
  },
  description:
    'The 1000 is a B2B courier marketplace connecting businesses in Tangier, Morocco with professional riders. Real-time GPS tracking, same-day delivery, and subscription-based pricing for businesses of all sizes.',
  keywords: [
    'B2B courier Tangier',
    'courier marketplace Morocco',
    'livraison express Tanger',
    'same-day delivery Tangier',
    'courier service Morocco',
    'plateforme livraison Maroc',
    'B2B delivery platform',
    'service courrier Tanger',
  ],
  authors: [{ name: 'The 1000', url: siteUrl }],
  creator: 'The 1000',
  publisher: 'The 1000',
  icons: {
    icon: [{ url: '/brand-logo.svg', type: 'image/svg+xml' }],
    shortcut: [{ url: '/brand-logo.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    type: 'website',
    locale: 'fr_MA',
    alternateLocale: 'en_US',
    url: siteUrl,
    siteName: 'The 1000',
    title: 'The 1000 — B2B Courier Marketplace in Tangier, Morocco',
    description:
      'The 1000 connects businesses in Tangier with professional couriers. Request a delivery, track your rider live, and manage your business logistics — all in one platform.',
    images: [
      {
        url: '/brand-logo.svg',
        width: 800,
        height: 800,
        alt: 'The 1000 — B2B Courier Marketplace Tangier Morocco',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'The 1000 — B2B Courier Marketplace in Tangier, Morocco',
    description:
      'B2B courier marketplace for businesses in Tangier. Real-time tracking, professional riders, same-day delivery.',
    images: ['/brand-logo.svg'],
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'The 1000',
      alternateName: ['The 1000 Courier', 'The 1000 Marketplace'],
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/brand-logo.svg`,
      },
      description:
        'The 1000 is a B2B courier marketplace platform based in Tangier, Morocco. It connects businesses that need same-day and express deliveries with a network of professional riders.',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Tangier',
        addressRegion: 'Tanger-Tétouan-Al Hoceïma',
        addressCountry: 'MA',
      },
      areaServed: {
        '@type': 'City',
        name: 'Tangier',
        sameAs: 'https://www.wikidata.org/wiki/Q3540',
      },
      knowsAbout: [
        'B2B Courier Services',
        'Same-day Delivery',
        'Last-mile Delivery',
        'Courier Marketplace',
        'Real-time GPS Tracking',
        'Business Logistics',
      ],
    },
    {
      '@type': 'LocalBusiness',
      '@id': `${siteUrl}/#localbusiness`,
      name: 'The 1000',
      description:
        'B2B courier marketplace serving businesses in Tangier, Morocco with same-day delivery, professional riders, and real-time tracking.',
      url: siteUrl,
      image: `${siteUrl}/brand-logo.svg`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Tangier',
        addressRegion: 'Tanger-Tétouan-Al Hoceïma',
        addressCountry: 'MA',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 35.7595,
        longitude: -5.834,
      },
      serviceType: 'Courier Service',
      currenciesAccepted: 'MAD',
      openingHours: 'Mo-Sa 08:00-20:00',
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'The 1000',
      description: 'B2B Courier Marketplace — Tangier, Morocco',
      publisher: { '@id': `${siteUrl}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`${syne.variable} ${dmSans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className={dmSans.className}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
