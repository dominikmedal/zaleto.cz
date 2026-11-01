import type { Metadata } from 'next'
import Script from 'next/script'
import { Fraunces, Poppins, Space_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--next-fraunces',
  display: 'swap',
})
const poppins = Poppins({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '700'],
  variable: '--next-poppins',
  display: 'swap',
})
const spaceMono = Space_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
  variable: '--next-space-mono',
  display: 'swap',
})
import ScrollToTop from '@/components/ScrollToTop'
import Footer from '@/components/Footer'
import NavigationProgress from '@/components/NavigationProgress'
import OfferBar from '@/components/OfferBar'
import ExitOffer from '@/components/ExitOffer'
import SectionRail from '@/components/SectionRail'
import FieldClicks from '@/components/ui/FieldClicks'
import ServiceWorkerSetup from '@/components/ServiceWorkerSetup'
import JsonLd from '@/components/JsonLd'
import ChatWidget from '@/components/ChatWidget'
import CookieConsent from '@/components/CookieConsent'

export const metadata: Metadata = {
  title: {
    default: 'Zaleto — Vyhledávač zájezdů',
    template: '%s | Zaleto',
  },
  description: 'Srovnejte tisíce leteckých zájezdů od předních českých cestovních kanceláří. Filtrujte podle destinace, termínu, stravování a ceny. Nejlepší dovolená snadno na jednom místě.',
  metadataBase: new URL('https://zaleto.cz'),
  keywords: [
    'zájezdy', 'last minute zájezdy', 'dovolená', 'all inclusive', 'letecké zájezdy',
    'srovnání zájezdů', 'cestovní kancelář', 'levné zájezdy', 'first minute zájezdy',
    'zájezdy Egypt', 'zájezdy Řecko', 'zájezdy Turecko', 'zájezdy Chorvatsko',
    'zájezdy Španělsko', 'zájezdy Tunisko', 'porovnání CK', 'dovolená u moře',
    'Fischer', 'Čedok', 'Exim Tours', 'Blue Style', 'TUI zájezdy',
  ],
  icons: {
    icon: [
      { url: '/img/favicon.ico' },
      { url: '/img/favicon.svg', type: 'image/svg+xml' },
      { url: '/img/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [
      { url: '/img/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/img/site.webmanifest',
  openGraph: {
    siteName: 'Zaleto',
    locale: 'cs_CZ',
    type: 'website',
    images: [{ url: '/img/og-image.png', width: 1200, height: 630, alt: 'Zaleto — Vyhledávač zájezdů' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/img/og-image.png'],
  },
  other: {
    'seznam-wmt': 'Df94Kp7QclEF2TM20GiaoZke9NSmOCCb',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Zaleto',
  legalName: 'Bc. Dominik Medal',
  url: 'https://zaleto.cz',
  logo: 'https://zaleto.cz/img/logo/logo.png',
  description: 'Zaleto je český srovnávač zájezdů od českých cestovních kanceláří a půjčoven aut.',
  email: 'info@zaleto.cz',
  identifier: { '@type': 'PropertyValue', propertyID: 'IČO', value: '17271541' },
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Majerského 2032/9',
    addressLocality: 'Praha 4 - Chodov',
    postalCode: '149 00',
    addressCountry: 'CZ',
  },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'info@zaleto.cz',
    availableLanguage: ['cs'],
    areaServed: 'CZ',
    url: 'https://zaleto.cz/kontakt',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${fraunces.variable} ${poppins.variable} ${spaceMono.variable}`}>
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-HPE9HH5VG3" strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
          try { if (localStorage.getItem('z-consent') === 'granted') gtag('consent', 'update', { analytics_storage: 'granted' }); } catch (e) {}
          gtag('js', new Date());
          gtag('config', 'G-HPE9HH5VG3');
        `}</Script>
      </head>
      <body>
        <NavigationProgress />
        <ServiceWorkerSetup />
        <JsonLd data={orgSchema} />
        <OfferBar />
        <FieldClicks />
        {children}
        <Footer />
        <ScrollToTop />
        <ChatWidget />
        <CookieConsent />
        <ExitOffer />
        <SectionRail />
      </body>
    </html>
  )
}
