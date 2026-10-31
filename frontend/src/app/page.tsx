import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import SectionHead from '@/components/ui/SectionHead'
import SearchBox from '@/components/ui/SearchBox'
import TourCard from '@/components/ui/TourCard'
import TourAd from '@/components/ui/TourAd'
import StoryCard from '@/components/ui/StoryCard'
import WindowCard from '@/components/ui/WindowCard'
import { formatPrice } from '@/components/ui/format'
import { fetchArticles, fetchDestinationPhoto, fetchDestinations, fetchHotels } from '@/lib/api'
import { slugify } from '@/lib/slugify'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Zaleto — zájezdy a auta na jednom místě | srovnání cen',
  description: 'Zajímavosti o místech, články z cest, zájezdy od českých cestovních kanceláří a půjčení auta. Přehledně, na jednom místě.',
  alternates: { canonical: 'https://zaleto.cz' },
  openGraph: {
    title: 'Zaleto — kam letos',
    description: 'Zájezdy od českých cestovních kanceláří a auta na dovolenou. Ceny porovnáme za tebe.',
    url: 'https://zaleto.cz',
    type: 'website',
  },
}

const siteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Zaleto',
  url: 'https://zaleto.cz',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: 'https://zaleto.cz/zajezdy?destination={search_term_string}' },
    'query-input': 'required name=search_term_string',
  },
}

/** Kurátorovaný výběr zemí pro sekci 01 (jen ty, které mají aktuální nabídku, se zobrazí). */
const POPULAR = ['Řecko', 'Turecko', 'Egypt', 'Španělsko', 'Chorvatsko', 'Kypr', 'Bulharsko', 'Tunisko', 'Itálie', 'Portugalsko', 'Maledivy', 'Thajsko', 'Spojené arabské emiráty', 'Mexiko']
/** Fotky hotelů od CK jsou jen záloha – v sekci destinací chceme skutečné fotky destinací. */
const isHotelPhoto = (u: string | null) => !u || /content4travel\.com/.test(u)

export default async function HomePage() {
  const [destinations, articles, lastMinute, cheapest] = await Promise.all([
    fetchDestinations().catch(() => []),
    fetchArticles(4).catch(() => []),
    fetchHotels({ tour_type: 'last_minute', sort: 'price_asc', limit: 12 }).then(r => r.hotels).catch(() => []),
    fetchHotels({ sort: 'price_asc', limit: 12 }).then(r => r.hotels).catch(() => []),
  ])

  // Počet hotelů v zemi
  const byCountry = new Map<string, number>()
  for (const d of destinations) if (d.country) byCountry.set(d.country, (byCountry.get(d.country) ?? 0) + d.hotel_count)
  // kurátorovaný výběr napřed, dál další země podle počtu hotelů; zobrazí se ty, které mají skutečnou fotku destinace
  const rest = [...byCountry.entries()].filter(([c]) => !POPULAR.includes(c)).sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const candidates = [...POPULAR.filter(c => byCountry.has(c)), ...rest].slice(0, 30)
  const candidatePhotos = await Promise.all(candidates.map(c => fetchDestinationPhoto(c)))
  const picked = candidates.map((c, i) => ({ c, photo: candidatePhotos[i] })).filter(x => !isHotelPhoto(x.photo)).slice(0, 12)
  const countries = picked.map(x => x.c)
  const photos = picked.map(x => x.photo)

  // Lístky: nejdřív last minute, doplněné nejlevnějšími; jen s fotkou
  const withPhoto = (hs: typeof cheapest) => hs.filter(h => h.thumbnail_url)
  const seen = new Set<string>()
  const deals = [...withPhoto(lastMinute), ...withPhoto(cheapest)].filter(h => !seen.has(h.slug) && seen.add(h.slug)).slice(0, 4)
  const ad = deals[3] ?? null
  const tickets = deals.slice(0, 3)
  const heroHotel = deals[0] ?? null

  const [lead, ...restStories] = articles

  return (
    <>
      <JsonLd data={siteSchema} />
      <Header />

      <main>
        <section className="z-masthead z-masthead--under" aria-label="Hledání zájezdu">
          <div className="z-masthead__photo" style={{ backgroundImage: 'url("/img/header-car.jpg")' }} aria-hidden="true" />
          <span className="z-masthead__sun" aria-hidden="true" />
          <svg className="z-masthead__route" viewBox="0 0 1600 360" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-20 330 C 320 340, 520 160, 860 200 S 1300 60, 1640 40" />
          </svg>
          <div className="z-masthead__inner">
            <div className="z-masthead__head">
              <div>
                <div className="z-kicker">Srovnávač zájezdů a půjčoven aut</div>
                <h1 className="z-masthead__title">zájezdy a auta na jednom místě<span className="z-dot">.</span></h1>
              </div>
              <p className="z-masthead__lead">
                Ceny od českých cestovních kanceláří a půjčoven aut porovnáme za tebe. Rezervuješ přímo u nich.
                {heroHotel && (
                  <>
                    {' '}
                    <Link href={`/hotel/${heroHotel.slug}`} className="z-masthead__tip">
                      Tip týdne: {heroHotel.resort_town ?? heroHotel.country} od {formatPrice(heroHotel.min_price)}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <SearchBox />
          </div>
        </section>

        <div className="z-sheet">

        {countries.length > 0 && (
          <section className="z-container z-section">
            <SectionHead num="01" kicker="Destinace" title="kam za sluncem" moreHref="/destinace" moreLabel="Všechny destinace" />
            <div className="z-grid-4 z-windows z-windows--sm">
              {countries.map((c, i) => (
                <WindowCard
                  key={c}
                  href={`/destinace/${slugify(c)}`}
                  name={c}
                  photo={photos[i]}
                  count={byCountry.get(c)}
                  countLabel="hotelů"
                />
              ))}
            </div>
          </section>
        )}

        {lead && (
          <section className="z-container z-section">
            <SectionHead num="02" kicker="Čerstvě z cest" title="čerstvě z cest" moreHref="/clanky" moreLabel="Všechny články" />
            <StoryCard article={lead} lead />
            {restStories.length > 0 && (
              <div className="z-grid-3w" style={{ marginTop: 24 }}>
                {restStories.map(a => <StoryCard key={a.slug} article={a} />)}
              </div>
            )}
          </section>
        )}

        {tickets.length > 0 && (
          <section className="z-section--deep">
            <div className="z-container">
              <SectionHead num="03" kicker="Zájezdy" title="zájezdy" moreHref="/zajezdy" moreLabel="Zobrazit vše" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-5)', alignItems: 'stretch' }}>
                {tickets.map((h, i) => <TourCard key={h.slug} hotel={h} priority={i === 0} />)}
                {ad && <div style={{ display: 'flex' }}><div style={{ width: '100%' }}><TourAd hotel={ad} /></div></div>}
              </div>
            </div>
          </section>
        )}
        </div>
      </main>
    </>
  )
}
