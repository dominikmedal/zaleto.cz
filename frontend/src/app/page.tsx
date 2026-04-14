import { Suspense } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { PiCalendarStar, PiAirplane, PiTimer, PiSun, PiArrowRight } from 'react-icons/pi'
import Header from '@/components/Header'
import HotelGrid from '@/components/HotelGrid'
import DestinationCarousel from '@/components/DestinationCarousel'
import DestinationCards from '@/components/DestinationCards'
import ArticlesSection from '@/components/ArticlesSection'
import { fetchDestinations, fetchFilters, fetchWikiSummary, fetchDestinationPhoto, fetchDestinationAI, fetchHotels, fetchArticles } from '@/lib/api'
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

  // Top unique regions with hotel counts + country mapping
  const regionMap = new Map<string, number>()
  const regionCountryMap = new Map<string, string>()
  for (const d of destinations) {
    const region = d.destination.split('/').map(s => s.trim())[1] ?? d.destination.split('/')[0].trim()
    regionMap.set(region, (regionMap.get(region) ?? 0) + d.hotel_count)
    if (d.country && !regionCountryMap.has(region)) regionCountryMap.set(region, d.country)
  }
  const topRegions = [...regionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([region, count]) => ({ region, count }))

  // Min price per region (from tipHotels — sorted price_asc)
  const regionMinPrice = new Map<string, number>()
  for (const h of tipHotels) {
    if (h.min_price == null) continue
    const region = (h.destination ?? '').split('/').map((s: string) => s.trim())[1]
      ?? (h.destination ?? '').split('/')[0]?.trim()
      ?? h.resort_town
    if (region && !regionMinPrice.has(region)) regionMinPrice.set(region, h.min_price)
    if (h.country && !regionMinPrice.has(h.country)) regionMinPrice.set(h.country, h.min_price)
  }

  // Fetch destination photos for carousel — Pexels (all parallel, cached via backend SQLite)
  const regionPhotos = noFilters
    ? await Promise.all(topRegions.map(({ region }) => fetchDestinationPhoto(region).catch(() => null)))
    : []

  // Filter out regions without photos
  const topRegionsWithPhotos = topRegions
    .map((r, i) => ({ ...r, thumb: regionPhotos[i] }))
    .filter((r): r is typeof r & { thumb: string } => r.thumb != null)

  // Articles — homepage (no filters) or destination page
  const articles = (noFilters && !singleDest && !tourType)
    ? await fetchArticles(6).catch(() => [])
    : singleDest
    ? await fetchArticles(6, singleDest).catch(() => [])
    : []

  // Photos for articles
  const articleLocations = [...new Set(articles.map(a => a.location).filter(Boolean) as string[])]
  const articlePhotoResults = await Promise.all(
    articleLocations.map(loc => fetchDestinationPhoto(loc).catch(() => null))
  )
  const articleImageMap: Record<string, string | null> = {}
  articleLocations.forEach((loc, i) => { articleImageMap[loc] = articlePhotoResults[i] })

  // Filter out articles without a location (guaranteed no photo); articles with location show photo or gradient
  const articlesWithPhotos = articles.filter(a => Boolean(a.location)).slice(0, 3)

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
            {noFilters && !singleDest && !tourType ? (

              /* ═══ DEFAULT HOMEPAGE — editorial split hero ═══ */
              <div className="py-4 lg:py-8">
                <style>{`
                  @keyframes _hero_up {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                  }
                  ._hu { animation: _hero_up 0.55s cubic-bezier(.22,.68,0,1.15) both; }
                  ._hu1 { animation-delay: 0ms; }
                  ._hu2 { animation-delay: 80ms; }
                  ._hu3 { animation-delay: 160ms; }
                  ._hu4 { animation-delay: 220ms; }
                  @keyframes _stat_in {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                  }
                  ._si { animation: _stat_in 0.4s ease-out both; }
                  ._si1 { animation-delay: 320ms; }
                  ._si2 { animation-delay: 380ms; }
                  ._si3 { animation-delay: 440ms; }
                  ._si4 { animation-delay: 500ms; }
                `}</style>

                <div className="flex flex-col lg:flex-row items-stretch justify-between gap-8 lg:gap-12">

                  {/* ── Left: heading + stats ── */}
                  <div className="flex-shrink-0 lg:max-w-[400px] flex flex-col relative">

                    {/* Ambient glow behind heading */}
                    <div className="absolute -top-8 -left-8 w-72 h-72 rounded-full pointer-events-none"
                      style={{ background: 'radial-gradient(circle, rgba(0,147,255,0.07) 0%, transparent 70%)', zIndex: 0 }} />

                    {/* Eyebrow */}
                    <div className="_hu _hu1 glass-pill inline-flex items-center gap-2 self-start mb-6 px-3.5 py-1.5 rounded-full relative z-10">
                      <PiAirplane className="w-3.5 h-3.5 text-[#0093FF]" />
                      <span className="text-[11px] font-bold text-[#0093FF] tracking-[0.06em] uppercase">Nejlepší vyhledávač a srovnávač zájezdů</span>
                    </div>

                    {/* Heading */}
                    <div className="_hu _hu2 relative z-10 mb-5">
                      <h1 className="font-bold text-gray-900 leading-[0.95] tracking-tight"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(50px, 5.6vw, 80px)' }}>
                        Najdi svůj<br />
                        {/* "zájezd" with blue highlight slab behind it */}
                        <span className="relative inline-block">
                          <span className="absolute inset-x-0 bottom-[6%] h-[38%] rounded-md pointer-events-none"
                            style={{ background: 'rgba(0,147,255,0.11)', zIndex: 0 }} />
                          <em className="not-italic text-[#0093FF] relative" style={{ zIndex: 1 }}>zájezd</em>
                        </span><br />
                        snadno.
                      </h1>
                    </div>

                    {/* Subtitle with decorative left bar */}
                    <div className="_hu _hu3 flex gap-3 mb-7 relative z-10">
                      <span className="flex-shrink-0 w-[3px] rounded-full self-stretch"
                        style={{ background: 'linear-gradient(to bottom, #0093FF, rgba(0,147,255,0.0))' }} />
                      <p className="text-gray-500 text-[15px] leading-relaxed">
                        Porovnejte termíny a ceny od předních cestovních kanceláří na jednom místě.
                      </p>
                    </div>

                    {/* ── Stats grid — liquid glass pills ── */}
                    <div className="_hu _hu4 grid grid-cols-2 gap-2.5 relative z-10">
                      {[
                        { value: fmtShort(meta.totalHotels ?? 0),                          label: 'hotelů',    accent: false },
                        { value: fmtShort(meta.totalTours ?? 0),                           label: 'termínů',   accent: false },
                        { value: String(countryCount),                                      label: 'zemí',      accent: false },
                        { value: `od\u00a0${fmtShort(meta.priceRange?.min ?? null)}\u00a0Kč`, label: 'cena / os.', accent: true  },
                      ].map((s, i) => (
                        <div
                          key={s.label}
                          className={`_si _si${i + 1} glass-pill rounded-2xl px-4 py-3.5 flex flex-col gap-1.5`}
                          style={s.accent ? {
                            background: 'rgba(0,147,255,0.09)',
                            border: '1px solid rgba(0,147,255,0.22)',
                            boxShadow: '0 2px 12px rgba(0,147,255,0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
                          } : undefined}
                        >
                          <p className={`text-[22px] font-bold tabular-nums leading-none tracking-tight ${s.accent ? 'text-[#0075d4]' : 'text-gray-900'}`}>
                            {s.value}
                          </p>
                          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${s.accent ? 'text-[#0093FF]/60' : 'text-gray-400'}`}>
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* ── Right: destination mosaic carousel ── */}
                  {topRegionsWithPhotos.length >= 1 && (
                    <>
                      {/* Mobile */}
                      <div className="block lg:hidden w-full">
                        <DestinationCarousel
                          items={topRegionsWithPhotos.map(({ region, count, thumb }) => ({
                            region, count, thumb,
                            minPrice: regionMinPrice.get(region)
                              ?? regionMinPrice.get(regionCountryMap.get(region) ?? '')
                              ?? null,
                          }))}
                        />
                      </div>
                      {/* Desktop */}
                      <div className="hidden lg:flex flex-1 min-w-0 flex-col" style={{ minHeight: 380 }}>
                        <DestinationCarousel
                          items={topRegionsWithPhotos.map(({ region, count, thumb }) => ({
                            region, count, thumb,
                            minPrice: regionMinPrice.get(region)
                              ?? regionMinPrice.get(regionCountryMap.get(region) ?? '')
                              ?? null,
                          }))}
                        />
                      </div>
                    </>
                  )}

                </div>

              </div>

            ) : (

              /* ═══ FILTERED / DESTINATION / TOUR TYPE HERO ═══ */
              <div className="lg:flex lg:items-end lg:justify-between lg:gap-8 py-2">
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

              </div>

            )}
          </>
        )}


        {/* ── Tips ── */}
        {noFilters && (dailyTip || weeklyTip) && (
          <section className="section-island">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Tipy pro vás</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dailyTip && (
                <Link
                  href={`/hotel/${dailyTip.slug}`}
                  className="group block rounded-2xl overflow-hidden bg-gray-100 relative"
                  style={{ aspectRatio: '16/7', boxShadow: '0 1px 6px rgba(0,0,0,0.07), 0 4px 16px rgba(0,80,180,0.06)' }}
                >
                  <Image src={dailyTip.thumbnail_url!} alt={dailyTip.name} fill className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                  {/* Badge */}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-amber-400 text-white px-2.5 py-1 rounded-full shadow-sm">
                      <PiSun className="w-3 h-3" /> Tip dne
                    </span>
                  </div>

                  {/* Content overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white/55 text-[11px] mb-1.5 truncate">
                        {dailyTip.stars ? '★'.repeat(Math.min(dailyTip.stars, 5)) + '  ·  ' : ''}
                        {[dailyTip.resort_town, dailyTip.country].filter(Boolean).join(', ')}
                      </p>
                      <p
                        className="text-white font-bold leading-tight line-clamp-2 mb-2"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(15px, 2vw, 19px)' }}
                      >
                        {dailyTip.name}
                      </p>
                      <p className="text-[12px] font-medium text-white/70">
                        od <span className="text-white font-bold">{fmtShort(dailyTip.min_price ?? null)} Kč</span> / os.
                      </p>
                    </div>

                    {/* Expanding pill CTA */}
                    <div className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 group-hover:bg-white group-hover:border-white transition-all duration-200 overflow-hidden flex-shrink-0 px-2.5 py-2 group-hover:px-3.5" style={{ backdropFilter: 'blur(8px)' }}>
                      <span className="text-[12px] font-semibold text-white group-hover:text-[#0093FF] transition-colors duration-200 max-w-0 group-hover:max-w-[60px] overflow-hidden whitespace-nowrap">
                        Zobrazit
                      </span>
                      <PiArrowRight className="w-3.5 h-3.5 text-white group-hover:text-[#0093FF] transition-all duration-200 group-hover:translate-x-0.5 flex-shrink-0" />
                    </div>
                  </div>
                </Link>
              )}
              {weeklyTip && (
                <Link
                  href={`/hotel/${weeklyTip.slug}`}
                  className="group block rounded-2xl overflow-hidden bg-gray-100 relative"
                  style={{ aspectRatio: '16/7', boxShadow: '0 1px 6px rgba(0,0,0,0.07), 0 4px 16px rgba(0,80,180,0.06)' }}
                >
                  <Image src={weeklyTip.thumbnail_url!} alt={weeklyTip.name} fill className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                  {/* Badge */}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-[#0093FF] text-white px-2.5 py-1 rounded-full shadow-sm">
                      <PiCalendarStar className="w-3 h-3" /> Tip týdne
                    </span>
                  </div>

                  {/* Content overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-5 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white/55 text-[11px] mb-1.5 truncate">
                        {weeklyTip.stars ? '★'.repeat(Math.min(weeklyTip.stars, 5)) + '  ·  ' : ''}
                        {[weeklyTip.resort_town, weeklyTip.country].filter(Boolean).join(', ')}
                      </p>
                      <p
                        className="text-white font-bold leading-tight line-clamp-2 mb-2"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(15px, 2vw, 19px)' }}
                      >
                        {weeklyTip.name}
                      </p>
                      <p className="text-[12px] font-medium text-white/70">
                        od <span className="text-white font-bold">{fmtShort(weeklyTip.min_price ?? null)} Kč</span> / os.
                      </p>
                    </div>

                    {/* Expanding pill CTA */}
                    <div className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 group-hover:bg-white group-hover:border-white transition-all duration-200 overflow-hidden flex-shrink-0 px-2.5 py-2 group-hover:px-3.5" style={{ backdropFilter: 'blur(8px)' }}>
                      <span className="text-[12px] font-semibold text-white group-hover:text-[#0093FF] transition-colors duration-200 max-w-0 group-hover:max-w-[60px] overflow-hidden whitespace-nowrap">
                        Zobrazit
                      </span>
                      <PiArrowRight className="w-3.5 h-3.5 text-white group-hover:text-[#0093FF] transition-all duration-200 group-hover:translate-x-0.5 flex-shrink-0" />
                    </div>
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

        {/* ── Articles — homepage ── */}
        {noFilters && !singleDest && !tourType && articlesWithPhotos.length > 0 && (
          <div className="section-island">
            <ArticlesSection articles={articlesWithPhotos} imageMap={articleImageMap} />
          </div>
        )}

        {/* ── Articles — destination page ── */}
        {singleDest && articlesWithPhotos.length > 0 && (
          <div className="section-island">
            <ArticlesSection
              articles={articlesWithPhotos}
              imageMap={articleImageMap}
              label={`Články o ${singleDest}`}
            />
          </div>
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
