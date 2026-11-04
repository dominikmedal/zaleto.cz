import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import HotelGallery from '@/components/HotelGallery'
import FavoriteButton from '@/components/FavoriteButton'
import ShareButton from '@/components/ShareButton'
import ScrollToButton from '@/components/ScrollToButton'
import HotelMobileCta from '@/components/HotelMobileCta'
import TourDatesList from '@/components/TourDatesList'
import TourModalTrigger from '@/components/TourModalTrigger'
import ReviewsSection from '@/components/ReviewsSection'
import WeatherWidget from '@/components/WeatherWidget'
import CollapsibleSection from '@/components/CollapsibleSection'
import AgencyDescriptionSwitcher from '@/components/AgencyDescriptionSwitcher'
import CarRentalBanner from '@/components/CarRentalBanner'
import { buildBookingUrl, bookingClick, defaultStay } from '@/lib/booking'
import Crumbs from '@/components/ui/Crumbs'
import Icon from '@/components/ui/Icon'
import TourCard from '@/components/ui/TourCard'
import { airportCode, formatDateRange, formatPrice } from '@/components/ui/format'
import { fetchHotel, fetchHotels, fetchHotelTours, fetchNearbyHotels, fetchHotelAI, fetchLandingList, fetchArticles, fetchLinkTargets, API } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { Paragraphs, AudienceList, FaqList, AiNote, LinkList, faqSchema } from '@/components/ui/SeoBlocks'
import { Linked, weatherAutoLinks } from '@/lib/autolink'
import type { Hotel, Tour } from '@/lib/types'

// Leaflet potřebuje prohlížeč → dynamický import bez SSR
const HotelMap = dynamic(() => import('@/components/HotelMap'), { ssr: false })

export const revalidate = 60
export const dynamicParams = true

export async function generateStaticParams() {
  // Předgenerujeme jen pár nejlevnějších hotelů; zbytek vzniká on-demand (ISR).
  try {
    const { fetchAllHotelSlugs } = await import('@/lib/api')
    return (await fetchAllHotelSlugs(40)).map(s => ({ slug: s.slug }))
  } catch {
    return []
  }
}

interface Props { params: { slug: string } }

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.map((s: string) => String(s).trim()).filter(Boolean)
  } catch { /* není JSON */ }
  return raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
}

