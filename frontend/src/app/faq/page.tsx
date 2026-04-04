import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import FaqAccordion from '@/components/FaqAccordion'
import { FAQS } from '@/components/faq-data'
import JsonLd from '@/components/JsonLd'
import { PiEnvelope, PiChatCircle } from 'react-icons/pi'

export const metadata: Metadata = {
  title: 'Časté otázky — jak funguje Zaleto | FAQ',
  description: 'Jak vyhledat zájezd, porovnat ceny cestovních kanceláří a rezervovat dovolenou. Odpovědi na nejčastější otázky o Zaleto — srovnávači leteckých zájezdů.',
  alternates: { canonical: 'https://zaleto.cz/faq' },
  openGraph: {
    title: 'Časté otázky | Zaleto',
    description: 'Jak funguje Zaleto, jak porovnat ceny CK a jak rezervovat zájezd. Odpovědi na vaše otázky.',
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

        {/* Hero */}
        <div className="mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: '#0093FF' }}>
            Pomoc &amp; Podpora
          </p>
          <h1
            className="font-bold text-gray-900 leading-tight tracking-tight mb-3"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 4.5vw, 52px)' }}
          >
            Časté <em className="not-italic" style={{ color: '#0093FF' }}>otázky</em>
          </h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-xl">
            Rychlé odpovědi na nejčastější dotazy o fungování Zaleto.
          </p>
        </div>

        <FaqAccordion />

        {/* CTA block */}
        <div
          className="mt-10 rounded-2xl px-8 py-8 text-center"
          style={{
            background: 'rgba(237,246,255,0.70)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(0,147,255,0.18)',
            boxShadow: '0 4px 24px rgba(0,147,255,0.08)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(0,147,255,0.09)' }}
          >
            <PiChatCircle className="w-6 h-6 text-[#0093FF]" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Nenašli jste odpověď?</h2>
          <p className="text-sm text-gray-500 mb-6">Kontaktujte nás přímo — rádi vám pomůžeme.</p>
          <Link href="/kontakt" className="btn-cta">
            <PiEnvelope className="w-4 h-4" />
            Kontaktovat podporu
          </Link>
        </div>

      </main>
    </div>
  )
}
