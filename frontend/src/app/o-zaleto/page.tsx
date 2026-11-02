import type { Metadata } from 'next'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import Icon, { type IconName } from '@/components/ui/Icon'
import Button from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Co je Zaleto?',
  description: 'Zaleto je český srovnávač leteckých zájezdů a cestovní deník. Nabídky předních cestovních kanceláří na jednom místě.',
  alternates: { canonical: 'https://zaleto.cz/o-zaleto' },
  openGraph: {
    title: 'Co je Zaleto? | Srovnávač zájezdů',
    description: 'Zaleto agreguje nabídky leteckých zájezdů od českých CK. Porovnej ceny, termíny a rezervuj přímo u cestovní kanceláře.',
    url: 'https://zaleto.cz/o-zaleto',
    type: 'website',
  },
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Zaleto',
  url: 'https://zaleto.cz',
  description: 'Zaleto je český srovnávač leteckých zájezdů od předních cestovních kanceláří.',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: 'https://zaleto.cz/zajezdy?destination={search_term_string}' },
    'query-input': 'required name=search_term_string',
  },
}

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'hledat', title: 'Vyhledávání na jednom místě', desc: 'Prohledáme nabídky českých cestovních kanceláří najednou. Nemusíš procházet desítky webů.' },
  { icon: 'filtr', title: 'Srovnání cen a termínů', desc: 'U každého hotelu vidíš všechny termíny, délky pobytu a stravování seřazené od nejlevnějšího.' },
  { icon: 'ok', title: 'Rezervace přímo u CK', desc: 'Nezprostředkováváme platby ani data. Po kliknutí tě přesměrujeme na web cestovní kanceláře.' },
  { icon: 'cas', title: 'Aktuální data', desc: 'Ceny a dostupnost pravidelně stahujeme ze zdrojů CK, aby byly výsledky co nejpřesnější.' },
]

const STEPS = [
  { t: 'Zadej destinaci a termín', d: 'Hledej podle destinace, data odletu, počtu nocí nebo stravování.' },
  { t: 'Porovnej výsledky', d: 'U každého hotelu vidíš ceny od více cestovních kanceláří.' },
  { t: 'Otevři detail hotelu', d: 'Fotky, vybavení, recenze a všechny dostupné termíny s cenami.' },
  { t: 'Rezervuj přímo u CK', d: 'Klikni na termín a rezervaci dokončíš na webu cestovní kanceláře.' },
]

export default function OZaletoPage() {
  return (
    <>
      <JsonLd data={websiteSchema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'O Zaleto' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="O projektu" title="co je zaleto" />
        <p className="lead" style={{ maxWidth: 'var(--article-max)', marginBottom: 'var(--space-7)' }}>
          Zaleto je český vyhledávač zájezdů a cestovní deník. Agregujeme nabídky leteckých zájezdů od českých cestovních kanceláří
          a ukazujeme je přehledně na jednom místě, abys ušetřil čas a našel tu nejlepší dovolenou.
        </p>

        <div className="z-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {FEATURES.map(f => (
            <div key={f.title} className="z-info__item" style={{ background: 'var(--raised)', boxShadow: 'var(--shadow-ticket)' }}>
              <Icon name={f.icon} />
              <h2 className="h4" style={{ margin: 'var(--space-2) 0' }}>{f.title}</h2>
              <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{f.desc}</p>
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

        <section className="z-section" id="jak-pracujeme">
          <SectionHead kicker="Důvěra" title="jak pracujeme s daty" />
          <div className="z-prose" style={{ maxWidth: 'var(--article-max)' }}>
            <p><strong>Odkud jsou ceny.</strong> Nabídky, termíny a ceny stahujeme z webů českých cestovních kanceláří a ukládáme je do vlastní databáze. Cena, kterou u hotelu vidíš, je nejnižší aktuálně nalezená cena za osobu; konečnou cenu a podmínky vždy potvrdí cestovní kancelář před rezervací.</p>
            <p><strong>Jak řadíme.</strong> Výsledky jsou ve výchozím nastavení řazené podle ceny od nejlevnější. Pořadí neovlivňuje to, kolik bychom na nabídce vydělali.</p>
            <p><strong>Jak vznikají texty.</strong> Shrnutí hotelů, průvodce destinacemi a přehledy zájezdů připravuje redakce Zaleto z údajů cestovních kanceláří a z našich vlastních dat (ceny, počty termínů, měsíční ceny). Nic si nevymýšlíme: vybavení, vzdálenosti a ceny bereme jen z uvedených údajů a u textů uvádíme datum aktualizace. Pokud najdeš chybu, napiš nám na <a href="mailto:info@zaleto.cz">info@zaleto.cz</a>, opravíme ji.</p>
            <p><strong>Jak se financujeme.</strong> Odkazy na cestovní kanceláře mohou být partnerské: pokud přes ně zarezervuješ, můžeme získat provizi. Cena pro tebe se tím nemění.</p>
          </div>
        </section>

        <section className="z-section" id="provozovatel">
          <SectionHead kicker="Provozovatel" title="kdo za tím stojí" />
          <div className="z-prose" style={{ maxWidth: 'var(--article-max)' }}>
            <p>Zaleto provozuje Bc. Dominik Medal, IČO 17271541, Majerského 2032/9, 149 00 Praha 4 – Chodov. Kontakt: <a href="mailto:info@zaleto.cz">info@zaleto.cz</a> nebo <a href="/kontakt">kontaktní formulář</a>.</p>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-8)' }}>
          <Button href="/zajezdy">Najít zájezd</Button>
          <Button href="/kontakt" variant="line">Kontakt</Button>
        </div>
      </main>
    </>
  )
}
