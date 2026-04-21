import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import HotelGrid from '@/components/HotelGrid'
import JsonLd from '@/components/JsonLd'
import FilteringBar from '@/components/FilteringBar'
import DestinationHeroAI from '@/components/DestinationHeroAI'
import { fetchDestinations, fetchWikiSummary, fetchDestinationPhoto, fetchDestinationAI } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { getCountryFlag } from '@/lib/countryFlags'

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const destinations = await fetchDestinations()
    const seen = new Set<string>()
    const params: { slug: string }[] = []

    for (const d of destinations) {
      if (d.country) {
        const s = slugify(d.country)
        if (!seen.has(s)) { seen.add(s); params.push({ slug: s }) }
      }
      const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
      if (region) {
        const s = slugify(region)
        if (!seen.has(s)) { seen.add(s); params.push({ slug: s }) }
      }
      if (d.resort_town) {
        const s = slugify(d.resort_town)
        if (!seen.has(s)) { seen.add(s); params.push({ slug: s }) }
      }
    }

    return params
  } catch {
    return []
  }
}

interface DestInfo {
  name: string
  country: string | null
  type: 'country' | 'region' | 'town'
  breadcrumb: { label: string; href: string }[]
}

async function resolveDestination(slug: string): Promise<DestInfo | null> {
  let destinations
  try {
    destinations = await fetchDestinations()
  } catch {
    return null
  }

  // Country
  for (const d of destinations) {
    if (d.country && slugify(d.country) === slug) {
      return {
        name: d.country,
        country: d.country,
        type: 'country',
        breadcrumb: [{ label: d.country, href: `/destinace/${slugify(d.country)}` }],
      }
    }
  }
  // Region
  for (const d of destinations) {
    const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
    if (region && slugify(region) === slug) {
      const crumbs: { label: string; href: string }[] = []
      if (d.country) crumbs.push({ label: d.country, href: `/destinace/${slugify(d.country)}` })
      crumbs.push({ label: region, href: `/destinace/${slugify(region)}` })
      return { name: region, country: d.country, type: 'region', breadcrumb: crumbs }
    }
  }
  // Town
  for (const d of destinations) {
    if (d.resort_town && slugify(d.resort_town) === slug) {
      const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
      const crumbs: { label: string; href: string }[] = []
      if (d.country) crumbs.push({ label: d.country, href: `/destinace/${slugify(d.country)}` })
      if (region && region !== d.resort_town) crumbs.push({ label: region, href: `/destinace/${slugify(region)}` })
      crumbs.push({ label: d.resort_town, href: `/destinace/${slugify(d.resort_town)}` })
      return { name: d.resort_town, country: d.country, type: 'town', breadcrumb: crumbs }
    }
  }
  return null
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
    : `Porovnejte zájezdy do destinace ${name} od předních českých cestovních kanceláří.`

  const canonical = `https://zaleto.cz/destinace/${params.slug}`
  const title = `Zájezdy ${name} ${year} — Srovnej ceny CK | Zaleto`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Zájezdy ${name} ${year} | Zaleto`,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Zaleto',
      locale: 'cs_CZ',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function DestinacePage({ params }: Props) {
  const dest = await resolveDestination(params.slug)
  if (!dest) notFound()

  const [destAI, heroPhoto, allDestinations] = await Promise.all([
    fetchDestinationAI(dest.name).catch(() => null),
    fetchDestinationPhoto(dest.name).catch(() => null),
    fetchDestinations().catch(() => [] as Awaited<ReturnType<typeof fetchDestinations>>),
  ])

  // Collect unique resort towns for this destination (exclude the destination name itself)
  const resortTowns = Array.from(new Set(
    allDestinations
      .filter(d => {
        const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
        return (
          d.country === dest.country ||
          region === dest.name ||
          d.country === dest.name
        )
      })
      .map(d => d.resort_town)
      .filter((t): t is string => Boolean(t) && t !== dest.name)
  )).sort()

  // Use AI description if available, otherwise fall back to Wikipedia
  const aiHeroText = destAI?.description && destAI.description.length >= 20
    ? destAI.description.split(/\n\n+/)[0]
    : null

  const wiki = aiHeroText ? null : await fetchWikiSummary(dest.name).catch(() => null)
  const heroDescription = aiHeroText
    ?? (wiki ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ') : '')

  const hasHeroAI = destAI && (
    destAI.best_time || (destAI.places ?? []).length || (destAI.food ?? []).length ||
    (destAI.trips ?? []).length || (destAI.excursions ?? []).length
  )

  const countryFlag = dest.type === 'country' ? getCountryFlag(dest.name) : null
  const heroTitle = wiki ? wiki.title : dest.name

  // Weather page link for this destination
  const weatherUrl = dest.type === 'country'
    ? `/pocasi/${slugify(dest.name)}`
    : dest.country
      ? `/pocasi/${slugify(dest.country)}/${slugify(dest.name)}`
      : null

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...dest.breadcrumb.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: crumb.label,
        item: `https://zaleto.cz${crumb.href}`,
      })),
    ],
  }

  return (
    <div className="min-h-screen">
      <JsonLd data={breadcrumbSchema} />
      <Header />

      {/* ── Full-bleed hero (photo available) ── */}
      {heroPhoto && (
        <div className="relative min-h-[300px] sm:min-h-[380px]">
          <Image
            src={heroPhoto}
            alt={dest.name}
            fill
            className="object-cover"
            style={{ filter: 'brightness(1.05) saturate(1.05)' }}
           
            priority
          />
          {/* Left gradient */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, rgba(245,250,255,1) 0%, rgba(245,250,255,0.88) 30%, rgba(245,250,255,0.55) 58%, rgba(245,250,255,0.0) 100%)'
          }} />
          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-32" style={{
            background: 'linear-gradient(to top, rgba(245,250,255,1) 0%, rgba(245,250,255,0.6) 50%, transparent 100%)'
          }} />
          <div className="relative flex items-center py-8 sm:py-10">
            <div className="max-w-[1680px] mx-auto px-4 sm:px-10 w-full pb-6">
              <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-3">
                <Link href="/" className="hover:text-[#008afe] transition-colors">Všechny zájezdy</Link>
                {dest.breadcrumb.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="text-gray-200">/</span>
                    {i === dest.breadcrumb.length - 1
                      ? <span className="text-gray-700 font-medium">{crumb.label}</span>
                      : <Link href={crumb.href} className="hover:text-[#008afe] transition-colors">{crumb.label}</Link>
                    }
                  </span>
                ))}
              </nav>
              <h1
                className="font-bold text-gray-900 leading-tight tracking-tight mb-2 drop-shadow-sm flex items-center gap-3 flex-wrap"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 5vw, 60px)' }}
              >
                {countryFlag && (
                  <span className="inline-flex items-center justify-center rounded-lg overflow-hidden leading-none flex-shrink-0 shadow-sm" style={{ fontSize: '0.75em', lineHeight: 1, padding: '0.05em 0.1em' }}>
                    {countryFlag}
                  </span>
                )}
                {heroTitle}
              </h1>
              {heroDescription && (
                <p className="text-gray-700 text-sm sm:text-base max-w-2xl leading-relaxed">
                  {heroDescription}
                </p>
              )}
              {weatherUrl && (
                <Link href={weatherUrl} className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-white/80 backdrop-blur-sm border border-sky-200 text-sky-600 hover:bg-sky-50 hover:border-sky-400 rounded-full text-xs font-semibold transition-all shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5"/></svg>
                  Počasí a klima — {dest.name}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1680px] mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-5">

        {/* ── Compact hero (no photo) ── */}
        {!heroPhoto && (
          <div>
            <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-3">
              <Link href="/" className="hover:text-[#008afe] transition-colors">Všechny zájezdy</Link>
              {dest.breadcrumb.map((crumb, i) => (
                <span key={crumb.label} className="flex items-center gap-1">
                  <span className="text-gray-200">/</span>
                  {i === dest.breadcrumb.length - 1
                    ? <span className="text-gray-700 font-medium">{crumb.label}</span>
                    : <Link href={crumb.href} className="hover:text-[#008afe] transition-colors">{crumb.label}</Link>
                  }
                </span>
              ))}
            </nav>
            <h1
              className="font-bold text-gray-900 leading-tight tracking-tight mb-2 flex items-center gap-3 flex-wrap"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(26px, 4vw, 48px)' }}
            >
              {countryFlag && (
                <span className="inline-flex items-center justify-center rounded-lg overflow-hidden leading-none flex-shrink-0 shadow-sm" style={{ fontSize: '0.75em', lineHeight: 1, padding: '0.05em 0.1em' }}>
                  {countryFlag}
                </span>
              )}
              {heroTitle}
            </h1>
            {heroDescription && (
              <p className="text-gray-500 text-sm sm:text-base leading-relaxed max-w-3xl">
                {heroDescription}
              </p>
            )}
            {weatherUrl && (
              <Link href={weatherUrl} className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-sky-50 border border-sky-200 text-sky-600 hover:bg-sky-100 hover:border-sky-400 rounded-full text-xs font-semibold transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="9" r="2.5"/></svg>
                Počasí a klima — {dest.name}
              </Link>
            )}
          </div>
        )}

        {/* ── AI info cards (side by side, below hero) ── */}
        {hasHeroAI && destAI && (
          <DestinationHeroAI data={destAI} destName={dest.name} country={dest.country ?? ''} />
        )}

        {/* ── Filter animation bar ── */}
        <Suspense>
          <FilteringBar />
        </Suspense>

        {/* ── Hotel grid ── */}
        <Suspense>
          <HotelGrid forcedDestination={dest.name} />
        </Suspense>

      </main>
    </div>
  )
}