function parseFoodOptions(raw: string): { label: string; price: string | null }[] {
  return raw.split('|').map(s => {
    const trimmed = s.trim().replace(/(\d+)\.0\b/g, (_, n) => Number(n).toLocaleString('cs-CZ'))
    const m = trimmed.match(/^(.+?)\s+([\d\s]+\s*Kč.*)$/)
    return m ? { label: m[1].trim(), price: m[2].trim() } : { label: trimmed, price: null }
  }).filter(r => r.label)
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let hotel: Hotel
  try { hotel = await fetchHotel(params.slug) } catch { return { title: 'Hotel nenalezen' } }
  const place = [hotel.resort_town, hotel.country].filter(Boolean).join(', ')
  const price = hotel.min_price ? ` od ${formatPrice(hotel.min_price)}` : ''
  const title = `${hotel.name}${place ? ` — ${place}` : ''}${price}`
  // redakční text (AI z dat) je unikátní, popis od CK mají i konkurenční weby
  const ai = await fetchHotelAI(hotel.canonical_slug ?? hotel.slug)
  const aiFirst = ai?.summary.split(/\n\s*\n/)[0]
  const description = aiFirst
    ? (aiFirst.length > 158 ? `${aiFirst.slice(0, 157).replace(/\s+\S*$/, '')}…` : aiFirst)
    : hotel.description
    ? stripHtml(hotel.description).slice(0, 160)
    : `Zájezdy do hotelu ${hotel.name}${place ? ` (${place})` : ''}. Porovnej termíny a ceny od českých cestovních kanceláří.`
  const canonical = `https://zaleto.cz/hotel/${hotel.canonical_slug ?? params.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    // obrázek pro sdílení generuje opengraph-image.tsx (název, cena a fotka hotelu)
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function HotelDetailPage({ params }: Props) {
  let hotel: Hotel
  try { hotel = await fetchHotel(params.slug) } catch { notFound() }

  const photos: string[] = (() => {
    const arr = parseList(hotel.photos)
    return arr.length ? arr : hotel.thumbnail_url ? [hotel.thumbnail_url] : []
  })()
  const amenities = parseList(hotel.amenities)
  const distances = hotel.distances ? hotel.distances.split('|').map(s => s.trim()).filter(Boolean) : []
  const priceIncludes = hotel.price_includes ? hotel.price_includes.split('|').map(s => s.trim()).filter(Boolean) : []
  const descriptions = (hotel.agencyDescriptions?.length ?? 0) > 0
    ? hotel.agencyDescriptions!
    : hotel.description ? [{ agency: hotel.agency, description: hotel.description }] : []

  const ai = await fetchHotelAI(hotel.canonical_slug ?? hotel.slug)
  const aiFaqSchema = ai ? faqSchema(ai.faq) : null
  const tourCount = hotel.available_dates ?? 0
  const dates = formatDateRange(hotel.next_departure, hotel.next_return_date)
  const place = [hotel.resort_town, hotel.country].filter(Boolean).join(' · ')
  const crumbs = [
    { label: 'Zaleto', href: '/' },
    ...(hotel.country ? [{ label: hotel.country, href: `/destinace/${slugify(hotel.country)}` }] : []),
    ...(hotel.resort_town && hotel.resort_town !== hotel.country ? [{ label: hotel.resort_town, href: `/destinace/${slugify(hotel.resort_town)}` }] : []),
    { label: hotel.name },
  ]

  const weatherRegion = hotel.destination?.split('/')[1]?.trim()
  const weatherUrl = hotel.country
    ? weatherRegion ? `/pocasi/${slugify(hotel.country)}/${slugify(weatherRegion)}` : `/pocasi/${slugify(hotel.country)}`
    : null

  // Vnitřní odkazy v textech: střediska a oblasti → průvodci, slova o počasí → počasí místa
  const textLinks = ai ? [...(await fetchLinkTargets()), ...weatherAutoLinks(weatherUrl)] : []

  // do strukturovaných dat jen absolutní adresy (až 6 různých fotek)
  const schemaPhotos = photos.filter(p => /^https?:\/\//.test(p)).slice(0, 6)

  const hotelSchema = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: hotel.name,
    description: ai ? ai.summary.split(/\n\s*\n/)[0] : hotel.description ? stripHtml(hotel.description).slice(0, 500) : undefined,
    url: `https://zaleto.cz/hotel/${params.slug}`,
    image: schemaPhotos.length ? schemaPhotos : undefined,
    ...(hotel.stars ? { starRating: { '@type': 'Rating', ratingValue: hotel.stars, bestRating: 5 } } : {}),
    address: { '@type': 'PostalAddress', addressLocality: hotel.resort_town ?? hotel.destination ?? undefined, addressCountry: hotel.country ?? undefined },
    ...(hotel.latitude && hotel.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: hotel.latitude, longitude: hotel.longitude } } : {}),
    ...(hotel.min_price ? {
      makesOffer: {
        '@type': 'Offer', name: `Zájezd ${hotel.name}`, price: hotel.min_price, priceCurrency: 'CZK',
        // nejnižší cena platí nejdéle do nejbližšího odletu; bez termínu je zájezd nedostupný
        availability: tourCount > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        ...(hotel.next_departure ? { priceValidUntil: hotel.next_departure.slice(0, 10) } : {}),
        url: `https://zaleto.cz/hotel/${params.slug}`,
        seller: { '@type': 'Organization', name: 'Zaleto', url: 'https://zaleto.cz' },
      },
    } : {}),
  }
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.label,
      item: c.href ? `https://zaleto.cz${c.href}` : `https://zaleto.cz/hotel/${params.slug}`,
    })),
  }

  return (
    <>
      <JsonLd data={hotelSchema} />
      <JsonLd data={breadcrumbSchema} />
      {aiFaqSchema && <JsonLd data={aiFaqSchema} />}
      <Header />

      <div className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={crumbs} />
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', margin: 'var(--space-4) 0 var(--space-2)' }}>
          {hotel.has_last_minute === 1 && <span className="z-stamp z-stamp--fill">Last minute</span>}
          {hotel.has_first_minute === 1 && <span className="z-stamp z-stamp--brand">First minute</span>}
        </div>
        <h1 className="h1" style={{ marginBottom: 'var(--space-3)' }}>
          {hotel.name}<span className="z-dot">.</span>
        </h1>
        <div className="z-byline">
          {place && <span><Icon name="poloha" />{place}</span>}
          {hotel.stars ? <span><Icon name="hvezda" />{hotel.stars} hvězdy</span> : null}
          {hotel.review_score ? <span><Icon name="info" />Hodnocení {hotel.review_score.toFixed(1)} / 10</span> : null}
          <span><Icon name="agentura" />{hotel.agency}</span>
        </div>

        <HotelGallery photos={photos} name={hotel.name} />

        <div className="z-hotel">
          <div>
            {ai && (
              <section id="nas-pohled" data-rail="Náš pohled" className="z-coll" style={{ scrollMarginTop: 'calc(var(--header-height) + 16px)' }}>
                <div className="z-coll__head" style={{ cursor: 'default' }}><h2 className="h3">náš pohled<span className="z-dot">.</span></h2></div>
                <div className="z-coll__body">
                  <div className="z-prose"><Paragraphs text={ai.summary} links={textLinks} /></div>
                  {ai.audience.length > 0 && (<><h3 className="z-kicker" style={{ margin: 'var(--space-5) 0 var(--space-2)' }}>Pro koho se hodí</h3><AudienceList items={ai.audience} links={textLinks} /></>)}
                  {ai.highlights.length > 0 && (<><h3 className="z-kicker" style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>Čím hotel vyniká</h3><div className="z-chips">{ai.highlights.map(a => <span key={a} className="z-chip z-chip--ok"><Icon name="ok" />{a}</span>)}</div></>)}
                  {ai.watch_out.length > 0 && (<><h3 className="z-kicker" style={{ margin: 'var(--space-5) 0 var(--space-3)' }}>Na co si dát pozor</h3><div className="z-chips">{ai.watch_out.map(a => <span key={a} className="z-chip"><Icon name="info" />{a}</span>)}</div></>)}
                  {(ai.location || ai.food) && (
                    <div className="z-prose" style={{ marginTop: 'var(--space-5)' }}>
                      {ai.location && <p><strong>Poloha.</strong> <Linked text={ai.location} links={textLinks} /></p>}
                      {ai.food && <p><strong>Strava.</strong> <Linked text={ai.food} links={textLinks} /></p>}
                    </div>
                  )}
                  <AiNote at={ai.generated_at} what="Shrnutí" />
                </div>
              </section>
            )}

            {descriptions.length > 0 && (
              <CollapsibleSection title="o hotelu">
                <div className="z-prose"><AgencyDescriptionSwitcher descriptions={descriptions} /></div>
              </CollapsibleSection>
            )}

            {amenities.length > 0 && (
              <CollapsibleSection title="vybavení">
                <div className="z-chips">{amenities.map(a => <span key={a} className="z-chip"><Icon name="ok" />{a}</span>)}</div>
              </CollapsibleSection>
            )}

            {hotel.food_options && (
              <CollapsibleSection title="stravování">
                <dl className="z-rows">
                  {parseFoodOptions(hotel.food_options).map((r, i) => (
                    <div key={i} className="z-rows__row"><dt>{r.label}</dt>{r.price && <dd>{r.price}</dd>}</div>
                  ))}
                </dl>
              </CollapsibleSection>
            )}

            {priceIncludes.length > 0 && (
              <CollapsibleSection title="co je v ceně">
                <div className="z-chips">{priceIncludes.map(a => <span key={a} className="z-chip z-chip--ok"><Icon name="ok" />{a}</span>)}</div>
              </CollapsibleSection>
            )}

            {distances.length > 0 && (
              <CollapsibleSection title="vzdálenosti">
                <dl className="z-rows">
                  {distances.map((d, i) => {
                    const [label, ...rest] = d.split(':')
                    return <div key={i} className="z-rows__row"><dt>{label.trim()}</dt><dd>{rest.join(':').trim() || d}</dd></div>
                  })}
                </dl>
              </CollapsibleSection>
            )}

            <CollapsibleSection title="recenze hostů" defaultOpen={false} lazy>
              <ReviewsSection slug={params.slug} />
            </CollapsibleSection>

            {hotel.latitude && hotel.longitude && (
              <CollapsibleSection title="počasí v destinaci" defaultOpen={false} lazy>
                <WeatherWidget lat={hotel.latitude} lon={hotel.longitude} location={hotel.resort_town ?? hotel.country ?? ''} noCard days={14} />
                {weatherUrl && (
                  <p style={{ marginTop: 'var(--space-3)' }}>
                    <Link className="z-more" href={weatherUrl}>Podrobné klima</Link>
                  </p>
                )}
              </CollapsibleSection>
            )}

            {hotel.latitude && hotel.longitude && (
              <CollapsibleSection title="poloha na mapě" defaultOpen={false} lazy>
                <Suspense fallback={<div style={{ height: 440 }} />}>
                  <HotelMapWithNearby hotel={hotel} slug={params.slug} />
                </Suspense>
              </CollapsibleSection>
            )}

            <section id="terminy" data-rail="Termíny" className="z-coll" style={{ scrollMarginTop: 'calc(var(--header-height) + 16px)' }}>
              <div className="z-coll__head" style={{ cursor: 'default' }}>
                <h2 className="h3">dostupné termíny<span className="z-dot">.</span></h2>
                <span className="z-chip z-chip--sky">{tourCount} {tourCount === 1 ? 'termín' : tourCount < 5 ? 'termíny' : 'termínů'}</span>
              </div>
              <div className="z-coll__body"><TourDatesList slug={params.slug} /></div>
            </section>

            {ai && ai.faq.length > 0 && (
              <section id="otazky" data-rail="Otázky" className="z-coll" style={{ marginTop: 'var(--space-5)' }}>
                <div className="z-coll__head" style={{ cursor: 'default' }}><h2 className="h3">časté otázky<span className="z-dot">.</span></h2></div>
                <div className="z-coll__body"><FaqList items={ai.faq} links={textLinks} /></div>
              </section>
            )}

            <div style={{ marginTop: 'var(--space-5)' }}>
              <CarRentalBanner place={hotel.resort_town ?? hotel.destination ?? hotel.country ?? ''} country={hotel.country ?? ''} />
            </div>
          </div>

          <aside>
            <Suspense fallback={<div className="z-tk"><div className="z-tk__in" style={{ height: 420 }} /></div>}>
              <BookingBox hotel={hotel} slug={params.slug} place={place} tourCount={tourCount} />
            </Suspense>
          </aside>
        </div>
      </div>

      <Suspense fallback={null}>
        <SimilarHotels hotel={hotel} exclude={params.slug} />
      </Suspense>

      <Suspense fallback={null}>
        <HotelLinks hotel={hotel} weatherUrl={weatherUrl} />
      </Suspense>
    </>
  )
}

