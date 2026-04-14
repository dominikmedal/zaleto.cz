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
import { FeaturedHotelsBarVertical } from '@/components/FeaturedHotelCard'
import WeatherPageNav from '@/components/WeatherPageNav'
import JsonLd from '@/components/JsonLd'
import { fetchDestinations, fetchDestinationPhoto, fetchWeatherAI, fetchWeatherLocation, fetchHotels } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { getCountryFlag } from '@/lib/countryFlags'

export const revalidate = 3600
export const dynamicParams = true

const MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const MONTH_SHORT = ['Led', 'Únr', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

const SEASONS = [
  { key: 'spring', label: 'Jaro',   months: 'březen – květen',   Icon: PiFlower,    accent: '#10b981' },
  { key: 'summer', label: 'Léto',   months: 'červen – srpen',    Icon: PiSun,       accent: '#f59e0b' },
  { key: 'autumn', label: 'Podzim', months: 'září – listopad',   Icon: PiLeaf,      accent: '#f97316' },
  { key: 'winter', label: 'Zima',   months: 'prosinec – únor',   Icon: PiSnowflake, accent: '#38bdf8' },
] as const

const SCROLL_MARGIN = { scrollMarginTop: '136px' }

export async function generateStaticParams() {
  try {
    const destinations = await fetchDestinations()
    const seen = new Set<string>()
    return destinations
      .filter(d => d.country)
      .map(d => ({ country: slugify(d.country!) }))
      .filter(p => seen.has(p.country) ? false : (seen.add(p.country), true))
  } catch { return [] }
}

interface CountryInfo {
  name: string
  slug: string
  subDestinations: { name: string; slug: string; hotelCount: number }[]
}

async function resolveCountry(countrySlug: string): Promise<CountryInfo | null> {
  const destinations = await fetchDestinations().catch(() => [])

  let countryName: string | null = null
  for (const d of destinations) {
    if (d.country && slugify(d.country) === countrySlug) {
      countryName = d.country
      break
    }
  }
  if (!countryName) return null

  const regionMap = new Map<string, number>()
  for (const d of destinations) {
    if (d.country !== countryName) continue
    const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
    if (region && region !== countryName && !/safari|bike|trek|plus|sport|aktivní/i.test(region)) {
      regionMap.set(region, (regionMap.get(region) ?? 0) + (d.hotel_count ?? 0))
    }
  }

  const subDestinations = [...regionMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, slug: slugify(name), hotelCount: count }))

  return { name: countryName, slug: countrySlug, subDestinations }
}

