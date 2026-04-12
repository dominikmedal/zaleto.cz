import React from 'react'
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Plane, Bus, Car } from 'lucide-react'
import { PiMapPin, PiStarFill, PiArrowLeft, PiForkKnife, PiCalendarBlank, PiCoins, PiCheckCircle, PiCheck, PiHouseSimple, PiSparkle, PiRuler, PiWallet, PiMapTrifold, PiChatCircleDots, PiTimer, PiCalendarStar, PiBuildings, PiSun, PiShieldCheck, PiArrowsDownUp, PiArrowRight } from 'react-icons/pi'
import ScrollToButton from '@/components/ScrollToButton'
import ViewersBadge from '@/components/ViewersBadge'
import Header from '@/components/Header'
import HotelStickyBar from '@/components/HotelStickyBar'
import FavoriteButton from '@/components/FavoriteButton'
import TourDatesList from '@/components/TourDatesList'
import HotelGallery from '@/components/HotelGallery'
import ReviewsSection from '@/components/ReviewsSection'
import NearbyHotels from '@/components/NearbyHotels'
import { fetchHotel } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import JsonLd from '@/components/JsonLd'
import AgencyDescriptionSwitcher from '@/components/AgencyDescriptionSwitcher'
import WeatherWidget from '@/components/WeatherWidget'
import CollapsibleSection from '@/components/CollapsibleSection'
import ShareButton from '@/components/ShareButton'

// Leaflet needs browser APIs → dynamic import, no SSR
const HotelMap = dynamic(() => import('@/components/HotelMap'), { ssr: false })

export const revalidate = 3600          // ISR — regeneruj stránku na pozadí každou hodinu
export const dynamicParams = true       // stránky mimo generateStaticParams fungují jako ISR on-demand

export async function generateStaticParams() {
  // Pre-generujeme top 100 hotelů při buildu — zrychlí první načtení pro Googlebot.
  // Limit 100 zabraňuje zahlcení Railway backendu souběžnými požadavky.
  // Ostatní stránky fungují jako ISR on-demand (dynamicParams = true).
  try {
    const { fetchAllHotelSlugs } = await import('@/lib/api')
    const slugs = await fetchAllHotelSlugs(100)
    return slugs.map(s => ({ slug: s.slug }))
  } catch {
    return []
  }
}

interface Props { params: { slug: string } }

function parseFoodOptions(raw: string): { label: string; price: string | null }[] {
  return raw.split('|').map(s => {
    const trimmed = s.trim().replace(/(\d+)\.0\b/g, (_, n) => Number(n).toLocaleString('cs-CZ'))
    const match = trimmed.match(/^(.+?)\s+([\d\s]+\s*Kč.*)$/)
    if (match) return { label: match[1].trim(), price: match[2].trim() }
    return { label: trimmed, price: null }
  }).filter(r => r.label)
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

function formatPrice(p: number) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(p)
}

function formatPriceShort(p: number) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(p)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const hotel = await fetchHotel(params.slug)
    const location = [hotel.resort_town, hotel.destination, hotel.country].filter(Boolean).join(', ')
    const starsStr = hotel.stars ? `${'★'.repeat(hotel.stars)} ` : ''
    const title = `${hotel.name} ${starsStr}— ${location} | Zaleto`
    const priceStr = hotel.min_price ? ` od ${formatPrice(hotel.min_price)} / os.` : ''
    const stars = hotel.stars ? `${hotel.stars}hvězdičkový hotel. ` : ''
    const description = hotel.description
      ? `${stars}${stripHtml(hotel.description).slice(0, 130)}… Zájezdy${priceStr}. Porovnejte termíny a rezervujte přímo u CK.`
      : `${stars}${hotel.name} v destinaci ${location}. Zájezdy${priceStr}. Porovnejte termíny od předních českých CK a rezervujte online.`
    const canonical = `https://zaleto.cz/hotel/${params.slug}`
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        images: hotel.thumbnail_url ? [{ url: hotel.thumbnail_url, width: 1200, height: 800, alt: `${hotel.name} — ${location}` }] : [],
        type: 'website',
        siteName: 'Zaleto',
        locale: 'cs_CZ',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: hotel.thumbnail_url ? [hotel.thumbnail_url] : [],
      },
    }
  } catch {
    return { title: 'Hotel nenalezen | Zaleto' }
  }
}

function StarsRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <PiStarFill key={i} className="w-4 h-4 text-amber-400" />
      ))}
    </div>
  )
}


function formatDep(s: string): string {
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

export default async function HotelDetailPage({ params }: Props) {
  let hotel: Awaited<ReturnType<typeof fetchHotel>>

  try {
    hotel = await fetchHotel(params.slug)
  } catch {
    notFound()
  }

  // Parse photos
  const photos: string[] = (() => {
    try {
      const arr = hotel.photos ? JSON.parse(hotel.photos) : []
      return arr.length ? arr : hotel.thumbnail_url ? [hotel.thumbnail_url] : []
    } catch {
      return hotel.thumbnail_url ? [hotel.thumbnail_url] : []
    }
  })()

  const amenitiesList: string[] = (() => {
    if (!hotel.amenities) return []
    try {
      const arr = JSON.parse(hotel.amenities)
      if (Array.isArray(arr)) return arr.map((s: string) => s.trim()).filter(Boolean)
    } catch {}
    return hotel.amenities.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean)
  })()

  const tagsList: string[] = (() => {
    if (!hotel.tags) return []
    try {
      const arr = JSON.parse(hotel.tags)
      if (Array.isArray(arr)) return arr.map((s: string) => s.trim()).filter(Boolean)
    } catch {}
    return hotel.tags.split(/[,\n]/).map((s: string) => s.trim()).filter(Boolean)
  })()

  const distancesList = hotel.distances
    ? hotel.distances.split('|').map((s: string) => s.trim()).filter(Boolean)
    : []

  const priceIncludesList = hotel.price_includes
    ? hotel.price_includes.split('|').map((s: string) => s.trim()).filter(Boolean)
    : []

  const minTourPrice = hotel.min_price
  const tourCount    = hotel.available_dates ?? 0

  const highlights: { icon: React.ReactNode; title: string; desc: string }[] = [
    { icon: <PiShieldCheck className="w-5 h-5" />, title: 'Přímé rezervace u CK', desc: 'Bez prostředníka — objednáte přímo u cestovní kanceláře' },
    { icon: <PiArrowsDownUp className="w-5 h-5" />, title: 'Srovnání z více CK', desc: 'Jeden hotel, více nabídek — vyberete nejlepší cenu a termín' },
    ...(hotel.stars && hotel.stars >= 4 ? [{ icon: <PiStarFill className="w-5 h-5 text-amber-400" />, title: `${hotel.stars}hvězdičkový hotel`, desc: hotel.stars === 5 ? 'Luxusní ubytování s nejvyšším standardem' : 'Nadstandardní komfort a kvalita služeb' }] : []),
    ...(hotel.review_score && hotel.review_score >= 7 ? [{ icon: <PiChatCircleDots className="w-5 h-5" />, title: `Hodnocení ${hotel.review_score.toFixed(1)}/10`, desc: 'Kladné recenze od hostů, kteří hotel skutečně navštívili' }] : []),
    ...(hotel.has_last_minute === 1 ? [{ icon: <PiTimer className="w-5 h-5" />, title: 'Last minute sleva', desc: 'Výrazně snížená cena pro flexibilní cestovatele' }] : hotel.has_first_minute === 1 ? [{ icon: <PiCalendarStar className="w-5 h-5" />, title: 'First minute výhoda', desc: 'Nejlepší cena za včasnou rezervaci — rezervujte předem a ušetřete' }] : []),
    ...(tourCount >= 8 ? [{ icon: <PiCalendarBlank className="w-5 h-5" />, title: `${tourCount} dostupných termínů`, desc: 'Velká flexibilita při výběru data odjezdu i délky pobytu' }] : []),
  ]

  const hotelSchema = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: hotel.name,
    description: hotel.description ? stripHtml(hotel.description).slice(0, 500) : undefined,
    url: `https://zaleto.cz/hotel/${params.slug}`,
    image: photos.slice(0, 3).length ? photos.slice(0, 3) : (hotel.thumbnail_url ? [hotel.thumbnail_url] : undefined),
    ...(hotel.stars ? { starRating: { '@type': 'Rating', ratingValue: hotel.stars, bestRating: 5 } } : {}),
    ...(hotel.review_score ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: hotel.review_score.toFixed(1), bestRating: '10', worstRating: '0', reviewCount: 5 } } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: hotel.resort_town ?? hotel.destination ?? undefined,
      addressCountry: hotel.country ?? undefined,
    },
    ...(hotel.latitude && hotel.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: hotel.latitude, longitude: hotel.longitude } } : {}),
    priceRange: minTourPrice ? `od ${formatPriceShort(minTourPrice)} Kč` : undefined,
    ...(minTourPrice ? {
      makesOffer: {
        '@type': 'Offer',
        name: `Zájezd ${hotel.name}`,
        price: minTourPrice,
        priceCurrency: 'CZK',
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: 'Zaleto', url: 'https://zaleto.cz' },
      },
    } : {}),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...(hotel.country ? [{ '@type': 'ListItem', position: 2, name: hotel.country, item: `https://zaleto.cz/destinace/${slugify(hotel.country)}` }] : []),
      ...(hotel.resort_town && hotel.resort_town !== hotel.country ? [{ '@type': 'ListItem', position: 3, name: hotel.resort_town, item: `https://zaleto.cz/destinace/${slugify(hotel.resort_town)}` }] : []),
      { '@type': 'ListItem', position: hotel.resort_town && hotel.resort_town !== hotel.country ? 4 : 3, name: hotel.name, item: `https://zaleto.cz/hotel/${params.slug}` },
    ],
  }

  return (
    <div className="min-h-screen">
      <JsonLd data={hotelSchema} />
      <JsonLd data={breadcrumbSchema} />
      <Header />

      <div className="max-w-[1680px] mx-auto px-6 sm:px-8 pt-5 pb-6">

        {/* ── Editorial page header — no glass, clean type ── */}
        <div className="mb-5">

          {/* Breadcrumb + badges row */}
          <div className="flex items-center flex-wrap gap-2 mb-3">
            <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400">
              <Link href="/" className="inline-flex items-center gap-1 hover:text-[#0093FF] transition-colors font-medium">
                <PiArrowLeft className="w-3 h-3" /> Zaleto
              </Link>
              {hotel.country && (<>
                <span className="text-gray-300 select-none mx-0.5">/</span>
                <Link href={`/destinace/${slugify(hotel.country)}`} className="hover:text-[#0093FF] transition-colors">{hotel.country}</Link>
              </>)}
              {hotel.resort_town && hotel.resort_town !== hotel.country && (<>
                <span className="text-gray-300 select-none mx-0.5">/</span>
                <Link href={`/destinace/${slugify(hotel.resort_town)}`} className="hover:text-[#0093FF] transition-colors">{hotel.resort_town}</Link>
              </>)}
            </nav>

            {hotel.has_last_minute === 1 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                <PiTimer className="w-3 h-3" /> Last minute
              </span>
            )}
            {hotel.has_first_minute === 1 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                <PiCalendarStar className="w-3 h-3" /> First minute
              </span>
            )}
          </div>

          {/* Location eyebrow */}
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0093FF] uppercase tracking-[0.12em] mb-2">
            <PiMapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {[hotel.resort_town, hotel.destination, hotel.country].filter(Boolean).join(' · ')}
          </p>

          {/* Title */}
          <h1
            className="font-bold text-gray-900 leading-[1.08] tracking-tight mb-4"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(26px, 3.5vw, 44px)' }}
          >
            {hotel.name}
          </h1>

          {/* Meta strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {hotel.stars && hotel.stars > 0 && (
              <div className="flex items-center gap-1.5">
                <StarsRow count={hotel.stars} />
                <span className="text-[11px] text-gray-400">{hotel.stars}-hvězdičkový</span>
              </div>
            )}

            {hotel.review_score && hotel.review_score > 0 && (<>
              <span className="w-px h-4 bg-gray-200 flex-shrink-0" />
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold text-gray-900 tabular-nums leading-none">{hotel.review_score.toFixed(1)}</span>
                <span className="text-[11px] text-gray-400">/ 10 hodnocení</span>
              </div>
            </>)}

            <span className="w-px h-4 bg-gray-200 flex-shrink-0" />
            <span className="text-[12px] font-medium text-gray-500">{hotel.agency}</span>
          </div>
        </div>
        {/* thin separator */}
        <div className="mb-5 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,147,255,0.18) 0%, transparent 60%)' }} />

        {/* Gallery */}
        <HotelGallery photos={photos} name={hotel.name} />

        {/* ── Cena zájezdu — mobile only, right after gallery ── */}
        <div className="lg:hidden mt-4 rounded-2xl border border-gray-100 overflow-hidden shadow-[0_4px_32px_-4px_rgba(0,138,254,0.13)]">
          <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3 bg-gradient-to-b from-emerald-50/50 to-white">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-1">Nejnižší cena od osoby</p>
              {minTourPrice ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-emerald-600 tabular-nums">{formatPriceShort(minTourPrice)}</span>
                  <span className="text-sm font-semibold text-gray-400">Kč</span>
                </div>
              ) : (
                <span className="text-sm font-semibold text-gray-400 opacity-60">Aktualizuje se…</span>
              )}
            </div>
            <ScrollToButton
              targetId="terminy"
              className="flex-shrink-0 bg-[#008afe] hover:bg-[#0079e5] active:scale-[0.98] text-white font-bold py-3 px-5 rounded-xl flex items-center gap-2 text-sm whitespace-nowrap shadow-md shadow-[#008afe]/25 transition-all"
            >
              <PiCalendarBlank className="w-4 h-4" />
              Vybrat termín
            </ScrollToButton>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-gray-50">
            <div className="px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-1">Termíny</p>
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-[#008afe] text-xs font-bold px-2 py-0.5 rounded-full">
                <PiCalendarBlank className="w-3 h-3" />
                {tourCount}
              </span>
            </div>
            <div className="px-4 py-3 border-l border-gray-50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-1">Nejbližší odjezd</p>
              {hotel.next_departure ? (
                <ScrollToButton targetId="terminy" className="flex items-center gap-1.5 text-left group">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-gray-700 group-hover:text-[#008afe] transition-colors">
                    {formatDep(hotel.next_departure)}
                    {hotel.next_return_date && <span className="font-normal text-gray-400"> → {formatDep(hotel.next_return_date)}</span>}
                  </p>
                </ScrollToButton>
              ) : <p className="text-xs font-semibold text-gray-400">—</p>}
            </div>
          </div>
          <div className="px-4 pb-4 pt-3 border-t border-gray-50 flex gap-2">
            <FavoriteButton slug={params.slug} name={hotel.name} variant="detail" className="flex-1 justify-center" />
            <ShareButton slug={params.slug} name={hotel.name} />
          </div>
        </div>

        {/* Sticky bar — sentinel right after gallery so it's visible on page load */}
        <HotelStickyBar
          name={hotel.name}
          slug={params.slug}
          stars={hotel.stars}
          location={[hotel.resort_town, hotel.destination, hotel.country].filter(Boolean).join(' · ')}
          minPrice={minTourPrice}
        />

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start mt-6">

          {/* ── Left column ── */}
          <div className="lg:col-span-2">
            <div className="glass-card rounded-2xl px-6">

              {/* ── Marketing highlights ── */}
              {highlights.length > 0 && (
                <section className="py-6 border-b" style={{ borderColor: 'rgba(0,147,255,0.08)' }}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Výhody</p>
                  <h2 className="flex items-center gap-2 text-[16px] font-semibold text-gray-900 mb-4">
                    <PiSparkle className="w-5 h-5 text-[#0093FF] flex-shrink-0" />
                    Proč tento zájezd?
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    {highlights.slice(0, 6).map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl px-3.5 py-3 transition-colors duration-200 hover:bg-[#F8FBFF]"
                        style={{ background: '#F3F8FF', border: '1px solid rgba(0,147,255,0.10)' }}
                      >
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                          style={{ background: 'rgba(0,147,255,0.08)' }}
                        >
                          <span className="text-[#0093FF]">{item.icon}</span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 leading-snug">{item.title}</p>
                          <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {((hotel.agencyDescriptions?.length ?? 0) > 0 || hotel.description) && (
                <CollapsibleSection title="O hotelu" icon={<PiHouseSimple className="w-5 h-5" />}>
                  <AgencyDescriptionSwitcher
                    descriptions={(hotel.agencyDescriptions?.length ?? 0) > 0
                      ? hotel.agencyDescriptions!
                      : hotel.description ? [{ agency: hotel.agency, description: hotel.description }] : []
                    }
                  />
                </CollapsibleSection>
              )}

              {amenitiesList.length > 0 && (
                <CollapsibleSection title="Vybavení a výhody" icon={<PiSparkle className="w-5 h-5" />}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4">
                    {amenitiesList.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <PiCheckCircle className="w-4 h-4 text-[#008afe] flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {distancesList.length > 0 && (
                <CollapsibleSection title="Vzdálenosti" icon={<PiRuler className="w-5 h-5" />}>
                  <div className="divide-y divide-gray-50">
                    {distancesList.map((d, i) => {
                      const [label, ...rest] = d.split(':')
                      const val = rest.join(':').trim() || d
                      return (
                        <div key={i} className="flex items-center justify-between py-2 text-sm">
                          <span className="flex items-center gap-2 text-gray-500">
                            <PiMapPin className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            {label.trim()}
                          </span>
                          <span className="font-semibold text-gray-800 tabular-nums">{val}</span>
                        </div>
                      )
                    })}
                  </div>
                </CollapsibleSection>
              )}

              {hotel.food_options && (
                <CollapsibleSection title="Stravování" icon={<PiForkKnife className="w-5 h-5" />}>
                  {hotel.food_options && (
                    <div className="divide-y divide-gray-50">
                      {parseFoodOptions(hotel.food_options).map((row, i) => (
                        <div key={i} className="flex items-center justify-between py-2 text-sm">
                          <span className="text-gray-500">{row.label}</span>
                          {row.price && <span className="font-semibold text-emerald-600 tabular-nums">{row.price}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </CollapsibleSection>
              )}

              {priceIncludesList.length > 0 && (
                <CollapsibleSection title="Co je v ceně" icon={<PiWallet className="w-5 h-5" />}>
                  <div className="grid sm:grid-cols-2 gap-y-2.5 gap-x-6">
                    {priceIncludesList.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <PiCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {hotel.latitude && hotel.longitude && (
                <CollapsibleSection title="Poloha na mapě" icon={<PiMapTrifold className="w-5 h-5" />}>
                  <Suspense fallback={<div className="h-[440px] bg-gray-50 rounded-2xl animate-pulse" />}>
                    <HotelMapWithNearby hotel={hotel} slug={params.slug} />
                  </Suspense>
                </CollapsibleSection>
              )}

              <CollapsibleSection title="Recenze hostů" icon={<PiChatCircleDots className="w-5 h-5" />} defaultOpen={false} lazy>
                <ReviewsSection slug={params.slug} />
              </CollapsibleSection>

              {hotel.latitude && hotel.longitude && (() => {
                const _country = hotel.country
                const _region = hotel.destination?.split('/')[1]?.trim()
                const _weatherUrl = _country
                  ? _region
                    ? `/pocasi/${slugify(_country)}/${slugify(_region)}`
                    : `/pocasi/${slugify(_country)}`
                  : null
                return (
                  <CollapsibleSection title="Počasí v destinaci" icon={<PiSun className="w-5 h-5" />}>
                    <WeatherWidget
                      lat={hotel.latitude!}
                      lon={hotel.longitude!}
                      location={hotel.resort_town ?? hotel.country ?? ''}
                      noCard
                    />
                    {_weatherUrl && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <Link
                          href={_weatherUrl}
                          className="inline-flex items-center gap-1.5 text-xs text-[#008afe] hover:underline font-medium"
                        >
                          <PiSun className="w-3.5 h-3.5" />
                          Podrobné klima a předpověď — {_region ?? _country}
                        </Link>
                      </div>
                    )}
                  </CollapsibleSection>
                )
              })()}

            </div>
          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-[116px] space-y-3">

              {/* Booking widget — hidden on mobile (shown above gallery instead) */}
              <div className="hidden lg:block rounded-2xl border border-gray-100 overflow-hidden shadow-[0_4px_32px_-4px_rgba(0,138,254,0.13)]">

                {/* Price hero */}
                <div className="px-5 pt-5 pb-5 bg-[#e1f2f3]">
                  <p className="text-[10px] font-bold text-[#0d4f52] uppercase tracking-[0.12em] mb-1.5">Nejnižší cena od osoby</p>
                  <div className="flex items-baseline gap-1.5 mb-4">
                    {minTourPrice ? (
                      <>
                        <span className="text-[42px] font-bold text-[#0d4f52] leading-none tabular-nums">{formatPriceShort(minTourPrice)}</span>
                        <span className="text-lg font-semibold text-[#0d4f52]">Kč</span>
                      </>
                    ) : (
                      <span className="text-base font-semibold text-[#0d4f52] opacity-60">Ceny se aktualizují…</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 bg-[#0d4f52] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                        <PiCalendarBlank className="w-3.5 h-3.5" />
                        {tourCount} {tourCount === 1 ? 'termín' : tourCount < 5 ? 'termíny' : 'termínů'}
                      </span>
                      {[hotel.resort_town, hotel.destination, hotel.country].filter(Boolean)[0] && (
                        <Link
                          href={`/destinace/${slugify([hotel.resort_town, hotel.destination, hotel.country].filter(Boolean)[0]!)}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0d4f52] transition-colors"
                        >
                          <PiMapPin className="w-3.5 h-3.5 text-[#0d4f52] flex-shrink-0" />
                          {[hotel.resort_town, hotel.country].filter(Boolean).join(', ')}
                        </Link>
                      )}
                    </div>

                    {hotel.next_departure && (
                      <ScrollToButton targetId="terminy" className="flex items-center gap-2 text-xs w-fit group">
                        <span className="w-2 h-2 rounded-full bg-[#0d4f52] flex-shrink-0 ring-2 ring-emerald-100" />
                        <span className="text-[#0d4f52]">
                          Nejbližší:{' '}
                          <span className="font-semibold">
                            {formatDep(hotel.next_departure)}{hotel.next_return_date ? ` → ${formatDep(hotel.next_return_date)}` : ''}
                          </span>
                        </span>
                      </ScrollToButton>
                    )}
                  </div>
                </div>

                {/* Upcoming departures */}
                <div className="px-5 py-3 border-t border-gray-50">
                  <Suspense fallback={null}>
                    <UpcomingDepartures slug={params.slug} />
                  </Suspense>
                </div>

                {/* CTA */}
                <div className="px-5 pb-5 pt-3 border-t border-gray-100 space-y-2.5">
                  <ViewersBadge />
                  <ScrollToButton
                    targetId="terminy"
                    className="w-full bg-[#008afe] hover:bg-[#0079e5] active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-[#008afe]/25 text-sm tracking-wide"
                  >
                    <PiCalendarBlank className="w-4 h-4" />
                    Vybrat termín
                  </ScrollToButton>
                  <div className="flex gap-2">
                    <FavoriteButton slug={params.slug} name={hotel.name} variant="detail" className="flex-1 justify-center" />
                    <ShareButton slug={params.slug} name={hotel.name} />
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-0.5">
                    {['Přímé rezervace', 'Bez poplatků', 'Ověřené CK'].map((label, i) => (
                      <React.Fragment key={label}>
                        {i > 0 && <span className="w-px h-3 bg-gray-200 flex-shrink-0" />}
                        <span className="flex items-center gap-1 text-[12px] text-[#0c4d50]">
                          <PiCheck className="w-3 h-3 text-[#0c4d50] flex-shrink-0" />
                          {label}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* Nearby hotels — vlastní scroll, neposouvá price widget */}
              {hotel.latitude && hotel.longitude && (
                <div className="lg:max-h-[400px] lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  <Suspense fallback={null}>
                    <NearbyHotels lat={hotel.latitude} lon={hotel.longitude} exclude={params.slug} />
                  </Suspense>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Available dates — full width ── */}
        <div id="terminy" className="mt-10 scroll-mt-[140px]">
          <div className="section-island">
            {/* Section heading */}
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-bold text-[#0093FF] uppercase tracking-[0.16em] mb-1.5">Rezervace</p>
                <h2
                  className="font-bold text-gray-900 leading-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 2.5vw, 30px)' }}
                >
                  Dostupné termíny
                </h2>
              </div>
              <span
                className="inline-flex items-center gap-1.5 text-sm font-bold text-white px-3.5 py-1.5 rounded-full flex-shrink-0 mb-0.5"
                style={{ background: 'linear-gradient(135deg, #0093FF, #0070E0)', boxShadow: '0 3px 12px rgba(0,147,255,0.28)' }}
              >
                <PiCalendarBlank className="w-3.5 h-3.5" />
                {tourCount}
              </span>
            </div>
            <TourDatesList slug={params.slug} />
          </div>
        </div>

        {/* ── Nearby hotels — full width, below dates ── */}
        {(hotel.latitude && hotel.longitude) && (
          <div className="mt-8 section-island">
            <Suspense fallback={null}>
              <NearbyHotelsGrid lat={hotel.latitude} lon={hotel.longitude} exclude={params.slug} />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}

async function UpcomingDepartures({ slug }: { slug: string }) {
  const { fetchHotelTours } = await import('@/lib/api')
  let tours: import('@/lib/types').Tour[] = []
  try {
    const data = await fetchHotelTours(slug)
    tours = (data.tours ?? [])
      .sort((a, b) => (a.departure_date || '').localeCompare(b.departure_date || ''))
      .slice(0, 4)
  } catch { return null }
  if (tours.length === 0) return null

  function fmtShort(s: string | null) {
    if (!s) return null
    const [y, m, d] = s.split('T')[0].split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
  }

  function TourTransportIcon({ transport }: { transport: string | null }) {
    const t = (transport ?? '').toLowerCase()
    if (t.includes('autobus') || t.includes('vlak')) return <Bus className="w-3 h-3" />
    if (t.includes('vlastní') || t.includes('vlastni')) return <Car className="w-3 h-3" />
    if (t.includes('leteck') || /[A-Z]{3}[→>-][A-Z]{3}/.test(transport ?? '')) return <Plane className="w-3 h-3" />
    return null
  }

  return (
    <div className="space-y-2">
      {tours.map(tour => {
        const dep = fmtShort(tour.departure_date)
        const ret = fmtShort(tour.return_date ?? null)
        return (
          <div key={tour.id} className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-700">
              {dep}
              {ret && <span className="font-normal text-gray-400"> → {ret}</span>}
            </span>
            <div className="flex items-center gap-1 text-[#0093FF] flex-shrink-0">
              <TourTransportIcon transport={tour.transport} />
              {tour.departure_city && (
                <span className="text-[10px] text-gray-400 truncate max-w-[60px]">{tour.departure_city}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

async function NearbyHotelsGrid({ lat, lon, exclude }: { lat: number; lon: number; exclude: string }) {
  const { fetchNearbyHotels } = await import('@/lib/api')
  let nearby: import('@/lib/types').NearbyHotel[] = []
  try {
    nearby = await fetchNearbyHotels(lat, lon, exclude, 8)
  } catch {
    return null
  }
  if (nearby.length === 0) return null

  function formatPriceShort(p: number) {
    return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(p)
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-[10px] font-bold text-[#0093FF] uppercase tracking-[0.16em] mb-1.5">Podobné hotely</p>
        <h2
          className="font-bold text-gray-900 leading-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2vw, 26px)' }}
        >
          Hotely <em className="not-italic text-[#0093FF]">v okolí</em>
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 lg:gap-6">
        {nearby.map((n) => (
          <Link key={n.slug} href={`/hotel/${n.slug}`} className="block group">
            {/* Image — matches HotelCard */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.10)] group-hover:shadow-[0_8px_28px_rgba(0,0,0,0.16)] transition-shadow duration-300">
              {n.thumbnail_url ? (
                <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.05]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.thumbnail_url} alt={n.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                  <PiBuildings className="w-8 h-8 text-blue-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              {n.distance_km != null && (
                <div className="absolute bottom-3 left-3 z-10">
                  <span className="text-[11px] font-semibold text-white px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(6px)' }}>
                    {Number(n.distance_km).toFixed(1)} km
                  </span>
                </div>
              )}
            </div>
            {/* Info strip — same as HotelCard */}
            <div className="px-0.5">
              <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                {n.stars ? (
                  <span className="text-amber-400 text-[11px] leading-none tracking-tighter flex-shrink-0">
                    {'★'.repeat(Math.min(n.stars, 5))}
                  </span>
                ) : null}
                <span className="text-[11px] text-gray-500 truncate">
                  {[n.resort_town, n.country].filter(Boolean).join(', ')}
                </span>
              </div>
              <h3
                className="font-bold text-gray-900 leading-snug line-clamp-1 mb-2.5 group-hover:text-[#0093FF] transition-colors duration-200"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1rem' }}
              >
                {n.name}
              </h3>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[16px] font-bold text-[#039669] tabular-nums">{formatPriceShort(n.min_price)}</span>
                  <span className="text-[12px] text-gray-400 ml-1">Kč / os.</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-[#C8E3FF] bg-[#EDF6FF] group-hover:bg-[#0093FF] group-hover:border-[#0093FF] transition-all duration-200 overflow-hidden flex-shrink-0 px-2.5 py-[7px] group-hover:px-3.5">
                  <span className="text-[11px] font-semibold text-[#0093FF] group-hover:text-white transition-colors duration-200 max-w-0 group-hover:max-w-[56px] overflow-hidden whitespace-nowrap">
                    Zobrazit
                  </span>
                  <PiArrowRight className="w-3.5 h-3.5 text-[#0093FF] group-hover:text-white transition-all duration-200 group-hover:translate-x-0.5 flex-shrink-0" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

async function HotelMapWithNearby({ hotel, slug }: { hotel: import('@/lib/types').Hotel; slug: string }) {
  const { fetchNearbyHotels } = await import('@/lib/api')
  type MapNearby = {
    id: number; slug: string; name: string; stars: number | null
    thumbnail_url: string | null; min_price: number; resort_town: string | null
    latitude: number; longitude: number; distance_km?: number
  }
  let nearbyForMap: MapNearby[] = []
  if (hotel.latitude && hotel.longitude) {
    try {
      const raw = await fetchNearbyHotels(hotel.latitude, hotel.longitude, slug, 20)
      nearbyForMap = raw
        .filter((n) => n.latitude != null && n.longitude != null)
        .map((n) => ({
          id: n.id ?? 0,
          slug: n.slug,
          name: n.name,
          stars: n.stars,
          thumbnail_url: n.thumbnail_url,
          min_price: n.min_price,
          resort_town: n.resort_town ?? null,
          latitude: n.latitude!,
          longitude: n.longitude!,
          distance_km: n.distance_km,
        }))
    } catch { /* ignore */ }
  }
  return <HotelMap hotel={hotel} nearby={nearbyForMap} />
}
