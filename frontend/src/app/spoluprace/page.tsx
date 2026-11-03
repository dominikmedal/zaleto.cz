import type { Metadata } from 'next'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import Icon, { type IconName } from '@/components/ui/Icon'
import CollabForm from '@/components/CollabForm'

export const metadata: Metadata = {
  title: 'Spolupráce: placené články na Zaleto',
  description: 'Chcete oslovit lidi, kteří vybírají dovolenou? Na Zaletu zveřejníme váš placený článek, označený jako spolupráce, a podle domluvy ho podpoříme propagací.',
  alternates: { canonical: 'https://zaleto.cz/spoluprace' },
  openGraph: {
    title: 'Spolupráce: placené články | Zaleto',
    description: 'Zveřejnění placeného článku na srovnávači zájezdů Zaleto. Napište nám.',
    url: 'https://zaleto.cz/spoluprace',
    type: 'website',
    siteName: 'Zaleto',
    locale: 'cs_CZ',
  },
}

const OFFER: { icon: IconName; title: string; text: string }[] = [
  { icon: 'clanek', title: 'Článek v cestovním deníku', text: 'Váš text (nebo ho s vámi připravíme) vyjde mezi našimi články, s fotkami a odkazy na vaši nabídku. Zůstává na webu trvale.' },
  { icon: 'poloha', title: 'Napojení na destinace', text: 'Článek propojíme s průvodcem destinace, počasím a nabídkou zájezdů, takže ho čtou lidé, kteří právě plánují cestu.' },
  { icon: 'srdce', title: 'Propagace podle domluvy', text: 'Podle domluvy článek podpoříme na našem Instagramu nebo doporučením na webu. Rozsah propagace i cenu stanovíme individuálně.' },
]

const STEPS = [
  { t: 'Napíšete nám', d: 'Pošlete téma, podklady nebo hotový text přes formulář níže.' },
  { t: 'Domluvíme podmínky', d: 'Odpovíme do dvou pracovních dnů s návrhem, termínem a cenou.' },
  { t: 'Článek upravíme', d: 'Text zkontrolujeme, doplníme fotky a odkazy a pošleme vám ho ke schválení.' },
  { t: 'Zveřejníme', d: 'Článek vyjde označený jako placená spolupráce; odkazy mají atribut sponsored.' },
]

const schema = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Spolupráce: placené články na Zaleto',
  url: 'https://zaleto.cz/spoluprace',
  isPartOf: { '@type': 'WebSite', name: 'Zaleto', url: 'https://zaleto.cz' },
}

export default function SpolupracePage() {
  return (
    <>
      <JsonLd data={schema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Spolupráce' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Pro firmy a značky" title="spolupráce: placené články" />
        <p className="lead" style={{ maxWidth: 'var(--article-max)', marginBottom: 'var(--space-7)' }}>
          Zaleto čtou lidé, kteří právě vybírají dovolenou. Pokud nabízíte ubytování, výlety, půjčovnu aut, pojištění nebo jinou službu pro cestovatele,
          zveřejníme váš článek mezi těmi našimi a podle domluvy ho podpoříme propagací.
        </p>

        <div className="z-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {OFFER.map(o => (
            <div key={o.title} className="z-info__item" style={{ background: 'var(--raised)', boxShadow: 'var(--shadow-ticket)' }}>
              <Icon name={o.icon} />
              <h2 className="h4" style={{ margin: 'var(--space-2) 0' }}>{o.title}</h2>
              <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{o.text}</p>
            </div>
          ))}
        </div>

        <section className="z-section">
          <SectionHead kicker="Jak to funguje" title="čtyři kroky" />
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-5)', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {STEPS.map((s, i) => (
              <li key={s.t}>
                <div className="z-kicker" style={{ color: 'var(--brand-strong)' }}>{String(i + 1).padStart(2, '0')}</div>
                <h3 className="h4" style={{ margin: 'var(--space-2) 0' }}>{s.t}</h3>
                <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{s.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="z-section" id="formular" style={{ paddingTop: 'var(--space-7)', maxWidth: 780 }}>
          <SectionHead kicker="Poptávka" title="napište nám" />
          <CollabForm />
          <p className="z-data" style={{ marginTop: 'var(--space-5)', textTransform: 'none' }}>
            Placené články jsou na Zaletu vždy viditelně označené jako spolupráce. Redakčním obsahem a porovnáním cen zájezdů se spolupráce nijak neovlivňují.
            Raději e-mailem? Napište na <a href="mailto:info@zaleto.cz?subject=Spolupráce – placený článek">info@zaleto.cz</a>.
          </p>
        </section>
      </main>
    </>
  )
}
