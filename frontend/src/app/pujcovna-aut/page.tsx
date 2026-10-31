import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Icon, { type IconName } from '@/components/ui/Icon'
import SectionHead from '@/components/ui/SectionHead'
import { CarRentalProvider, CarRentalForm, CarRentalResults } from '@/components/CarRentalSearchForm'
import { mergeDestinations } from '@/lib/carRental'
import { fetchDynamicCarDestinations, fetchCarRentalAI } from '@/lib/api'

export const revalidate = 86400

const year = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Půjčovna aut v zahraničí ${year} – srovnání cen | Zaleto`,
  description:
    `Porovnej ceny půjčoven aut ve více než 20 destinacích – Řecko, Turecko, Chorvatsko, Španělsko a další. ` +
    `Vyber si auto snadno a rychle.`,
  alternates: { canonical: 'https://zaleto.cz/pujcovna-aut' },
  openGraph: {
    title: `Půjčovna aut v zahraničí ${year}`,
    description: 'Srovnej ceny půjčoven aut v populárních destinacích. Bez skrytých poplatků.',
    url: 'https://zaleto.cz/pujcovna-aut',
    type: 'website',
    siteName: 'Zaleto',
    locale: 'cs_CZ',
  },
  twitter: { card: 'summary_large_image' },
}

const WHY: { icon: IconName; title: string; text: string }[] = [
  { icon: 'ok', title: 'Cena předem', text: 'Cena při rezervaci je finální, bez skrytých poplatků na přepážce.' },
  { icon: 'info', title: 'Pojištění v ceně', text: 'Základní pojištění CDW i TP bývá zahrnuté, bez doplatku.' },
  { icon: 'cas', title: 'Zrušení zdarma', text: 'Většina nabídek se dá zdarma zrušit až 48 hodin před vyzvednutím.' },
  { icon: 'auto', title: 'Přes 500 půjčoven', text: 'Srovnáváme velké značky i lokální půjčovny.' },
]

const STEPS = [
  { n: '01', title: 'Vyber destinaci', text: 'Klikni na destinaci níže nebo použij vyhledávání.' },
  { n: '02', title: 'Porovnej nabídky', text: 'Uvidíš seřazené nabídky s fotkami aut a cenami.' },
  { n: '03', title: 'Rezervuj online', text: 'Rezervace je okamžitá. Kartu potřebuješ jen jako zálohu na přepážce.' },
]

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `Půjčovna aut v zahraničí ${year}`,
  description: 'Srovnávač cen půjčoven aut v populárních turistických destinacích.',
  url: 'https://zaleto.cz/pujcovna-aut',
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Půjčovna aut', item: 'https://zaleto.cz/pujcovna-aut' },
    ],
  },
}

export default async function PujcovnaAutPage() {
  const dynamicDests = await fetchDynamicCarDestinations().catch(() => [])
  const allDests = mergeDestinations(dynamicDests)

  // Zobrazíme jen destinace s kompletním AI obsahem
  const aiResults = await Promise.all(allDests.map(d => fetchCarRentalAI(d.slug).catch(() => null)))
  const complete = new Set(
    allDests
      .filter((_, i) => {
        const ai = aiResults[i]
        return ai?.airport_info && ai?.monthly_prices?.length === 12 && ai?.trip_tips?.length > 0 && ai?.driving_rules && ai?.faq?.length > 0
      })
      .map(d => d.slug),
  )

  const countries = Array.from(new Map(allDests.map(d => [d.country, true])).keys())
  const byCountry = allDests.reduce<Record<string, typeof allDests>>((acc, d) => {
    if (!complete.has(d.slug)) return acc
    ;(acc[d.country] ??= []).push(d)
    return acc
  }, {})
  const active = countries.filter(c => byCountry[c]?.length > 0)

  return (
    <>
      <JsonLd data={webPageSchema} />
      <Header />

      <CarRentalProvider>
        <section className="z-masthead z-masthead--under" aria-label="Hledání půjčovny aut">
          <div className="z-masthead__photo" style={{ backgroundImage: 'url("/img/header-car.jpg")' }} aria-hidden="true" />
          <svg className="z-masthead__route" viewBox="0 0 1600 360" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-20 330 C 320 340, 520 160, 860 200 S 1300 60, 1640 40" />
          </svg>
          <div className="z-masthead__inner">
            <div className="z-masthead__head">
              <div>
                <div className="z-kicker">Srovnávač půjčoven aut</div>
                <h1 className="z-masthead__title">kam autem<span className="z-dot">.</span></h1>
              </div>
              <p className="z-masthead__lead">
                Porovnáme ceny více než 500 půjčoven. Řecko, Turecko, Chorvatsko a desítky dalších destinací.
              </p>
            </div>
            <CarRentalForm />
          </div>
        </section>

        <main className="z-container">
          <div style={{ marginTop: 'var(--space-6)' }}>
            <CarRentalResults />
          </div>

          <section className="z-section">
            <SectionHead num="01" kicker="Destinace" title="kde si půjčit auto" />
            <div className="z-grid-3w" style={{ rowGap: 'var(--space-6)' }}>
              {active.map(country => (
                <div key={country}>
                  <h3 className="h3" style={{ marginBottom: 'var(--space-3)' }}>{country}<span className="z-dot">.</span></h3>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    {byCountry[country].map(d => (
                      <li key={d.slug}>
                        <Link className="z-chip" href={`/pujcovna-aut/${d.slug}`} style={{ textDecoration: 'none' }}>{d.name}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="z-section">
            <SectionHead num="02" kicker="Jak to funguje" title="rezervace ve třech krocích" />
            <div className="z-grid-3">
              {STEPS.map(s => (
                <div key={s.n} className="z-info">
                  <div className="z-kicker" style={{ color: 'var(--brand-strong)' }}>{s.n}</div>
                  <h3 className="z-info__title" style={{ margin: 'var(--space-3) 0' }}>{s.title}</h3>
                  <p style={{ margin: 0 }}>{s.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="z-section">
            <SectionHead num="03" kicker="Proč přes Zaleto" title="co dostaneš" />
            <dl className="z-info__grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {WHY.map(w => (
                <div key={w.title} className="z-info__item" style={{ background: 'var(--raised)' }}>
                  <Icon name={w.icon} />
                  <dt>{w.title}</dt>
                  <dd style={{ font: '400 15px/24px var(--font-sans)' }}>{w.text}</dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
      </CarRentalProvider>
    </>
  )
}