/** Rezervace: minimalistická karta – cena, tři nejbližší termíny, jedno hlavní tlačítko. */
async function BookingBox({ hotel, slug, tourCount }: { hotel: Hotel; slug: string; place: string; tourCount: number }) {
  let tours: Tour[] = []
  try {
    const data = await fetchHotelTours(slug)
    tours = (data.tours ?? []).sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || '')).slice(0, 3)
  } catch { /* bez termínů */ }

  // „jen ubytování“: konkrétní hotel na Booking.com v termínu nejbližšího zájezdu (jinak za ~3 týdny)
  const noTours = tours.length === 0
  const t0 = tours[0]
  const stay = t0?.departure_date && t0.duration
    ? { checkin: t0.departure_date.slice(0, 10), checkout: new Date(new Date(t0.departure_date.slice(0, 10)).getTime() + t0.duration * 86_400_000).toISOString().slice(0, 10) }
    : defaultStay()
  const ss = [hotel.name, hotel.resort_town ?? hotel.country].filter(Boolean).join(', ')
  const stayHref = bookingClick(buildBookingUrl({ ss, ...stay }), noTours ? 'hotel-bez-terminu' : 'hotel-detail')

  return (
    <div className="z-bookbox">
      <div className="z-kicker">Rezervace</div>

      <div className="z-bookbox__price">
        <span className="z-data">OD</span>
        <span className="z-bookbox__amount">{hotel.min_price ? formatPrice(hotel.min_price) : 'Aktualizuje se'}</span>
        <span className="z-data">ZA OSOBU</span>
      </div>

      {tours.length > 0 && (
        <ul className="z-bookbox__list">
          {tours.map(t => {
            const q = new URLSearchParams({ date: t.departure_date || '', nights: String(t.duration || 7), adults: '2' })
            if (t.url) q.set('tour_url', t.url)
            if (t.agency) q.set('agency', t.agency)
            return (
              <li key={t.id}>
                <a href={`${API}/api/redirect/${slug}?${q}`} target="_blank" rel="noopener noreferrer sponsored">
                  <span>
                    <b>{formatDateRange(t.departure_date, t.return_date)}</b>
                    <small>{[t.duration ? `${t.duration} nocí` : null, t.departure_city].filter(Boolean).join(' · ')}</small>
                  </span>
                  {t.price > 0 && <span className="z-bookbox__rowprice">{formatPrice(t.price)}</span>}
                </a>
              </li>
            )
          })}
        </ul>
      )}

      {noTours ? (
        <p className="z-data" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}><Icon name="info" size="sm" />ZÁJEZD TEĎ NENÍ V NABÍDCE</p>
      ) : (
        <ScrollToButton targetId="terminy" className="z-btn z-btn--offer z-btn--block z-bookbox__cta">
          {tourCount > tours.length ? `Všech ${tourCount} termínů` : 'Zobrazit termíny'}<span className="z-btn__go"><Icon name="sipka" /></span>
        </ScrollToButton>
      )}

      <a className={`z-btn ${noTours ? 'z-btn--offer' : 'z-btn--primary'} z-btn--block z-bookbox__cta z-bookbox__alt`} href={stayHref} target="_blank" rel="noopener noreferrer sponsored">
        Chci jen ubytování<span className="z-btn__go"><Icon name="sipka" /></span>
      </a>

      <div className="z-bookbox__row">
        <FavoriteButton slug={slug} name={hotel.name} variant="detail" />
        <ShareButton slug={slug} name={hotel.name} />
      </div>
      <p className="z-data z-bookbox__note"><Icon name="ok" size="sm" />REZERVACE PŘÍMO U CESTOVNÍ KANCELÁŘE</p>
      <HotelMobileCta price={hotel.min_price ? formatPrice(hotel.min_price) : 'Aktualizuje se'} label={noTours ? 'Chci jen ubytování' : 'Termíny'} href={noTours ? stayHref : undefined} />
    </div>
  )
}

