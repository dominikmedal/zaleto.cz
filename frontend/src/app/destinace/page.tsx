import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import { fetchDestinations, fetchDestinationPhoto } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { getCountryFlag } from '@/lib/countryFlags'
import { PiAirplane, PiMapPin, PiBuildings, PiArrowRight } from 'react-icons/pi'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Všechny destinace — Přehled zájezdů | Zaleto.cz',
  description: 'Prohlédněte si všechny dostupné destinace zájezdů. Vyberte zemi, oblast nebo středisko a najděte nejlepší nabídky od předních českých cestovních kanceláří.',
  alternates: { canonical: 'https://zaleto.cz/destinace' },
  openGraph: {
    title: 'Destinace zájezdů — Zaleto.cz',
    description: 'Přehled všech destinací od CK Fischer, Exim, TUI, Čedok a dalších.',
    url: 'https://zaleto.cz/destinace',
    type: 'website',
  },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
    { '@type': 'ListItem', position: 2, name: 'Destinace', item: 'https://zaleto.cz/destinace' },
  ],
}

interface DestRow { country: string; destination: string; resort_town: string | null; hotel_count: number }
interface RegionEntry { label: string; count: number }
interface CountryEntry {
  name: string
  flag: string
  totalCount: number
  regions: RegionEntry[]
  photo: string | null
}

function parseRegion(dest: string): string {
  const parts = dest.split('/').map(s => s.trim())
  return parts.length >= 2 ? parts[1] : parts[0]
}

function buildCountries(rows: DestRow[]): CountryEntry[] {
  const cm = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!cm.has(r.country)) cm.set(r.country, new Map())
    const region = parseRegion(r.destination)
    const dm = cm.get(r.country)!
    dm.set(region, (dm.get(region) ?? 0) + r.hotel_count)
  }
  return Array.from(cm.entries())
    .map(([name, dm]) => {
      const regions: RegionEntry[] = Array.from(dm.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
      const totalCount = regions.reduce((s, r) => s + r.count, 0)
      return { name, flag: getCountryFlag(name) ?? '🌍', totalCount, regions, photo: null }
    })
    .sort((a, b) => b.totalCount - a.totalCount)
}

export default async function DestinacePage() {
  const rows = await fetchDestinations().catch(() => [] as DestRow[])
  const countries = buildCountries(rows)

  // Fetch photos for top 16 countries in parallel
  const topN = countries.slice(0, 16)
  const photos = await Promise.all(
    topN.map(c => fetchDestinationPhoto(c.name).catch(() => null))
  )
  topN.forEach((c, i) => { c.photo = photos[i] })

  const totalHotels = countries.reduce((s, c) => s + c.totalCount, 0)

  return (
    <div className="min-h-screen">
      <JsonLd data={breadcrumbSchema} />
      <Header />

      <main className="max-w-[1680px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
              <Link href="/" className="hover:text-[#008afe] transition-colors">Zaleto</Link>
              <span className="text-gray-200">/</span>
              <span className="text-gray-600 font-medium">Destinace</span>
            </nav>

            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{ background: 'rgba(0,147,255,0.07)', border: '1px solid rgba(0,147,255,0.12)' }}>
              <PiAirplane className="w-3.5 h-3.5 text-[#0093FF]" />
              <span className="text-[11px] font-semibold text-[#0093FF] tracking-[0.05em]">Rozcestník destinací</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-2">
              Všechny <span className="text-[#0093FF]">destinace</span>
            </h1>
            <p className="text-gray-500 text-base leading-relaxed max-w-xl">
              Vyberte zemi nebo oblast a porovnejte zájezdy od předních českých cestovních kanceláří.
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-center px-4 py-3 rounded-xl" style={{ background: 'rgba(0,147,255,0.06)', border: '1px solid rgba(0,147,255,0.10)' }}>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{countries.length}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mt-0.5">zemí</p>
            </div>
            <div className="text-center px-4 py-3 rounded-xl" style={{ background: 'rgba(0,147,255,0.06)', border: '1px solid rgba(0,147,255,0.10)' }}>
              <p className="text-lg font-bold text-gray-900 tabular-nums">{totalHotels}</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mt-0.5">hotelů</p>
            </div>
          </div>
        </div>

        {/* ── Featured countries — large photo cards (top 8) ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1 h-4 rounded-full bg-[#0093FF]" />
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Nejoblíbenější destinace</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {topN.slice(0, 8).map(country => (
              <Link
                key={country.name}
                href={`/destinace/${slugify(country.name)}`}
                className="group relative rounded-2xl overflow-hidden bg-gray-100 block"
                style={{ aspectRatio: '4/3' }}
              >
                {country.photo ? (
                  <Image
                    src={country.photo}
                    alt={country.name}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF] to-blue-700" />
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3.5">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-lg leading-none mb-1">{country.flag}</p>
                      <p className="text-white font-bold text-[15px] leading-tight truncate">{country.name}</p>
                      <p className="text-white/55 text-[11px] mt-0.5">{country.totalCount} hotelů</p>
                    </div>
                    <span className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border border-white/30 bg-white/10 group-hover:bg-white group-hover:border-white transition-all duration-200">
                      <PiArrowRight className="w-3.5 h-3.5 text-white group-hover:text-[#0093FF] transition-colors" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── All countries — compact list ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1 h-4 rounded-full bg-gray-300" />
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Všechny země</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {countries.map(country => (
              <div
                key={country.name}
                className="rounded-2xl overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.06)', background: 'rgba(250,252,255,0.8)' }}
              >
                {/* Country header row */}
                <Link
                  href={`/destinace/${slugify(country.name)}`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(0,147,255,0.04)] transition-colors"
                >
                  <span className="text-2xl leading-none flex-shrink-0">{country.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-800 truncate">{country.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{country.totalCount} hotelů</p>
                  </div>
                  <PiArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 group-hover:text-[#0093FF]" />
                </Link>

                {/* Regions as pills */}
                {country.regions.length > 0 && (
                  <div className="px-4 pb-3.5 flex flex-wrap gap-1.5">
                    {country.regions.slice(0, 8).map(region => (
                      <Link
                        key={region.label}
                        href={`/destinace/${slugify(region.label)}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-[#0093FF] hover:bg-[rgba(0,147,255,0.07)] bg-gray-100 px-2 py-0.5 rounded-full transition-all"
                      >
                        <PiMapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        {region.label}
                        <span className="text-gray-300 text-[9px] ml-0.5">{region.count}</span>
                      </Link>
                    ))}
                    {country.regions.length > 8 && (
                      <Link
                        href={`/destinace/${slugify(country.name)}`}
                        className="inline-flex items-center text-[11px] font-medium text-[#0093FF] hover:underline px-2 py-0.5"
                      >
                        +{country.regions.length - 8} dalších
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="rounded-2xl p-6 sm:p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(0,147,255,0.08) 0%, rgba(0,112,224,0.04) 100%)', border: '1px solid rgba(0,147,255,0.12)' }}>
          <PiBuildings className="w-8 h-8 text-[#0093FF]/40 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Nevíte, kam jet?</h2>
          <p className="text-gray-500 text-sm mb-4 max-w-md mx-auto">
            Prohlédněte si všechny zájezdy, filtrujte podle termínu, stravování a ceny a najděte tu pravou dovolenou.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-[#0093FF]/25 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #0093FF, #0070E0)' }}
          >
            Prohlédnout všechny zájezdy <PiArrowRight className="w-4 h-4" />
          </Link>
        </section>

      </main>
    </div>
  )
}
