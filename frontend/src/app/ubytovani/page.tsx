import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Icon from '@/components/ui/Icon'
import SectionHead from '@/components/ui/SectionHead'
import BookingSearchForm from '@/components/BookingSearchForm'
import WeekendTips from '@/components/WeekendTips'
import { fetchDestinations } from '@/lib/api'
import { buildBookingUrl, bookingClick, defaultStay } from '@/lib/booking'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Ubytování – hotely a apartmány za nejlepší ceny',
  description: 'Chceš jet na vlastní pěst? Najdi hotely, apartmány a vily v oblíbených destinacích.',
  alternates: { canonical: 'https://zaleto.cz/ubytovani' },
  openGraph: {
    title: 'Ubytování – hotely a apartmány', description: 'Vyhledej ubytování v oblíbených destinacích.',
    url: 'https://zaleto.cz/ubytovani', type: 'website', siteName: 'Zaleto', locale: 'cs_CZ',
  },
}

const webPageSchema = {
  '@context': 'https://schema.org', '@type': 'WebPage', name: 'Ubytování', url: 'https://zaleto.cz/ubytovani',
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Ubytování', item: 'https://zaleto.cz/ubytovani' },
    ],
  },
}

export default async function UbytovaniPage() {
  const rows = await fetchDestinations().catch(() => [])
  // země s největším počtem hotelů v nabídce, u každé nejvíc nabízená letoviska
  const byCountry = new Map<string, { count: number; towns: Map<string, number> }>()
  for (const r of rows) {
    if (!r.country) continue
    const c = byCountry.get(r.country) ?? { count: 0, towns: new Map() }
    c.count += r.hotel_count
    const town = r.resort_town || r.destination
    if (town) c.towns.set(town, (c.towns.get(town) ?? 0) + r.hotel_count)
    byCountry.set(r.country, c)
  }
  const countries = [...byCountry.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12)
  const stay = defaultStay()
  const link = (ss: string) => bookingClick(buildBookingUrl({ ss, ...stay }), 'ubytovani')

  return (
    <>
      <JsonLd data={webPageSchema} />
      <Header />

      <section className="z-masthead z-masthead--under" aria-label="Hledání ubytování">
        <div className="z-masthead__photo" aria-hidden="true" />
        <svg className="z-masthead__route" viewBox="0 0 1600 360" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-20 330 C 320 340, 520 160, 860 200 S 1300 60, 1640 40" />
        </svg>
        <div className="z-masthead__inner">
          <div className="z-masthead__head">
            <div>
              <div className="z-kicker">Hotely a apartmány</div>
              <h1 className="z-masthead__title">chci jen ubytování<span className="z-dot">.</span></h1>
            </div>
            <p className="z-masthead__lead">Jedeš na vlastní pěst? Vyber destinaci a termín a najdeme ti ubytování.</p>
          </div>
          <div className="z-search__tabs" role="tablist" aria-label="Co hledáš">
            <Link href="/" role="tab" className="z-search__tab" aria-selected="false"><Icon name="letadlo" size="sm" />Zájezdy</Link>
            <span role="tab" className="z-search__tab" aria-selected="true"><Icon name="hotel" size="sm" />Ubytování</span>
            <Link href="/pujcovna-aut" role="tab" className="z-search__tab" aria-selected="false"><Icon name="auto" size="sm" />Půjčovna aut</Link>
          </div>
          <BookingSearchForm />
        </div>
      </section>

      <div className="z-sheet">
        <main className="z-container">
          <WeekendTips bare placement="ubytovani-vikend" />
          {countries.length > 0 && (
            <section className="z-section z-section--tight">
              <SectionHead title="oblíbené destinace" />
              <div className="z-grid-3w" style={{ rowGap: 'var(--space-6)' }}>
                {countries.map(([country, c]) => (
                  <div key={country}>
                    <h3 className="h3" style={{ marginBottom: 'var(--space-3)' }}>
                      <a href={link(country)} target="_blank" rel="noopener noreferrer sponsored" style={{ color: 'inherit', textDecoration: 'none' }}>{country}</a>
                      <span className="z-dot">.</span>
                    </h3>
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {[...c.towns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([town]) => (
                        <li key={town}>
                          <a className="z-chip" href={link(`${town}, ${country}`)} target="_blank" rel="noopener noreferrer sponsored" style={{ textDecoration: 'none' }}>{town}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  )
}