/** Podobné hotely: ze stejného místa (letovisko → oblast → země), nejbližší počtem hvězd a cenou. */
async function SimilarHotels({ hotel, exclude }: { hotel: Hotel; exclude: string }) {
  const region = hotel.destination?.split('/')[1]?.trim()
  const places = [hotel.resort_town, region, hotel.country].filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i)
  const seen = new Set<string>([exclude])
  const pool: Awaited<ReturnType<typeof fetchHotels>>['hotels'] = []
  for (const place of places) {
    const r = await fetchHotels({ destination: place, sort: 'price_asc', limit: 24 }).catch(() => null)
    for (const h of r?.hotels ?? []) {
      if (seen.has(h.slug) || !h.thumbnail_url || !h.min_price) continue
      seen.add(h.slug)
      pool.push(h)
    }
    if (pool.length >= 6) break
  }
  const price = hotel.min_price ?? 0
  const similar = pool
    .map(h => ({ h, score: Math.abs((h.stars ?? 0) - (hotel.stars ?? 0)) * 2 + (price ? Math.abs(Math.log(h.min_price / price)) : 0) }))
    .sort((x, y) => x.score - y.score)
    .slice(0, 3)
    .map(x => x.h)
  if (similar.length === 0) return null
  const where = hotel.resort_town ?? region ?? hotel.country
  return (
    <section className="z-container z-section" data-rail="Podobné hotely" aria-labelledby="podobne-hotely">
      <div className="z-shead">
        <div>
          <div className="z-kicker">{where ? `Další v lokalitě ${where}` : 'Další nabídky'}</div>
          <h2 id="podobne-hotely">podobné hotely<span className="z-dot">.</span></h2>
        </div>
        {where && <Link className="z-more" href={`/zajezdy?destination=${encodeURIComponent(where)}`}>Všechny zájezdy: {where}</Link>}
      </div>
      <div className="z-grid-3">
        {similar.map(h => <TourCard key={h.slug} hotel={h} />)}
      </div>
    </section>
  )
}

