import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import Icon from '@/components/ui/Icon'
import InfiniteHotels from '@/components/InfiniteHotels'
import TourAd from '@/components/ui/TourAd'
import StoryCard from '@/components/ui/StoryCard'
import NavTabs, { type NavTabItem } from '@/components/ui/NavTabs'
import { PlaceTickets, FoodMenu, TripRoute } from '@/components/ui/ItemCard'
import { fetchDestinations, fetchWikiSummary, fetchDestinationPhoto, fetchDestinationPhotoCredit, fetchDestinationAI, fetchHotels, fetchArticles } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { resolveDestination } from './resolve'
import OfferStrip, { pickOffers } from '@/components/ui/OfferStrip'
import { destinationGallery } from '@/server/content'
import { loadGuide } from './guideData'
import { GUIDE_SECTIONS, sectionCount } from '@/lib/guideSections'
import { approvedTravelogues } from '@/server/travelogues'
import TravelogueCard from '@/components/ui/TravelogueCard'
import HotelsAreaMap from '@/components/HotelsAreaMap'
import PhotoGallery from '@/components/PhotoGallery'
import { FactsStrip, GuideHub } from '@/components/ui/GuideSections'
import { mergeDestinations } from '@/lib/carRental'
import { fetchDynamicCarDestinations } from '@/lib/api'

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const destinations = await fetchDestinations()
    const seen = new Set<string>()
    const params: { slug: string }[] = []
    const add = (name: string | null | undefined) => {
      if (!name) return
      const s = slugify(name)
      if (s && !seen.has(s)) { seen.add(s); params.push({ slug: s }) }
    }
    for (const d of destinations) {
      add(d.country)
      add(d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim())
      add(d.resort_town)
    }
    return params
  } catch {
    return []
  }
}

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dest = await resolveDestination(params.slug)
  if (!dest) return { title: 'Destinace nenalezena | Zaleto' }

  const year = new Date().getFullYear()
  const wiki = await fetchWikiSummary(dest.name).catch(() => null)
  const name = wiki?.title ?? dest.name
  const description = wiki
    ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    : `Porovnej zájezdy do destinace ${name} od českých cestovních kanceláří.`
  const canonical = `https://zaleto.cz/destinace/${params.slug}`
  const title = `Zájezdy ${name} ${year} — srovnání cen CK | Zaleto`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `Zájezdy ${name} ${year} | Zaleto`, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const LIMIT = 24
const SORTS: [string, string][] = [['price_asc', 'Nejlevnější'], ['date_asc', 'Nejbližší'], ['stars_desc', 'Nejlepší hotely']]

type Item = { name: string; description: string }

function Block({ id, kicker, title, className, children }: { id: string; kicker: string; title: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} data-rail={kicker} className={`z-cardest__block${className ? " " + className : ""}`}>
      <div className="z-shead" style={{ marginBottom: 'var(--space-5)' }}>
        <div>
          <div className="z-kicker">{kicker}</div>
          <h2 style={{ fontSize: 32, lineHeight: '38px' }}>{title}<span className="z-dot">.</span></h2>
        </div>
      </div>
      {children}
    </section>
  )
}