interface Props { params: { country: string } }

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
  const info = await resolveCountry(params.country)
  if (!info) return { title: 'Počasí | Zaleto' }
  const title = weatherTitle(info.name)
  const description = `Průměrné teploty vzduchu a moře, sluneční svit a srážky v ${info.name} po měsících. Zjistěte, kdy je nejlepší dovolená a kdy se můžete koupat.`
  const canonical = `https://zaleto.cz/pocasi/${params.country}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
  }
}

export default async function CountryWeatherPage({ params }: Props) {
  const info = await resolveCountry(params.country)
  if (!info) notFound()

  const [weather, location, heroPhoto, featuredResult] = await Promise.all([
    fetchWeatherAI(info.name),
    fetchWeatherLocation(info.name),
    fetchDestinationPhoto(info.name).catch(() => null),
    fetchHotels({ destination: info.name, limit: 3, sort: 'stars_desc' }).catch(() => ({ hotels: [], pagination: { total: 0, page: 1, limit: 3, totalPages: 0, hasMore: false } })),
  ])
  const featuredHotels = featuredResult.hotels

  const flag = getCountryFlag(info.name)
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
    info.subDestinations.length > 0 ? { id: 'oblasti', label: 'Oblasti' } : null,
    { id: 'zajezdy', label: 'Zájezdy' },
  ].filter(Boolean) as { id: string; label: string }[]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Počasí', item: 'https://zaleto.cz/pocasi' },
      { '@type': 'ListItem', position: 3, name: info.name, item: `https://zaleto.cz/pocasi/${params.country}` },
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
                <span className="text-gray-700 font-medium">{info.name}</span>
              </nav>
              <h1
                className="font-bold text-gray-900 leading-tight tracking-tight mb-2 drop-shadow-sm flex items-center gap-3 flex-wrap"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(28px, 5vw, 60px)' }}
              >
                {flag && <span className="flex-shrink-0">{flag}</span>}
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
                    <span className="inline-flex items-center gap-1.5 text-sky-700 text-xs font-medium px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(125,211,252,0.50)', boxShadow: '0 2px 8px rgba(14,165,233,0.12)' }}>
                      🏊 Moře až {peakSea}°C
                    </span>
                  )}
                  {bestMonthNames.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(251,191,36,0.40)', boxShadow: '0 2px 8px rgba(245,158,11,0.12)' }}>
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
              <span className="text-gray-700 font-medium">{info.name}</span>
            </nav>
            <h1
              className="font-bold text-gray-900 leading-tight tracking-tight flex items-center gap-3 flex-wrap"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(26px, 4vw, 48px)' }}
            >
              {flag && <span className="flex-shrink-0">{flag}</span>}
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
                    <p className="flex items-center gap-2 font-semibold text-sm text-gray-800 mb-2">
                        <PiWind className="w-4 h-4 text-[#008afe]" /> Nejlepší měsíce pro dovolenou
                    </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTH_SHORT.map((m, i) => {
                      const isBest = weather.best_months.includes(i + 1)
                      return (
                        <span key={m}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold"
                          style={isBest ? {
                            background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
                            color: '#fff',
                            boxShadow: '0 2px 8px rgba(0,147,255,0.28)',
                          } : {
                            background: 'rgba(237,246,255,0.70)',
                            color: '#9ca3af',
                            border: '1px solid rgba(200,227,255,0.65)',
                          }}
                        >{m}</span>
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
                  <div key={s.key} className="glass-card rounded-2xl p-4" style={{ borderLeft: `3px solid ${s.accent}` }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${s.accent}18` }}>
                        <s.Icon className="w-4 h-4" style={{ color: s.accent }} />
                      </div>
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

        {/* ── Oblasti a letoviště ── */}
        {info.subDestinations.length > 0 && (
          <section id="oblasti" style={SCROLL_MARGIN}>
            <SectionHeader Icon={PiMapPin} title="Oblasti a letoviště" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {info.subDestinations.map((dest) => (
                <Link
                  key={dest.slug}
                  href={`/pocasi/${params.country}/${dest.slug}`}
                  className="group glass-card rounded-2xl hover:shadow-[0_8px_32px_rgba(0,147,255,0.16)] transition-all duration-300 p-4 flex flex-col gap-1"
                >
                  <span className="font-semibold text-sm text-gray-800 group-hover:text-[#008afe] transition-colors leading-snug">
                    {dest.name}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {dest.hotelCount} {dest.hotelCount === 1 ? 'hotel' : dest.hotelCount < 5 ? 'hotely' : 'hotelů'}
                  </span>
                  <span className="text-[#008afe] text-xs mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    Počasí →
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Zájezdy ── */}
        <section id="zajezdy" style={SCROLL_MARGIN}>
          <SectionHeader Icon={PiAirplane} title={`Zájezdy do ${info.name}`} />
          {/* Dashed connector */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex-1 h-px" style={{ backgroundImage: 'repeating-linear-gradient(to right, #e5e7eb 0, #e5e7eb 6px, transparent 6px, transparent 12px)' }} />
            <PiAirplane className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" style={{ transform: 'rotate(90deg)' }} />
            <div className="flex-1 h-px" style={{ backgroundImage: 'repeating-linear-gradient(to right, #e5e7eb 0, #e5e7eb 6px, transparent 6px, transparent 12px)' }} />
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
    <div className="flex items-center gap-2.5 mb-5">
      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(0,147,255,0.08)' }}>
        <Icon className="w-3.5 h-3.5 text-[#0093FF]" />
      </div>
      <h2 className="text-base font-bold text-gray-900 tracking-tight">{title}</h2>
    </div>
  )
}
