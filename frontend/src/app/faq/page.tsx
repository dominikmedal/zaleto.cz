import type { Metadata } from 'next'
import Header from '@/components/Header'
import FaqAccordion from '@/components/FaqAccordion'
import { FAQS } from '@/components/faq-data'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import Button from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Časté otázky — jak funguje Zaleto | FAQ',
  description: 'Jak vyhledat zájezd, porovnat ceny cestovních kanceláří a rezervovat dovolenou. Odpovědi na nejčastější otázky o Zaleto.',
  alternates: { canonical: 'https://zaleto.cz/faq' },
  openGraph: {
    title: 'Časté otázky | Zaleto',
    description: 'Jak funguje Zaleto, jak porovnat ceny CK a jak rezervovat zájezd.',
    url: 'https://zaleto.cz/faq',
    type: 'website',
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
}

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Časté otázky' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Pomoc" title="časté otázky" />
        <FaqAccordion />
        <div className="z-info" style={{ marginTop: 'var(--space-7)' }}>
          <h2 className="z-info__title">nenašel jsi odpověď<span className="z-dot">.</span></h2>
          <p style={{ margin: 'var(--space-3) 0 var(--space-5)' }}>Napiš nám, rádi pomůžeme.</p>
          <Button href="/kontakt">Napsat nám</Button>
        </div>
      </main>
    </>
  )
}
