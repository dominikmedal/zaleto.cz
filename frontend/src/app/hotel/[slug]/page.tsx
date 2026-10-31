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
import TourDatesList from '@/components/TourDatesList'
import TourModalTrigger from '@/components/TourModalTrigger'
import ReviewsSection from '@/components/ReviewsSection'
import WeatherWidget from '@/components/WeatherWidget'
import CollapsibleSection from '@/components/CollapsibleSection'
import AgencyDescriptionSwitcher from '@/components/AgencyDescriptionSwitcher'
import CarRentalBanner from '@/components/CarRentalBanner'
import Crumbs from '@/components/ui/Crumbs'
import Icon from '@/components/ui/Icon'
import TourCard from '@/components/ui/TourCard'
import { formatDateRange, formatPrice } from '@/components/ui/format'
import { fetchHotel, fetchHotelTours, fetchNearbyHotels, API } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import type { Hotel, NearbyHotel, Tour } from '@/lib/types'

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
  try { hotel = await fetchHotel(params.slug) } catch { return { title: 'Hotel nenalezen | Zaleto' } }
  const place = [hotel.resort_town, hotel.country].filter(Boolean).join(', ')
  const price = hotel.min_price ? ` od ${formatPrice(hotel.min_price)}` : ''
  const title = `${hotel.name}${place ? ` — ${place}` : ''}${price} | Zaleto`
  const description = hotel.description
    ? stripHtml(hotel.description).slice(0, 160)
    : `Zájezdy do hotelu ${hotel.name}${place ? ` (${place})` : ''}. Porovnej termíny a ceny od českých cestovních kanceláří.`
  const canonical = `https://zaleto.cz/hotel/${hotel.canonical_slug ?? params.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', images: hotel.thumbnail_url ? [{ url: hotel.thumbnail_url }] : undefined },
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

  const hotelSchema = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: hotel.name,
    description: hotel.description ? stripHtml(hotel.description).slice(0, 500) : undefined,
    url: `https://zaleto.cz/hotel/${params.slug}`,
    image: photos.slice(0, 3).length ? photos.slice(0, 3) : undefined,
    ...(hotel.stars ? { starRating: { '@type': 'Rating', ratingValue: hotel.stars, bestRating: 5 } } : {}),
    address: { '@type': 'PostalAddress', addressLocality: hotel.resort_town ?? hotel.destination ?? undefined, addressCountry: hotel.country ?? undefined },
    ...(hotel.latitude && hotel.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: hotel.latitude, longitude: hotel.longitude } } : {}),
    ...(hotel.min_price ? {
      makesOffer: {
        '@type': 'Offer', name: `Zájezd ${hotel.name}`, price: hotel.min_price, priceCurrency: 'CZK',
        availability: 'https://schema.org/InStock', seller: { '@type': 'Organization', name: 'Zaleto', url: 'https://zaleto.cz' },
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
          <span><Icon name="hotel" />{hotel.agency}</span>
        </div>

        <HotelGallery photos={photos} name={hotel.name} />

        <div className="z-hotel">
          <div>
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
                <WeatherWidget lat={hotel.latitude} lon={hotel.longitude} location={hotel.resort_town ?? hotel.country ?? ''} noCard />
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

            <section id="terminy" className="z-coll" style={{ scrollMarginTop: 'calc(var(--header-height) + 16px)' }}>
              <div className="z-coll__head" style={{ cursor: 'default' }}>
                <h2 className="h3">dostupné termíny<span className="z-dot">.</span></h2>
                <span className="z-chip z-chip--sky">{tourCount} {tourCount === 1 ? 'termín' : tourCount < 5 ? 'termíny' : 'termínů'}</span>
              </div>
              <div className="z-coll__body"><TourDatesList slug={params.slug} /></div>
            </section>

            <div style={{ marginTop: 'var(--space-5)' }}>
              <CarRentalBanner place={hotel.resort_town ?? hotel.destination ?? hotel.country ?? ''} country={hotel.country ?? ''} />
            </div>
          </div>

          <aside>
            <div className="z-tk z-tk--h z-booking">
              <div className="z-tk__in">
                <div className="z-booking__top">
                  <div className="z-kicker">Rezervace</div>
                  <div className="z-price__note" style={{ marginTop: 'var(--space-3)' }}>od · za osobu</div>
                  <div className="z-price">{hotel.min_price ? formatPrice(hotel.min_price) : 'Aktualizuje se'}</div>
                  {dates && <div className="z-data" style={{ marginTop: 'var(--space-2)' }}>NEJBLIŽŠÍ ODLET {dates}</div>}
                </div>

                <div className="z-booking__list">
                  <div className="z-kicker" style={{ marginBottom: 'var(--space-2)' }}>Nejbližší termíny</div>
                  <Suspense fallback={<div style={{ height: 120 }} />}>
                    <UpcomingDepartures slug={params.slug} />
                  </Suspense>
                  <div style={{ marginTop: 'var(--space-2)' }}>
                    <TourModalTrigger slug={params.slug} name={hotel.name} tourCount={tourCount} />
                  </div>
                </div>

                <div className="z-booking__stub">
                  <ScrollToButton targetId="terminy" className="z-btn z-btn--primary z-btn--block">
                    Zobrazit termíny<span className="z-btn__go"><Icon name="sipka" /></span>
                  </ScrollToButton>
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <FavoriteButton slug={params.slug} name={hotel.name} variant="detail" className="flex-1 justify-center" />
                    <ShareButton slug={params.slug} name={hotel.name} />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {hotel.latitude && hotel.longitude && (
        <Suspense fallback={null}>
          <NearbyHotelsGrid lat={hotel.latitude} lon={hotel.longitude} exclude={params.slug} />
        </Suspense>
      )}
    </>
  )
}

async function UpcomingDepartures({ slug }: { slug: string }) {
  let tours: Tour[] = []
  try {
    const data = await fetchHotelTours(slug)
    tours = (data.tours ?? []).sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || '')).slice(0, 4)
  } catch { return null }
  if (tours.length === 0) return <p className="z-data">TERMÍNY SE AKTUALIZUJÍ</p>

  return (
    <ul className="z-deps">
      {tours.map(t => {
        const q = new URLSearchParams({ date: t.departure_date || '', nights: String(t.duration || 7), adults: '2' })
        if (t.url) q.set('tour_url', t.url)
        return (
          <li key={t.id}>
            <a href={`${API}/api/redirect/${slug}?${q}`} target="_blank" rel="noopener noreferrer sponsored">
              <span>
                <b>{formatDateRange(t.departure_date, t.return_date)}</b>
                <small>{[t.duration ? `${t.duration} nocí` : null, t.departure_city].filter(Boolean).join(' · ')}</small>
              </span>
              {t.price > 0 && <span className="z-deps__price">{formatPrice(t.price)}</span>}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

async function NearbyHotelsGrid({ lat, lon, exclude }: { lat: number; lon: number; exclude: string }) {
  let nearby: NearbyHotel[] = []
  try { nearby = await fetchNearbyHotels(lat, lon, exclude, 6) } catch { return null }
  nearby = nearby.filter(n => n.thumbnail_url).slice(0, 3)
  if (nearby.length === 0) return null
  return (
    <section className="z-container z-section">
      <div className="z-shead">
        <div>
          <div className="z-kicker">V okolí</div>
          <h2>hotely poblíž<span className="z-dot">.</span></h2>
        </div>
      </div>
      <div className="z-grid-3">
        {nearby.map(n => <TourCard key={n.slug} hotel={{ ...n, min_price: n.min_price }} />)}
      </div>
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
