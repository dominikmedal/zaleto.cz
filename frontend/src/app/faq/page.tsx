import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import FaqAccordion from '@/components/FaqAccordion'
import { FAQS } from '@/components/faq-data'
import JsonLd from '@/components/JsonLd'
import { PiEnvelope } from 'react-icons/pi'

export const metadata: Metadata = {
  title: 'Časté otázky (FAQ)',
  description: 'Odpovědi na nejčastější dotazy o Zaleto — jak rezervovat zájezd, jak funguje vyhledávání, jak jsou aktualizovány ceny a jak kontaktovat cestovní kancelář.',
  alternates: { canonical: 'https://zaleto.cz/faq' },
  openGraph: {
    title: 'Časté otázky | Zaleto',
    description: 'Rychlé odpovědi na nejčastější dotazy o fungování Zaleto — srovnávače zájezdů.',
    url: 'https://zaleto.cz/faq',
    type: 'website',
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <JsonLd data={faqSchema} />
      <Header />
      <main className="max-w-3xl mx-auto px-6 sm:px-8 py-12">

        <div className="mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Pomoc & Podpora</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Často kladené otázky</h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-xl">
            Rychlé odpovědi na nejčastější dotazy o fungování Zaleto.
          </p>
        </div>

        <FaqAccordion />

        <div className="mt-10 rounded-2xl bg-[#008afe]/6 border border-[#008afe]/15 px-8 py-8 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Nenašli jste odpověď?</h2>
          <p className="text-sm text-gray-500 mb-5">Kontaktujte nás přímo — rádi vám pomůžeme.</p>
          <Link
            href="/kontakt"
            className="inline-flex items-center gap-2 bg-[#008afe] hover:bg-[#0079e5] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            <PiEnvelope className="w-4 h-4" />
            Kontaktovat podporu
          </Link>
        </div>
      </main>
    </div>
  )
}
