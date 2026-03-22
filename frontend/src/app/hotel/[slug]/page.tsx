import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PiMapPin, PiStarFill, PiArrowLeft, PiForkKnife, PiCalendarBlank, PiCoins, PiBuildings, PiCheckCircle, PiCheck, PiHouseSimple, PiSparkle, PiRuler, PiWallet, PiMapTrifold, PiChatCircleDots, PiTimer, PiCalendarStar } from 'react-icons/pi'
import ScrollToButton from '@/components/ScrollToButton'
import ViewersBadge from '@/components/ViewersBadge'
import Header from '@/components/Header'
import HotelStickyBar from '@/components/HotelStickyBar'
import FavoriteButton from '@/components/FavoriteButton'
import TourDatesList from '@/components/TourDatesList'
import HotelGallery from '@/components/HotelGallery'
import ReviewsSection from '@/components/ReviewsSection'
import { fetchHotel, fetchHotelTours, fetchNearbyHotels } from '@/lib/api'
import JsonLd from '@/components/JsonLd'

// Leaflet needs browser APIs → dynamic import, no SSR
const HotelMap = dynamic(() => import('@/components/HotelMap'), { ssr: false })

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
    const title = `${hotel.name}${hotel.stars ? ` ${'★'.repeat(hotel.stars)}` : ''} — ${location}`
    const stars = hotel.stars ? `${hotel.stars}hvězdičkový hotel. ` : ''
    const description = hotel.description
      ? stripHtml(hotel.description).slice(0, 150) + '…'
      : `${stars}${hotel.name} v destinaci ${location}. Zájezdy od ${formatPrice(hotel.min_price)} / os. Porovnejte termíny a rezervujte přímo u CK.`
    const canonical = `https://zaleto.cz/hotel/${params.slug}`
    return {
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        url: canonical,
        images: hotel.thumbnail_url ? [{ url: hotel.thumbnail_url, width: 1200, height: 800, alt: hotel.name }] : [],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: hotel.thumbnail_url ? [hotel.thumbnail_url] : [],
      },
    }
  } catch {
    return { title: 'Hotel nenalezen' }
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

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-6 border-b border-gray-100 last:border-0">
      <h2 className="flex items-center gap-2.5 text-[17px] font-semibold text-gray-900 mb-5">
        <span className="text-[#008afe] flex-shrink-0">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default async function HotelDetailPage({ params }: Props) {
  let hotel: Awaited<ReturnType<typeof fetchHotel>>
  let toursData: Awaited<ReturnType<typeof fetchHotelTours>>

  try {
    ;[hotel, toursData] = await Promise.all([
      fetchHotel(params.slug),
      fetchHotelTours(params.slug),
    ])
  } catch {
    notFound()
  }

  const tours = toursData.tours

  const nearby = hotel.latitude && hotel.longitude
    ? await fetchNearbyHotels(hotel.latitude, hotel.longitude, params.slug, 8)
    : []

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

  // Unique meal plans from tours
  const mealPlans = [...new Set(tours.map(t => t.meal_plan).filter(Boolean))] as string[]

  // Price range from tours
  const prices = tours.map(t => t.price).filter(p => p > 0)
  const minTourPrice = prices.length ? Math.min(...prices) : hotel.min_price
  const maxTourPrice = prices.length ? Math.max(...prices) : null

  // Durations available
  const durations = [...new Set(tours.map(t => t.duration).filter(Boolean))].sort((a, b) => (a ?? 0) - (b ?? 0)) as number[]

  const hotelSchema = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: hotel.name,
    description: hotel.description ? stripHtml(hotel.description).slice(0, 500) : undefined,
    url: `https://zaleto.cz/hotel/${params.slug}`,
    image: photos[0] ?? hotel.thumbnail_url ?? undefined,
    ...(hotel.stars ? { starRating: { '@type': 'Rating', ratingValue: hotel.stars, bestRating: 5 } } : {}),
    ...(hotel.review_score ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: hotel.review_score.toFixed(1), bestRating: '10', reviewCount: 1 } } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: hotel.resort_town ?? hotel.destination ?? undefined,
      addressCountry: hotel.country ?? undefined,
    },
    ...(hotel.latitude && hotel.longitude ? { geo: { '@type': 'GeoCoordinates', latitude: hotel.latitude, longitude: hotel.longitude } } : {}),
    priceRange: minTourPrice ? `od ${formatPriceShort(minTourPrice)} Kč` : undefined,
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...(hotel.country ? [{ '@type': 'ListItem', position: 2, name: hotel.country, item: `https://zaleto.cz/?destination=${encodeURIComponent(hotel.country)}` }] : []),
      ...(hotel.destination && hotel.destination !== hotel.country ? [{ '@type': 'ListItem', position: 3, name: hotel.destination, item: `https://zaleto.cz/?destination=${encodeURIComponent(hotel.destination)}` }] : []),
      { '@type': 'ListItem', position: hotel.destination && hotel.destination !== hotel.country ? 4 : 3, name: hotel.name, item: `https://zaleto.cz/hotel/${params.slug}` },
    ],
  }

  return (
    <div className="min-h-screen">
      <JsonLd data={hotelSchema} />
      <JsonLd data={breadcrumbSchema} />
      <Header />

      <div className="max-w-[1680px] mx-auto px-6 sm:px-8 py-6">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center flex-wrap gap-1 text-xs text-gray-400">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-blue-500 transition-colors font-medium">
            <PiArrowLeft className="w-3 h-3" /> Zaleto
          </Link>
          {hotel.country && (
            <><span className="text-gray-200 select-none">/</span>
            <Link href={`/?destination=${encodeURIComponent(hotel.country)}`} className="hover:text-blue-500 transition-colors">{hotel.country}</Link></>
          )}
          {hotel.resort_town && hotel.resort_town !== hotel.country && (
            <><span className="text-gray-200 select-none">/</span>
            <Link href={`/?destination=${encodeURIComponent(hotel.resort_town)}`} className="hover:text-blue-500 transition-colors">{hotel.resort_town}</Link></>
          )}
          <span className="text-gray-200 select-none">/</span>
          <span className="text-gray-600 font-medium truncate max-w-[220px]">{hotel.name}</span>
        </nav>

        {/* Hotel header — above gallery, no background */}
        <div className="mb-5">
          {hotel.stars && hotel.stars > 0 && (
            <StarsRow count={hotel.stars} />
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2 mb-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">{hotel.name}</h1>
            {tours.some((t: any) => t.is_last_minute === 1) ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-red-500 px-2.5 py-1 rounded-lg shadow-sm">
                <PiTimer className="w-3.5 h-3.5 flex-shrink-0" />
                Last minute
              </span>
            ) : tours.some((t: any) => t.is_first_minute === 1) ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-lg shadow-sm">
                <PiCalendarStar className="w-3.5 h-3.5 flex-shrink-0" />
                First minute
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-gray-500 text-sm">
            <span className="flex items-center gap-1.5">
              <PiMapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              {[hotel.resort_town, hotel.destination, hotel.country].filter(Boolean).join(' · ')}
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              {hotel.agency}
            </span>
          </div>
        </div>

        {/* Gallery */}
        <HotelGallery photos={photos} name={hotel.name} />

        {/* ── Cena zájezdu — mobile only, right after gallery ── */}
        <div className="lg:hidden mt-4 bg-[#e1f2f3] rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-[#4d8a8c] mb-0.5">Nejnižší cena od osoby</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-[#0d4f52]">{formatPriceShort(minTourPrice)}</span>
                <span className="text-sm font-medium text-[#4d8a8c]">Kč</span>
              </div>
              {maxTourPrice && maxTourPrice !== minTourPrice && (
                <p className="text-xs text-[#4d8a8c]">max. {formatPriceShort(maxTourPrice)} Kč / os.</p>
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
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#b8dfe1]">
            <div>
              <p className="text-[10px] text-[#4d8a8c] uppercase tracking-widest mb-1">Termíny</p>
              <p className="text-lg font-extrabold text-[#0d4f52]">{tours.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#4d8a8c] uppercase tracking-widest mb-1">Délka</p>
              <p className="text-lg font-extrabold text-[#0d4f52]">
                {durations.length === 0 ? '—' : durations.length === 1 ? durations[0] : `${durations[0]}–${durations[durations.length - 1]}`}
                {durations.length > 0 && <span className="text-xs font-normal text-[#4d8a8c] ml-0.5">nocí</span>}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#4d8a8c] uppercase tracking-widest mb-1">Stravování</p>
              <p className="text-xs font-semibold text-[#0d4f52] leading-tight">
                {mealPlans.length === 0 ? '—' : mealPlans[0]}
                {mealPlans.length > 1 && <span className="text-[10px] text-[#4d8a8c] ml-1">+{mealPlans.length - 1}</span>}
              </p>
            </div>
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6">

              {hotel.description && (
                <Section title="O hotelu" icon={<PiHouseSimple className="w-5 h-5" />}>
                  <p className="text-gray-500 leading-relaxed text-sm whitespace-pre-line">
                    {stripHtml(hotel.description)}
                  </p>
                </Section>
              )}

              {amenitiesList.length > 0 && (
                <Section title="Vybavení a výhody" icon={<PiSparkle className="w-5 h-5" />}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4">
                    {amenitiesList.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <PiCheckCircle className="w-4 h-4 text-[#008afe] flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {distancesList.length > 0 && (
                <Section title="Vzdálenosti" icon={<PiRuler className="w-5 h-5" />}>
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
                </Section>
              )}

              {(mealPlans.length > 0 || hotel.food_options) && (
                <Section title="Stravování" icon={<PiForkKnife className="w-5 h-5" />}>
                  {mealPlans.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {mealPlans.map(m => (
                        <span key={m} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full">
                          <PiForkKnife className="w-3.5 h-3.5" /> {m}
                        </span>
                      ))}
                    </div>
                  )}
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
                </Section>
              )}

              {priceIncludesList.length > 0 && (
                <Section title="Co je v ceně" icon={<PiWallet className="w-5 h-5" />}>
                  <div className="grid sm:grid-cols-2 gap-y-2.5 gap-x-6">
                    {priceIncludesList.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <PiCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {hotel.latitude && hotel.longitude && (
                <Section title="Poloha na mapě" icon={<PiMapTrifold className="w-5 h-5" />}>
                  <HotelMap hotel={hotel} nearby={nearby} />
                  {nearby.length > 0 && (
                    <p className="mt-2 text-xs text-gray-400">Na mapě jsou vyznačeny i nejbližší hotely v okolí.</p>
                  )}
                </Section>
              )}

              <Section title="Recenze hostů" icon={<PiChatCircleDots className="w-5 h-5" />}>
                <ReviewsSection slug={params.slug} />
              </Section>

            </div>
          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-[116px] space-y-3 lg:max-h-[calc(100vh-132px)] lg:overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

              {/* Booking widget — hidden on mobile (shown above gallery instead) */}
              <div className="hidden lg:block bg-[#e1f2f3] rounded-2xl p-5 space-y-5">

                {/* Header */}
                <h3 className="flex items-center gap-2.5 text-[17px] font-semibold text-[#0d4f52]">
                  <span className="flex-shrink-0"><PiCoins className="w-5 h-5" /></span>
                  Cena zájezdu
                </h3>

                {/* Price */}
                <div>
                  <p className="text-xs text-[#4d8a8c] mb-1">Nejnižší cena od osoby</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-[#0d4f52]">{formatPriceShort(minTourPrice)}</span>
                    <span className="text-base font-medium text-[#4d8a8c]">Kč</span>
                  </div>
                  {maxTourPrice && maxTourPrice !== minTourPrice && (
                    <p className="text-xs text-[#4d8a8c] mt-0.5">max. {formatPriceShort(maxTourPrice)} Kč / os.</p>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1 border-t border-[#b8dfe1]">
                  <div>
                    <p className="text-[10px] text-[#4d8a8c] uppercase tracking-widest mb-1">Termíny</p>
                    <p className="text-lg font-extrabold text-[#0d4f52]">{tours.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#4d8a8c] uppercase tracking-widest mb-1">Délka pobytu</p>
                    <p className="text-lg font-extrabold text-[#0d4f52]">
                      {durations.length === 0 ? '—' : durations.length === 1 ? durations[0] : `${durations[0]}–${durations[durations.length - 1]}`}
                      {durations.length > 0 && <span className="text-xs font-normal text-[#4d8a8c] ml-1">nocí</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#4d8a8c] uppercase tracking-widest mb-1">Stravování</p>
                    <p className="text-sm font-semibold text-[#0d4f52] leading-tight">
                      {mealPlans.length === 0 ? '—' : mealPlans[0]}
                      {mealPlans.length > 1 && <span className="text-xs text-[#4d8a8c] ml-1">+{mealPlans.length - 1}</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#4d8a8c] uppercase tracking-widest mb-1">Lokalita</p>
                    <p className="text-xs font-medium text-[#0d4f52] leading-tight">
                      {[hotel.resort_town, hotel.country].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="space-y-2.5 pt-1 border-t border-[#b8dfe1]">
                  <ViewersBadge />
                  <ScrollToButton
                    targetId="terminy"
                    className="w-full bg-[#008afe] hover:bg-[#0079e5] active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-[#008afe]/25 text-sm tracking-wide"
                  >
                    <PiCalendarBlank className="w-4 h-4" />
                    Vybrat termín
                  </ScrollToButton>
                  <FavoriteButton slug={params.slug} name={hotel.name} variant="detail" className="w-full justify-center" />
                </div>
              </div>

              {/* Nearby hotels */}
              {nearby.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="flex items-center gap-2.5 text-[17px] font-semibold text-gray-900 mb-4">
                    <span className="text-[#008afe] flex-shrink-0"><PiMapPin className="w-5 h-5" /></span>
                    Hotely v okolí
                  </h3>
                  <div className="divide-y divide-gray-50">
                    {nearby.slice(0, 5).map(n => (
                      <Link
                        key={n.slug}
                        href={`/hotel/${n.slug}`}
                        className="flex items-center gap-3 py-2.5 group"
                      >
                        <div className="w-10 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {n.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={n.thumbnail_url} alt={n.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <PiBuildings className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-[#008afe] transition-colors">{n.name}</p>
                          <p className="text-[11px] text-gray-400">
                            {n.stars ? '★'.repeat(n.stars) : ''}{n.distance_km != null ? ` · ${n.distance_km.toFixed(1)} km` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 flex-shrink-0 tabular-nums">{formatPriceShort(n.min_price)} Kč</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Available dates — full width ── */}
        <div id="terminy" className="mt-12 scroll-mt-[140px]">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-bold text-gray-900">Dostupné termíny</h2>
            <span className="text-sm font-medium text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full tabular-nums">{tours.length}</span>
          </div>
          <TourDatesList tours={tours} slug={params.slug} />
        </div>
      </div>
    </div>
  )
}
