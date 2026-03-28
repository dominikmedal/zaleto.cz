import { Suspense } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { PiCalendarStar, PiAirplane, PiGlobe, PiTag, PiTimer, PiBuildings, PiSun } from 'react-icons/pi'
import HomeStepper from '@/components/HomeStepper'
import Header from '@/components/Header'
import HotelGrid from '@/components/HotelGrid'
import DestinationCarousel from '@/components/DestinationCarousel'
import { fetchDestinations, fetchFilters, fetchWikiSummary, fetchDestinationPhoto, fetchDestinationAI, fetchHotels } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import type { Filters } from '@/lib/types'
import JsonLd from '@/components/JsonLd'
import FilteringBar from '@/components/FilteringBar'
import DestinationHeroAI from '@/components/DestinationHeroAI'
import { getCountryFlag } from '@/lib/countryFlags'

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const destination = Array.isArray(searchParams.destination)
    ? searchParams.destination[0]
    : searchParams.destination

  const tourType = Array.isArray(searchParams.tour_type)
    ? searchParams.tour_type[0]
    : searchParams.tour_type

  if (destination && !destination.includes(',')) {
    const wiki = await fetchWikiSummary(destination).catch(() => null)
    const name = wiki?.title ?? destination
    const description = wiki
      ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
      : `Porovnejte zájezdy do destinace ${name} od předních českých cestovních kanceláří.`
    return {
      title: `Zájezdy ${name} 2026 — Srovnej ceny CK | Zaleto`,
      description,
      alternates: { canonical: `https://zaleto.cz/?destination=${encodeURIComponent(destination)}` },
      openGraph: {
        title: `Zájezdy ${name} 2026 | Zaleto`,
        description,
        url: `https://zaleto.cz/?destination=${encodeURIComponent(destination)}`,
        type: 'website',
      },
    }
  }

  if (tourType === 'last_minute') {
    return {
      title: 'Last minute zájezdy 2026 — Srovnej ceny CK | Zaleto',
      description: 'Nejlepší last minute zájezdy s odletem v nejbližších dnech. Porovnejte ceny od předních českých cestovních kanceláří.',
      openGraph: {
        title: 'Last minute zájezdy 2026 | Zaleto',
        description: 'Nejlepší last minute zájezdy za zvýhodněné ceny. Vyber, rezervuj a jeď.',
        url: 'https://zaleto.cz/?tour_type=last_minute',
        type: 'website',
      },
    }
  }

  if (tourType === 'first_minute') {
    return {
      title: 'First minute zájezdy 2026 — Srovnej ceny CK | Zaleto',
      description: 'Nejlepší first minute zájezdy pro ty, kdo plánují s předstihem. Porovnejte ceny od předních českých cestovních kanceláří.',
      openGraph: {
        title: 'First minute zájezdy 2026 | Zaleto',
        description: 'Výhodné zájezdy pro včasné rezervace. Nejlepší ceny first minute.',
        url: 'https://zaleto.cz/?tour_type=first_minute',
        type: 'website',
      },
    }
  }

  const titles = [
    'Zájezdy 2026 levně | Srovnávač dovolených online – Zaleto.cz',
    'Levné zájezdy od CK na jednom místě | Srovnání dovolených – Zaleto.cz',
    'Dovolená levně 2026 | Nejlepší zájezdy od všech CK – Zaleto.cz',
    'Najdi nejlevnější dovolenou ✈️ | Srovnávač zájezdů Zaleto.cz',
    'Porovnej zájezdy a ušetři tisíce | Zaleto.cz – dovolená chytře',
    'Last minute zájezdy levně 🌴 | Zaleto.cz – srovnávač dovolených',
    'Levné zájezdy, last minute, dovolená u moře | Srovnávač Zaleto.cz',
    'Zájezdy k moři 2026 | Last minute, all inclusive – Zaleto.cz',
  ]
  const title = titles[Math.floor(Math.random() * titles.length)]
  return {
    title,
    description: 'Porovnejte tisíce leteckých zájezdů od předních českých cestovních kanceláří. Egypt, Řecko, Turecko, Chorvatsko a další. Filtrujte podle termínu, stravování a ceny.',
    alternates: { canonical: 'https://zaleto.cz' },
    openGraph: {
      title: 'Zaleto — Srovnávač leteckých zájezdů',
      description: 'Najděte nejlevnější zájezdy do Egypta, Řecka, Turecka a dalších destinací. Porovnání cen všech CK na jednom místě.',
      url: 'https://zaleto.cz',
      type: 'website',
    },
  }
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Zaleto',
  url: 'https://zaleto.cz',
  description: 'Srovnávač leteckých zájezdů od předních českých cestovních kanceláří.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://zaleto.cz/?destination={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>
}

