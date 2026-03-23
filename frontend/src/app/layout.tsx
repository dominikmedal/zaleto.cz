import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import ScrollToTop from '@/components/ScrollToTop'
import Footer from '@/components/Footer'
import NavigationProgress from '@/components/NavigationProgress'
import JsonLd from '@/components/JsonLd'

export const metadata: Metadata = {
  title: {
    default: 'Zaleto — Vyhledávač zájezdů',
    template: '%s | Zaleto',
  },
  description: 'Srovnejte tisíce leteckých zájezdů od předních českých cestovních kanceláří. Filtrujte podle destinace, termínu, stravování a ceny. Nejlepší dovolená snadno na jednom místě.',
  metadataBase: new URL('https://zaleto.cz'),
  keywords: ['zájezdy', 'last minute zájezdy', 'dovolená', 'all inclusive', 'letecké zájezdy', 'srovnání zájezdů', 'cestovní kancelář', 'levné zájezdy'],
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
  url: 'https://zaleto.cz',
  logo: 'https://zaleto.cz/img/logo/logo.png',
  description: 'Zaleto je český srovnávač leteckých zájezdů od předních cestovních kanceláří.',
  email: 'info@zaleto.cz',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'CZ',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-HPE9HH5VG3" strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-HPE9HH5VG3');
        `}</Script>
      </head>
      <body>
        <NavigationProgress />
        <JsonLd data={orgSchema} />
        {children}
        <Footer />
        <ScrollToTop />
      </body>
    </html>
  )
}