/** Vnitřní prolinkování: průvodci místa, přehledy zájezdů do země a články o lokalitě. */
async function HotelLinks({ hotel, weatherUrl }: { hotel: Hotel; weatherUrl: string | null }) {
  const region = hotel.destination?.split('/')[1]?.trim()
  const [landings, articles] = await Promise.all([
    hotel.country ? fetchLandingList() : Promise.resolve([]),
    fetchArticles(3, hotel.country ?? hotel.resort_town ?? undefined),
  ])
  const guides = [hotel.resort_town, region, hotel.country]
    .filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i)
    .map(n => ({ href: `/destinace/${slugify(n)}`, label: `Průvodce: ${n}`, hint: n === hotel.country ? 'země, počasí, kdy jet' : undefined }))
  if (weatherUrl) guides.push({ href: weatherUrl, label: `Počasí: ${hotel.resort_town ?? region ?? hotel.country}`, hint: 'klima po měsících' })
  // typy přehledů (strava, hvězdičky) před měsíci; nejvýš 6 odkazů
  const order = { meal: 0, stars: 1, month: 2 } as const
  const overviews = landings
    .filter(l => l.country === hotel.country)
    .sort((a, b) => order[a.type] - order[b.type] || b.hotel_count - a.hotel_count)
    .slice(0, 6)
    .map(l => ({ href: `/zajezdy/${l.slug}`, label: l.title, hint: `${l.hotel_count} hotelů` }))
  const reads = articles.slice(0, 3).map(a => ({ href: `/clanky/${a.slug}`, label: a.title }))
  if (!guides.length && !overviews.length && !reads.length) return null
  return (
    <section className="z-container z-section" aria-label="Související stránky">
      <LinkList title="Průvodce místem" links={guides} />
      <LinkList title={`Přehledy zájezdů${hotel.country ? `: ${hotel.country}` : ''}`} links={overviews} />
      <LinkList title="Čti dál" links={reads} />
    </section>
  )
}

async function HotelMapWithNearby({ hotel, slug }: { hotel: Hotel; slug: string }) {
  type MapNearby = {
    id: number; slug: string; name: string; stars: number | null; thumbnail_url: string | null
    min_price: number; resort_town: string | null; latitude: number; longitude: number; distance_km?: number
  }
  let nearbyForMap: MapNearby[] = []
  if (hotel.latitude && hotel.longitude) {
    try {
      const raw = await fetchNearbyHotels(hotel.latitude, hotel.longitude, slug, 20)
      nearbyForMap = raw
        .filter(n => n.latitude != null && n.longitude != null)
        .map(n => ({
          id: n.id ?? 0, slug: n.slug, name: n.name, stars: n.stars, thumbnail_url: n.thumbnail_url,
          min_price: n.min_price, resort_town: n.resort_town ?? null, latitude: n.latitude!, longitude: n.longitude!, distance_km: n.distance_km,
        }))
    } catch { /* ignore */ }
  }
  return <HotelMap hotel={hotel} nearby={nearbyForMap} />
}