function getParam(p: string | string[] | undefined): string | undefined {
  return Array.isArray(p) ? p[0] : p
}

const fmtShort = (n: number | null) => {
  if (n == null) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mil.`
  if (n >= 10_000)    return `${Math.round(n / 1000)} tis.`
  if (n >= 1_000)     return `${(n / 1000).toFixed(1).replace('.', ',')} tis.`
  return n.toLocaleString('cs-CZ')
}
const hasActiveFilter = (f: Filters) =>
  !!(f.destination || f.date_from || f.date_to || f.duration || f.min_price || f.max_price || f.stars || f.meal_plan || f.transport || f.tour_type || f.departure_city)

export default async function HomePage({ searchParams }: PageProps) {
  const filters: Filters = {
    destination: getParam(searchParams.destination),
    date_from:   getParam(searchParams.date_from),
    date_to:     getParam(searchParams.date_to),
    duration:    getParam(searchParams.duration),
    min_price:   getParam(searchParams.min_price)  ? parseFloat(getParam(searchParams.min_price)!)  : undefined,
    max_price:   getParam(searchParams.max_price)  ? parseFloat(getParam(searchParams.max_price)!)  : undefined,
    stars:       getParam(searchParams.stars),
    meal_plan:      getParam(searchParams.meal_plan),
    transport:      getParam(searchParams.transport),
    tour_type:      getParam(searchParams.tour_type),
    departure_city: getParam(searchParams.departure_city),
    sort:           getParam(searchParams.sort) || 'price_asc',
  }

  const singleDest = filters.destination && !filters.destination.includes(',') ? filters.destination : null
  const tourType = filters.tour_type
  const noFilters = !hasActiveFilter(filters)

  const [destinations, meta, wiki] = await Promise.all([
    fetchDestinations().catch(() => []),
    fetchFilters().catch(() => ({ mealPlans: [], priceRange: { min: 0, max: 200000 }, durations: [], stars: [], transports: [], totalTours: 0, totalHotels: 0, departureCities: [] })),
    singleDest ? fetchWikiSummary(singleDest).catch(() => null) : Promise.resolve(null),
  ])

  // Hotels for tips (only on homepage with no filters)
  const tipHotels = noFilters
    ? await fetchHotels({ sort: 'price_asc', limit: 60 }).then(r => r.hotels.filter(h => h.thumbnail_url)).catch(() => [])
    : []

  const now = new Date()
  const dayOfYear  = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const weekOfYear = Math.floor(dayOfYear / 7)
  const dailyIdx   = tipHotels.length > 0 ? dayOfYear % tipHotels.length : 0
  let   weeklyIdx  = tipHotels.length > 1 ? (weekOfYear * 7 + 3) % tipHotels.length : 0
  if (weeklyIdx === dailyIdx) weeklyIdx = (weeklyIdx + 1) % tipHotels.length
  const dailyTip  = tipHotels[dailyIdx]  ?? null
  const weeklyTip = tipHotels[weeklyIdx] ?? null

  // Hero photo + AI content — parallel when destination selected
  const [heroPhoto, destAI] = await Promise.all([
    singleDest ? fetchDestinationPhoto(singleDest).catch(() => null) : Promise.resolve(null),
    singleDest ? fetchDestinationAI(singleDest).catch(() => null) : Promise.resolve(null),
  ])

  // Top unique regions with hotel counts
  const regionMap = new Map<string, number>()
  for (const d of destinations) {
    const region = d.destination.split('/').map(s => s.trim())[1] ?? d.destination.split('/')[0].trim()
    regionMap.set(region, (regionMap.get(region) ?? 0) + d.hotel_count)
  }
  const topRegions = [...regionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([region, count]) => ({ region, count }))

  // Fetch destination photos for carousel — Pexels (all parallel, cached via backend SQLite)
  const regionPhotos = noFilters
    ? await Promise.all(topRegions.map(({ region }) => fetchDestinationPhoto(region).catch(() => null)))
    : []

  const countryCount = new Set(destinations.map(d => d.country)).size

  // Prefer AI description over wiki
  const aiHeroText = destAI?.description ? destAI.description.split(/\n\n+/)[0] : null
  const wikiDescription = wiki
    ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ')
    : ''
  const heroDescription = aiHeroText ?? wikiDescription

  // Flag for country destinations
  const singleDestFlag = singleDest ? getCountryFlag(singleDest) : null
  const heroTitle = singleDest ? (wiki ? wiki.title : singleDest) : null

  // Breadcrumb from DB: find country (and optionally resort) for the selected region/resort
  const breadcrumb: { label: string; href: string }[] = []
  if (singleDest) {
    // Try to find it as a region (middle part of destination path)
    const asRegion = destinations.find(d => {
      const parts = d.destination.split('/').map(s => s.trim())
      return parts[1] === singleDest || parts[0] === singleDest
    })
    // Or as a resort_town
    const asResort = destinations.find(d => d.resort_town === singleDest)
    const row = asRegion ?? asResort

    if (row) {
      if (row.country && row.country !== singleDest) {
        breadcrumb.push({ label: row.country, href: `/destinace/${slugify(row.country)}` })
      }
      const region = row.destination.split('/').map(s => s.trim())[1] ?? row.destination.split('/')[0].trim()
      if (asResort && region !== singleDest) {
        breadcrumb.push({ label: region, href: `/destinace/${slugify(region)}` })
      }
      breadcrumb.push({ label: singleDest, href: `/destinace/${slugify(singleDest)}` })
    }
  }

  return (
    <div className="min-h-screen">
      <JsonLd data={websiteSchema} />
      <Header />

      {/* ── Full-bleed hero (destination selected + photo available) ── */}
      {heroPhoto && singleDest && (
        <div className="relative overflow-hidden h-[300px] sm:h-[380px]">
          <Image
            src={heroPhoto}
            alt={singleDest}
            fill
            className="object-cover"
            style={{ filter: 'brightness(1.05) saturate(1.05)' }}
            unoptimized
            priority
          />
          {/* Left gradient — content readable */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, rgba(245,250,255,1) 0%, rgba(245,250,255,0.88) 30%, rgba(245,250,255,0.55) 58%, rgba(245,250,255,0.0) 100%)'
          }} />
          {/* Bottom fade into site bg */}
          <div className="absolute inset-x-0 bottom-0 h-32" style={{
            background: 'linear-gradient(to top, rgba(245,250,255,1) 0%, rgba(245,250,255,0.6) 50%, transparent 100%)'
          }} />
          {/* Content — anchored bottom-left inside max-w container */}
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-[1680px] mx-auto px-4 sm:px-10 w-full pb-6">
              {breadcrumb.length > 0 && (
                <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-3">
                  <Link href="/" className="hover:text-[#008afe] transition-colors">Všechny zájezdy</Link>
                  {breadcrumb.map((crumb, i) => (
                    <span key={crumb.href} className="flex items-center gap-1">
                      <span className="text-gray-200">/</span>
                      {i === breadcrumb.length - 1
                        ? <span className="text-gray-700 font-medium">{crumb.label}</span>
                        : <Link href={crumb.href} className="hover:text-[#008afe] transition-colors">{crumb.label}</Link>
                      }
                    </span>
                  ))}
                </nav>
              )}
              <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-tight mb-2 drop-shadow-sm flex items-center gap-3 flex-wrap">
                {singleDestFlag && (
                  <span className="inline-flex items-center justify-center rounded-lg overflow-hidden leading-none flex-shrink-0 shadow-sm" style={{ fontSize: '0.75em', lineHeight: 1, padding: '0.05em 0.1em' }}>
                    {singleDestFlag}
                  </span>
                )}
                {heroTitle}
              </h1>
              <p className="text-gray-700 text-sm sm:text-base max-w-2xl leading-relaxed">
                {heroDescription || `Zájezdy do destinace ${singleDest} od předních cestovních kanceláří.`}
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1680px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-5">

        {/* ── Compact hero (no destination photo) ── */}
        {!(heroPhoto && singleDest) && (
          <>
            <div className="lg:flex lg:items-end lg:justify-between lg:gap-8">

              {/* Title + description */}
              <div className="min-w-0">
                {breadcrumb.length > 0 && (
                  <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-3">
                    <Link href="/" className="hover:text-[#008afe] transition-colors">Všechny zájezdy</Link>
                    {breadcrumb.map((crumb, i) => (
                      <span key={crumb.label} className="flex items-center gap-1">
                        <span className="text-gray-200">/</span>
                        {i === breadcrumb.length - 1
                          ? <span className="text-gray-700 font-medium">{crumb.label}</span>
                          : <Link href={crumb.href} className="hover:text-[#008afe] transition-colors">{crumb.label}</Link>
                        }
                      </span>
                    ))}
                  </nav>
                )}
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight mb-2 flex items-center gap-3 flex-wrap">
                  {singleDest
                    ? <>
                        {singleDestFlag && (
                          <span className="inline-flex items-center justify-center rounded-lg overflow-hidden leading-none flex-shrink-0 shadow-sm" style={{ fontSize: '0.75em', lineHeight: 1, padding: '0.05em 0.1em' }}>
                            {singleDestFlag}
                          </span>
                        )}
                        {heroTitle}
                      </>
                    : tourType === 'last_minute'
                    ? <span className="text-red-500 inline-flex items-center gap-2"><PiTimer className="w-7 h-7 sm:w-9 sm:h-9" />Last minute 2026</span>
                    : tourType === 'first_minute'
                    ? <span className="text-emerald-500 inline-flex items-center gap-2"><PiCalendarStar className="w-7 h-7 sm:w-9 sm:h-9" />First minute 2026</span>
                    : <>Najdi svůj zájezd <span className="text-[#008afe]">snadno a rychle</span>.</>}
                </h1>
                <p className="text-gray-500 text-sm sm:text-base leading-relaxed max-w-3xl">
                  {singleDest
                    ? (heroDescription || `Zájezdy do destinace ${singleDest} od předních cestovních kanceláří.`)
                    : tourType === 'last_minute'
                    ? 'Zájezdy s odletem v nejbližších dnech za zvýhodněné ceny. Vyber, rezervuj a jeď.'
                    : tourType === 'first_minute'
                    ? 'Výhodné zájezdy pro ty, kdo plánují s předstihem. Nejlepší ceny pro včasné rezervace.'
                    : 'Porovnejte termíny a ceny od předních cestovních kanceláří na jednom místě.'}
                </p>
              </div>

              {/* Stats — pouze na filtrovaných stránkách (ne default homepage) */}
              {!singleDest && (!noFilters || !!tourType) && (() => {
                const statsArr = [
                  { icon: <PiBuildings className="w-3 h-3" />, value: fmtShort(meta.totalHotels ?? 0), label: 'hotelů' },
                  { icon: <PiAirplane  className="w-3 h-3" />, value: fmtShort(meta.totalTours ?? 0),  label: 'termínů' },
                  { icon: <PiGlobe    className="w-3 h-3" />, value: String(countryCount),             label: 'zemí' },
                  { icon: <PiTag      className="w-3 h-3" />, value: `od ${fmtShort(meta.priceRange?.min ?? null)}`, label: 'Kč' },
                ]
                return (
                  <div className="hidden sm:block lg:flex-shrink-0 mt-5 lg:mt-0">
                    <div className="lg:hidden grid grid-cols-4 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      {statsArr.map(({ icon, value, label }) => (
                        <div key={label} className="flex flex-col items-center justify-center py-4 px-3 border-r border-gray-100 last:border-r-0">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                            <span className="text-[#008afe]">{icon}</span>
                            {label}
                          </div>
                          <span className="text-xl font-bold text-gray-900 leading-none tabular-nums">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="hidden lg:flex items-stretch divide-x divide-gray-100">
                      {statsArr.map(({ icon, value, label }) => (
                        <div key={label} className="flex flex-col justify-center px-5 last:pr-0 first:pl-0">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                            <span className="text-[#008afe]">{icon}</span>
                            {label}
                          </div>
                          <span className="text-[22px] font-bold text-gray-900 leading-none tabular-nums">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

            </div>

            {/* ── Stepper + stats (pouze default homepage) ── */}
            {noFilters && !singleDest && !tourType && (
              <HomeStepper
                totalHotels={meta.totalHotels ?? 0}
                totalTours={meta.totalTours ?? 0}
                countryCount={countryCount}
                minPrice={meta.priceRange?.min ?? null}
              />
            )}
          </>
        )}

        {/* ── Popular destination cards (only when no filters active) ── */}
        {noFilters && topRegions.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Oblíbené destinace
            </p>
            <DestinationCarousel
              items={topRegions.map(({ region, count }, i) => ({
                region,
                count,
                thumb: regionPhotos[i] ?? null,
              }))}
            />
          </section>
        )}

        {/* ── Tips ── */}
        {noFilters && (dailyTip || weeklyTip) && (
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Tipy pro vás</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dailyTip && (
                <Link href={`/hotel/${dailyTip.slug}`} className="group relative rounded-2xl overflow-hidden bg-gray-100 block" style={{ aspectRatio: '16/7' }}>
                  <Image src={dailyTip.thumbnail_url!} alt={dailyTip.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-amber-400 text-white px-3 py-1.5 rounded-full shadow-sm">
                      <PiSun className="w-3.5 h-3.5" /> Tip dne
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-white/65 text-xs mb-1">{dailyTip.stars ? '★'.repeat(dailyTip.stars) + '  ·  ' : ''}{[dailyTip.resort_town, dailyTip.country].filter(Boolean).join(', ')}</p>
                    <p className="text-white font-bold text-xl leading-tight group-hover:underline underline-offset-2 mb-1.5">{dailyTip.name}</p>
                    <p className="text-emerald-300 font-semibold text-sm">od {fmtShort(dailyTip.min_price ?? null)} Kč / osoba</p>
                  </div>
                </Link>
              )}
              {weeklyTip && (
                <Link href={`/hotel/${weeklyTip.slug}`} className="group relative rounded-2xl overflow-hidden bg-gray-100 block" style={{ aspectRatio: '16/7' }}>
                  <Image src={weeklyTip.thumbnail_url!} alt={weeklyTip.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-blue-500 text-white px-3 py-1.5 rounded-full shadow-sm">
                      <PiCalendarStar className="w-3.5 h-3.5" /> Tip týdne
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="text-white/65 text-xs mb-1">{weeklyTip.stars ? '★'.repeat(weeklyTip.stars) + '  ·  ' : ''}{[weeklyTip.resort_town, weeklyTip.country].filter(Boolean).join(', ')}</p>
                    <p className="text-white font-bold text-xl leading-tight group-hover:underline underline-offset-2 mb-1.5">{weeklyTip.name}</p>
                    <p className="text-emerald-300 font-semibold text-sm">od {fmtShort(weeklyTip.min_price ?? null)} Kč / osoba</p>
                  </div>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ── AI destination description + excursions ── */}
        {singleDest && destAI && (
          <DestinationHeroAI data={destAI} />
        )}

        {/* ── Filter animation bar ── */}
        <Suspense>
          <FilteringBar />
        </Suspense>

        {/* ── Hotel grid ── */}
        <Suspense>
          <HotelGrid adults={parseInt(getParam(searchParams.adults) || '2')} />
        </Suspense>

      </main>
    </div>
  )
}
