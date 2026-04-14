import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import {
  PiThermometer, PiSun, PiLeaf, PiWind, PiAirplane,
  PiCloudSun, PiCalendarBlank, PiMapPin, PiFlower, PiSnowflake,
} from 'react-icons/pi'
import Header from '@/components/Header'
import HotelGrid from '@/components/HotelGrid'
import WeatherWidget from '@/components/WeatherWidget'
import ClimateChart from '@/components/ClimateChart'
import WeatherBarsChart from '@/components/WeatherBarsChart'
import WeatherPageNav from '@/components/WeatherPageNav'
import { FeaturedHotelsBarVertical } from '@/components/FeaturedHotelCard'
import JsonLd from '@/components/JsonLd'
import { fetchDestinations, fetchDestinationPhoto, fetchWeatherAI, fetchWeatherLocation, fetchHotels } from '@/lib/api'
import { slugify } from '@/lib/slugify'

export const revalidate = 3600
export const dynamicParams = true

const MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const MONTH_SHORT = ['Led', 'Únr', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

const SEASONS = [
  { key: 'spring', label: 'Jaro',   months: 'březen – květen',   Icon: PiFlower,    iconColor: 'text-emerald-500', border: 'border-emerald-300', bg: 'bg-emerald-50' },
  { key: 'summer', label: 'Léto',   months: 'červen – srpen',    Icon: PiSun,       iconColor: 'text-amber-500',   border: 'border-amber-300',   bg: 'bg-amber-50'   },
  { key: 'autumn', label: 'Podzim', months: 'září – listopad',   Icon: PiLeaf,      iconColor: 'text-orange-500',  border: 'border-orange-300',  bg: 'bg-orange-50'  },
  { key: 'winter', label: 'Zima',   months: 'prosinec – únor',   Icon: PiSnowflake, iconColor: 'text-sky-500',     border: 'border-sky-300',     bg: 'bg-sky-50'     },
] as const

const SCROLL_MARGIN = { scrollMarginTop: '100px' }

export async function generateStaticParams() {
  try {
    const destinations = await fetchDestinations()
    const seen = new Set<string>()
    const params: { country: string; destination: string }[] = []
    for (const d of destinations) {
      if (!d.country || !d.destination) continue
      const region = d.destination.split('/')[1]?.trim() ?? d.destination.split('/')[0]?.trim()
      if (!region || /safari|bike|trek|plus|sport|aktivní/i.test(region)) continue
      const key = `${slugify(d.country)}_${slugify(region)}`
      if (!seen.has(key)) {
        seen.add(key)
        params.push({ country: slugify(d.country), destination: slugify(region) })
      }
    }
    return params
  } catch { return [] }
}

interface DestInfo { name: string; country: string; countrySlug: string; destSlug: string }

async function resolveDestination(countrySlug: string, destSlug: string): Promise<DestInfo | null> {
  const destinations = await fetchDestinations().catch(() => [])
  let countryName: string | null = null
  for (const d of destinations) {
    if (d.country && slugify(d.country) === countrySlug) { countryName = d.country; break }
  }
  if (!countryName) return null
  for (const d of destinations) {
    if (d.country !== countryName) continue
    const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
    if (region && slugify(region) === destSlug) {
      return { name: region, country: countryName, countrySlug, destSlug }
    }
  }
  return null
}

interface Props { params: { country: string; destination: string } }

function weatherTitle(name: string): string {
  const year = new Date().getFullYear()
  const idx = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5
  return [
    `${name} počasí – kdy jet na dovolenou + teplota moře`,
    `${name} počasí ${year} – teplota, moře, kdy jet + zájezdy`,
    `${name} počasí + levné zájezdy – kdy jet a kolik stojí`,
    `Jaké je počasí v ${name}? Teploty, moře a nejlepší období`,
    `${name} – počasí podle měsíců + tipy na dovolenou`,
  ][idx]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const info = await resolveDestination(params.country, params.destination)
  if (!info) return { title: 'Počasí | Zaleto' }
  const title = weatherTitle(info.name)
  const description = `Kdy je v ${info.name} nejhezčí počasí? Průměrné teploty vzduchu a moře po měsících, sluneční svit, srážky a klimatický průvodce pro výběr termínu dovolené.`
  const canonical = `https://zaleto.cz/pocasi/${params.country}/${params.destination}`
  return {
    title, description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
  }
}

export default async function DestinationWeatherPage({ params }: Props) {
  const info = await resolveDestination(params.country, params.destination)
  if (!info) notFound()

  const [weather, location, heroPhoto, featuredResult] = await Promise.all([
    fetchWeatherAI(info.name),
    fetchWeatherLocation(info.name),
    fetchDestinationPhoto(info.name).catch(() => null),
    fetchHotels({ destination: info.name, limit: 3, sort: 'stars_desc' }).catch(() => ({ hotels: [], pagination: { total: 0, page: 1, limit: 3, totalPages: 0, hasMore: false } })),
  ])
  const featuredHotels = featuredResult.hotels
  const hasCharts = weather.monthly_air && weather.monthly_air.length === 12
  const peakSea = weather.monthly_sea ? Math.max(...weather.monthly_sea) : null
  const bestMonthNames = weather.best_months.map(m => MONTH_SHORT[m - 1])
  const hasWeather = !!(location.lat && location.lon)
  const hasSlunce = !!(weather.monthly_sun_hours || weather.monthly_rain_days)
  const hasOdobi = SEASONS.some(s => weather[s.key as keyof typeof weather])
  const hasVitr = !!(weather.wind_info || weather.sea_info)

  const navItems = [
    hasWeather || weather.best_months.length > 0 ? { id: 'pocasi', label: 'Počasí' } : null,
    hasCharts ? { id: 'teploty', label: 'Teploty' } : null,
    hasSlunce ? { id: 'slunce', label: 'Slunce & déšť' } : null,
    hasOdobi ? { id: 'obdobi', label: 'Roční období' } : null,
    hasVitr ? { id: 'vitr', label: 'Vítr & moře' } : null,
    { id: 'zajezdy', label: 'Zájezdy' },
  ].filter(Boolean) as { id: string; label: string }[]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto',     item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Počasí',     item: 'https://zaleto.cz/pocasi' },
      { '@type': 'ListItem', position: 3, name: info.country, item: `https://zaleto.cz/pocasi/${params.country}` },
      { '@type': 'ListItem', position: 4, name: info.name,    item: `https://zaleto.cz/pocasi/${params.country}/${params.destination}` },
    ],
  }

  return (
    <div className="min-h-screen">
      <JsonLd data={breadcrumbSchema} />
      <Header />

      {/* ── Hero ── */}
      {heroPhoto ? (
        <div className="relative min-h-[300px] sm:min-h-[380px]">
          <Image src={heroPhoto} alt={info.name} fill className="object-cover" priority
            style={{ filter: 'brightness(1.05) saturate(1.05)' }} />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, rgba(245,250,255,1) 0%, rgba(245,250,255,0.88) 30%, rgba(245,250,255,0.55) 58%, rgba(245,250,255,0.0) 100%)'
          }} />
          <div className="absolute inset-x-0 bottom-0 h-32" style={{
            background: 'linear-gradient(to top, rgba(245,250,255,1) 0%, rgba(245,250,255,0.6) 50%, transparent 100%)'
          }} />
          <div className="relative flex items-center py-8 sm:py-10">
            <div className="max-w-[1680px] mx-auto px-4 sm:px-10 w-full pb-6">
              <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-3">
                <Link href="/" className="hover:text-[#008afe] transition-colors">Zaleto</Link>
                <span className="text-gray-200">/</span>
                <Link href="/pocasi" className="hover:text-[#008afe] transition-colors">Počasí</Link>
                <span className="text-gray-200">/</span>
                <Link href={`/pocasi/${params.country}`} className="hover:text-[#008afe] transition-colors">{info.country}</Link>
                <span className="text-gray-200">/</span>
                <span className="text-gray-700 font-medium">{info.name}</span>
              </nav>
              <h1
                className="font-bold text-gray-900 leading-tight tracking-tight mb-2 drop-shadow-sm"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 5vw, 60px)' }}
              >
                Počasí — {info.name}
              </h1>
              {weather.description && (
                <p className="text-gray-700 text-sm sm:text-base max-w-2xl leading-relaxed">
                  {weather.description.split(/\n\n+/)[0]}
                </p>
              )}
              {(peakSea || bestMonthNames.length > 0) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {peakSea && (
                    <span className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border border-sky-200 text-sky-700 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm">
                      🏊 Moře až {peakSea}°C
                    </span>
                  )}
                  {bestMonthNames.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 bg-white/80 backdrop-blur-sm border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm">
                      ☀️ Nejlepší: {bestMonthNames.slice(0, 4).join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-[1680px] mx-auto px-4 sm:px-10 py-8">
            <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-3">
              <Link href="/" className="hover:text-[#008afe] transition-colors">Zaleto</Link>
              <span className="text-gray-200">/</span>
              <Link href="/pocasi" className="hover:text-[#008afe] transition-colors">Počasí</Link>
              <span className="text-gray-200">/</span>
              <Link href={`/pocasi/${params.country}`} className="hover:text-[#008afe] transition-colors">{info.country}</Link>
              <span className="text-gray-200">/</span>
              <span className="text-gray-700 font-medium">{info.name}</span>
            </nav>
            <h1
              className="font-bold text-gray-900 leading-tight tracking-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(26px, 4vw, 48px)' }}
            >
              Počasí — {info.name}
            </h1>
            {weather.description && (
              <p className="text-gray-500 text-sm mt-2 max-w-2xl leading-relaxed">
                {weather.description.split(/\n\n+/)[0]}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Section nav (not sticky) ── */}
      <WeatherPageNav items={navItems} />

      <div className="max-w-[1680px] mx-auto px-4 sm:px-10 py-6 sm:py-8">
        <div className="flex gap-8 items-start">

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0 space-y-10">

        {/* ── Počasí + Nejlepší měsíce (merged wide block) ── */}
        {(hasWeather || weather.best_months.length > 0) && (
          <section id="pocasi" style={SCROLL_MARGIN}>
            <SectionHeader Icon={PiCloudSun} title="Počasí" />
            <div className="flex flex-col lg:flex-row gap-4 lg:items-stretch">
              {hasWeather && (
                <div className="lg:w-72 flex-shrink-0 flex flex-col [&>*]:flex-1 [&>*]:min-h-0">
                  <WeatherWidget lat={location.lat!} lon={location.lon!} location={info.name} />
                </div>
              )}
              {weather.best_months.length > 0 && (
                <div className="flex-1 glass-card rounded-2xl p-5 flex flex-col gap-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <PiCalendarBlank className="w-3.5 h-3.5" />
                    Nejlepší měsíce pro dovolenou
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTH_SHORT.map((m, i) => {
                      const isBest = weather.best_months.includes(i + 1)
                      return (
                        <span key={m} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                          isBest ? 'bg-[#008afe] text-white' : 'bg-gray-100 text-gray-400'
                        }`}>{m}</span>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400">
                    Ideální termíny: {weather.best_months.map(m => MONTH_NAMES[m - 1]).join(', ')}
                  </p>
                  {weather.description?.split(/\n\n+/)[1] && (
                    <p className="text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-4">
                      {weather.description.split(/\n\n+/)[1]}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Průměrné teploty ── */}
        {hasCharts && (
          <section id="teploty" style={SCROLL_MARGIN}>
            <SectionHeader Icon={PiThermometer} title={`Průměrné teploty — ${info.name}`} />
            <ClimateChart
              name={info.name}
              air={weather.monthly_air!}
              sea={weather.monthly_sea ?? undefined}
            />
          </section>
        )}

        {/* ── Slunce & srážky ── */}
        {hasSlunce && (
          <section id="slunce" style={SCROLL_MARGIN}>
            <SectionHeader Icon={PiSun} title="Slunce a srážky" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weather.monthly_sun_hours && (
                <WeatherBarsChart
                  title="Průměrný počet hodin slunce za den"
                  values={weather.monthly_sun_hours}
                  color="#fbbf24"
                  unit="hod / den"
                  highlightMonths={weather.best_months}
                />
              )}
              {weather.monthly_rain_days && (
                <WeatherBarsChart
                  title="Průměrný počet dešťových dní"
                  values={weather.monthly_rain_days}
                  color="#60a5fa"
                  unit="dní / měsíc"
                />
              )}
            </div>
          </section>
        )}

        {/* ── Roční období ── */}
        {hasOdobi && (
          <section id="obdobi" style={SCROLL_MARGIN}>
            <SectionHeader Icon={PiLeaf} title="Počasí podle ročního období" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {SEASONS.map(s => {
                const text = weather[s.key as keyof typeof weather] as string | null
                if (!text) return null
                return (
                  <div key={s.key} className={`rounded-2xl border-l-4 shadow-sm p-4 ${s.border} ${s.bg}`}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <s.Icon className={`w-5 h-5 flex-shrink-0 ${s.iconColor}`} />
                      <div>
                        <p className="font-bold text-sm text-gray-900 leading-none">{s.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{s.months}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{text}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Vítr & moře ── */}
        {hasVitr && (
          <section id="vitr" style={SCROLL_MARGIN}>
            <SectionHeader Icon={PiWind} title="Vítr a moře" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {weather.wind_info && (
                <div className="glass-card rounded-2xl p-5">
                  <p className="flex items-center gap-2 font-semibold text-sm text-gray-800 mb-2">
                    <PiWind className="w-4 h-4 text-[#008afe]" /> Vítr
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">{weather.wind_info}</p>
                </div>
              )}
              {weather.sea_info && (
                <div className="glass-card rounded-2xl p-5">
                  <p className="flex items-center gap-2 font-semibold text-sm text-gray-800 mb-2">
                    <PiMapPin className="w-4 h-4 text-[#008afe]" /> Koupání a teplota moře
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed">{weather.sea_info}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Zájezdy ── */}
        <section id="zajezdy" style={SCROLL_MARGIN}>
          <SectionHeader Icon={PiAirplane} title={`Zájezdy do ${info.name}`} />
          {/* Dashed connector */}
          <div className="flex items-center gap-2 mb-5">
            <div
              className="flex-1 h-px"
              style={{ backgroundImage: 'repeating-linear-gradient(to right, #e5e7eb 0, #e5e7eb 6px, transparent 6px, transparent 12px)' }}
            />
            <PiAirplane className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" style={{ transform: 'rotate(90deg)' }} />
            <div
              className="flex-1 h-px"
              style={{ backgroundImage: 'repeating-linear-gradient(to right, #e5e7eb 0, #e5e7eb 6px, transparent 6px, transparent 12px)' }}
            />
          </div>
          <Suspense>
            <HotelGrid forcedDestination={info.name} />
          </Suspense>
        </section>

          </main>

          {/* ── Right sidebar: hotel recommendations ── */}
          {featuredHotels.length > 0 && (
            <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-24">
              <FeaturedHotelsBarVertical hotels={featuredHotels} />
            </aside>
          )}

        </div>
      </div>
    </div>
  )
}

function SectionHeader({ Icon, title }: { Icon: React.ElementType; title: string }) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 mb-4">
      <Icon className="w-4 h-4 text-[#008afe] flex-shrink-0" />
      {title}
    </h2>
  )
}