export default async function DestinacePage({ params, searchParams }: Props & { searchParams: { page?: string; sort?: string } }) {
  const dest = await resolveDestination(params.slug)
  if (!dest) notFound()

  const sort = SORTS.some(([v]) => v === searchParams.sort) ? (searchParams.sort as string) : 'price_asc'

  const [destAI, heroPhoto, result, articles, gallery] = await Promise.all([
    fetchDestinationAI(dest.name).catch(() => null),
    fetchDestinationPhotoCredit(dest.name).then(async r => (r.url ? r : dest.country && dest.country !== dest.name ? fetchDestinationPhotoCredit(dest.country) : r)),
    fetchHotels({ destination: dest.name, sort, page: 1, limit: LIMIT }).catch(() => null),
    fetchArticles(3, dest.name).catch(() => []),
    destinationGallery(dest.name, dest.country).catch(() => []),
  ])

  const tripSlugs = [slugify(dest.name), ...(dest.type === 'town' && dest.breadcrumb.length >= 3 ? [slugify(dest.breadcrumb[1].label)] : [])]
  const logs = await approvedTravelogues({ destSlugs: tripSlugs, limit: 6 })

  const { guide } = await loadGuide(dest)
  const hubCount = guide ? GUIDE_SECTIONS.filter(x => sectionCount(guide, x.field) > 0).length : 0

  const aiText = destAI?.description && destAI.description.length >= 20 ? destAI.description : null
  const wiki = aiText ? null : await fetchWikiSummary(dest.name).catch(() => null)
  const paragraphs = aiText
    ? aiText.split(/\n\n+/)
    : wiki ? [wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ')] : []
  const title = wiki?.title ?? dest.name

  const hotels = result?.hotels ?? []
  const pg = result?.pagination
  const adHotel = hotels.find(h => h.thumbnail_url) ?? null

  const places = destAI?.places ?? []
  const food = destAI?.food ?? []
  const trips = [...(destAI?.trips ?? []), ...(destAI?.excursions ?? [])]
  const bestTime = destAI?.best_time ?? null

  const weatherUrl = dest.type === 'country'
    ? `/pocasi/${slugify(dest.name)}`
    : dest.country ? `/pocasi/${slugify(dest.country)}/${slugify(dest.name)}` : null

  // Půjčovna aut: rovnou na odpovídající destinaci (u země na nejpopulárnější místo v ní)
  const carDests = mergeDestinations(await fetchDynamicCarDestinations().catch(() => []))
  const norm = (v: string | null | undefined) => slugify(v ?? '')
  const carMatch = dest.type === 'country'
    ? carDests.find(d => norm(d.country) === norm(dest.name) && d.popular) ?? carDests.find(d => norm(d.country) === norm(dest.name))
    : carDests.find(d => norm(d.name) === norm(dest.name)) ?? carDests.find(d => d.slug === norm(dest.name))
  const carUrl = carMatch ? `/pujcovna-aut/${carMatch.slug}` : '/pujcovna-aut'

  const heroId = heroPhoto?.url?.split('?')[0]
  const photos = gallery.filter(g => g.url.split("?")[0] !== heroId).slice(0, 5)

  // minináhledy v záhlaví: pár fotek z galerie, rozházené (stabilně podle slugu, ať se mezi načteními nemění)
  let seed = 0
  for (const ch of params.slug) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const thumbs = photos.length >= 3
    ? photos.slice(0, 4).map(p => ({ url: p.url, rot: Math.round((rnd() * 14 - 7) * 10) / 10, dy: Math.round(rnd() * 14 - 7) }))
    : []

  const tabs: NavTabItem[] = [
    ...(paragraphs.length > 1 ? [{ href: '#o-destinaci', label: 'O destinaci', icon: 'kompas' as const }] : []),
    ...(bestTime ? [{ href: '#kdy-jet', label: 'Kdy jet', icon: 'kalendar' as const }] : []),
    ...(places.length ? [{ href: '#co-videt', label: 'Co vidět', icon: 'poloha' as const }] : []),
    ...(food.length ? [{ href: '#jidlo', label: 'Jídlo', icon: 'jidlo' as const }] : []),
    ...(trips.length ? [{ href: '#vylety', label: 'Výlety', icon: 'trasa' as const }] : []),
    ...(hubCount ? [{ href: '#pruvodce', label: 'Průvodce', icon: 'mapa' as const }] : []),
    ...(photos.length >= 3 ? [{ href: '#fotky', label: 'Fotky', icon: 'foto' as const }] : []),
    { href: '#zajezdy', label: 'Zájezdy', icon: 'letadlo' as const },
    ...((pg?.total ?? 0) > 0 ? [{ href: `/destinace/${params.slug}/hotely`, label: 'Hotely', icon: 'hotel' as const }] : []),
    ...(logs.length ? [{ href: '#cestopisy', label: 'Cestopisy', icon: 'trasa' as const }] : []),
    ...(articles.length ? [{ href: '#clanky', label: 'Články', icon: 'clanek' as const }] : []),
    ...(weatherUrl ? [{ href: weatherUrl, label: 'Počasí', icon: 'slunce' as const }] : []),
    { href: carUrl, label: 'Půjčovna aut', icon: 'auto' as const },
  ]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...dest.breadcrumb.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.label, item: `https://zaleto.cz${c.href}` })),
    ],
  }

  const hasLong = !!(paragraphs.length > 1 || bestTime || places.length || food.length || trips.length)

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <Header />

      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Destinace', href: '/destinace' }, ...dest.breadcrumb]} />

        <div className="z-cardest">
          <div>
            <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>
              Destinace{dest.country && dest.country !== dest.name ? ` · ${dest.country}` : ''}
            </div>
            <h1 className="h1" style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>{title}<span className="z-dot">.</span></h1>
            {paragraphs[0] && <p className="lead" style={{ margin: 0 }}>{paragraphs[0]}</p>}
            <div className="z-meta" style={{ marginTop: 'var(--space-5)', fontSize: 15 }}>
              {pg ? <span><Icon name="hotel" />{pg.total} hotelů s termínem</span> : null}
              {weatherUrl ? <span><Icon name="slunce" /><Link href={weatherUrl} style={{ color: 'inherit' }}>Počasí a klima</Link></span> : null}
            </div>
          </div>
          {heroPhoto?.url && (
            <div className="z-cardest__media" data-thumbs={thumbs.length > 0 || undefined}>
              <div className="z-cardest__photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroPhoto.url} alt={dest.name} />
                {heroPhoto.credit && (
                  <span className="z-photocredit">Foto: <a href={heroPhoto.creditUrl ?? 'https://unsplash.com'} target="_blank" rel="noopener noreferrer">{heroPhoto.credit}</a> / <a href="https://unsplash.com/?utm_source=zaleto&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></span>
                )}
              </div>
              {thumbs.length > 0 && (
                <a href="#fotky" className="z-herothumbs" aria-label={`Zobrazit všech ${photos.length + 1} fotografií`}>
                  {thumbs.map((t, i) => (
                    <span key={t.url} className="z-herothumbs__item" style={{ transform: `rotate(${t.rot}deg) translateY(${t.dy}px)`, zIndex: i + 1 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.url} alt="" loading="lazy" />
                    </span>
                  ))}
                  <span className="z-herothumbs__more"><Icon name="foto" />+{photos.length} fotek</span>
                </a>
              )}
            </div>
          )}
        </div>

        <NavTabs items={tabs} />

        <div className="z-stripwrap"><OfferStrip hotels={pickOffers(hotels)} /></div>

        {hasLong && (
          <div className="z-cardest__grid">
            <div className="z-cardest__main">
              {paragraphs.length > 1 && (
                <Block id="o-destinaci" kicker="O destinaci" title={`o místě: ${dest.name}`}>
                  <div className="z-prose">{paragraphs.slice(1).map((p, i) => <p key={i}>{p}</p>)}</div>
                </Block>
              )}
              {bestTime && (
                <Block id="kdy-jet" kicker="Kdy jet" title="nejlepší doba na cestu">
                  <div className="z-prose">{bestTime.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
                  {weatherUrl && <p style={{ marginTop: 'var(--space-4)' }}><Link className="z-more" href={weatherUrl}>Počasí po měsících</Link></p>}
                </Block>
              )}
              {places.length > 0 && <Block id="co-videt" kicker="Co vidět" title="místa, která stojí za to"><PlaceTickets items={places} /></Block>}
              {food.length > 0 && <Block id="jidlo" kicker="Jídlo" title="co ochutnat"><FoodMenu items={food} /></Block>}
              {trips.length > 0 && <Block id="vylety" kicker="Výlety" title="výlety z místa"><TripRoute items={trips} /></Block>}
            </div>

            <aside className="z-cardest__side">
              {adHotel && <TourAd hotel={adHotel} sticky kicker="Dnešní tip pro Tebe" />}
            </aside>
          </div>
        )}

        {guide && hubCount > 0 && (
          <>
            {guide.facts.length > 0 && <FactsStrip facts={guide.facts} />}
            <Block id="pruvodce" kicker="Průvodce" title={`průvodce: ${dest.name}`} className="z-cardest__block--gallery">
              <GuideHub guide={guide} base={`/destinace/${params.slug}`} />
            </Block>
          </>
        )}

        {photos.length >= 3 && (
          <Block id="fotky" kicker="Fotky" title="pár fotek z destinace" className="z-cardest__block--gallery">
            <PhotoGallery photos={photos} name={dest.name} />
          </Block>
        )}

        <section id="zajezdy" data-rail="Zájezdy" className="z-section" style={{ scrollMarginTop: 'calc(var(--header-height) + 56px)' }}>
          <div className="z-shead">
            <div>
              <div className="z-kicker">Zájezdy</div>
              <h2>zájezdy: {dest.name}<span className="z-dot">.</span></h2>
            </div>
            <nav aria-label="Řazení" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {SORTS.map(([v, l]) => (
                <Link
                  key={v}
                  href={`/destinace/${params.slug}${v === 'price_asc' ? '' : `?sort=${v}`}#zajezdy`}
                  className="z-chip"
                  aria-current={sort === v ? 'true' : undefined}
                  style={{ textDecoration: 'none', ...(sort === v ? { background: 'var(--ink)', color: 'var(--paper)' } : {}) }}
                >{l}</Link>
              ))}
            </nav>
          </div>
          {hotels.length > 0 && <HotelsAreaMap destination={dest.name} sort={sort} showPrice collapsible />}
          {hotels.length === 0 ? (
            <p className="body">Pro tuto destinaci teď nemáme žádný volný termín.</p>
          ) : (
            <InfiniteHotels key={sort} initial={hotels} total={pg?.total ?? hotels.length} limit={LIMIT} query={{ destination: dest.name, sort }} />
          )}
        </section>

        <section id="cestopisy" data-rail="Cestopisy" className="z-section" style={{ scrollMarginTop: 'calc(var(--header-height) + 56px)' }}>
          <div className="z-shead">
            <div>
              <div className="z-kicker">Od čtenářů</div>
              <h2>cestopisy: {dest.name}<span className="z-dot">.</span></h2>
            </div>
            <Link className="z-more" href="/cestopisy/napsat">Napsat cestopis</Link>
          </div>
          {logs.length > 0
            ? <div className="z-grid-3w">{logs.map(t => <TravelogueCard key={t.slug} t={t} />)}</div>
            : <p className="body">Byl jsi tu? <Link href="/cestopisy/napsat" className="z-more">Napiš první cestopis</Link></p>}
        </section>

        {articles.length > 0 && (
          <section id="clanky" data-rail="Články" className="z-section" style={{ scrollMarginTop: 'calc(var(--header-height) + 56px)' }}>
            <div className="z-shead">
              <div>
                <div className="z-kicker">Z cest</div>
                <h2>čerstvě z cest: {dest.name}<span className="z-dot">.</span></h2>
              </div>
              <Link className="z-more" href="/clanky">Všechny články</Link>
            </div>
            <div className="z-grid-3w">{articles.map(a => <StoryCard key={a.slug} article={a} />)}</div>
          </section>
        )}
      </main>
    </>
  )
}
