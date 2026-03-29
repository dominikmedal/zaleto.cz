import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import HotelGrid from '@/components/HotelGrid'
import WeatherWidget from '@/components/WeatherWidget'
import ClimateChart from '@/components/ClimateChart'
import WeatherBarsChart from '@/components/WeatherBarsChart'
import JsonLd from '@/components/JsonLd'
import { fetchDestinations, fetchDestinationPhoto, fetchWeatherAI, fetchWeatherLocation } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { getCountryFlag } from '@/lib/countryFlags'

export const revalidate = 3600
export const dynamicParams = true

const MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const MONTH_SHORT = ['Led', 'Únr', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

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

  // Collect sub-destinations (regions) for this country
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const info = await resolveCountry(params.country)
  if (!info) return { title: 'Počasí | Zaleto' }
  const title = `Počasí ${info.name} — teploty, klima, nejlepší doba | Zaleto`
  const description = `Aktuální počasí a klimatické grafy pro ${info.name}. Průměrné teploty vzduchu a moře, počet slunečních hodin a nejlepší měsíce pro dovolenou.`
  const canonical = `https://zaleto.cz/pocasi/${params.country}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
  }
}

function BestMonthsStrip({ best }: { best: number[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MONTH_SHORT.map((m, i) => {
        const isBest = best.includes(i + 1)
        return (
          <span key={m} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            isBest
              ? 'bg-[#008afe] text-white'
              : 'bg-gray-100 text-gray-400'
          }`}>
            {m}
          </span>
        )
      })}
    </div>
  )
}

function SeasonCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-semibold text-sm text-gray-800">{title}</span>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
    </div>
  )
}

export default async function CountryWeatherPage({ params }: Props) {
  const info = await resolveCountry(params.country)
  if (!info) notFound()

  const [weather, location, heroPhoto] = await Promise.all([
    fetchWeatherAI(info.name),
    fetchWeatherLocation(info.name),
    fetchDestinationPhoto(info.name).catch(() => null),
  ])

  const flag = getCountryFlag(info.name)
  const hasCharts = weather.monthly_air && weather.monthly_air.length === 12

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

      {/* Hero */}
      {heroPhoto && (
        <div className="relative min-h-[260px] sm:min-h-[340px]">
          <Image src={heroPhoto} alt={info.name} fill className="object-cover" unoptimized priority
            style={{ filter: 'brightness(1.05) saturate(1.05)' }} />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, rgba(245,250,255,1) 0%, rgba(245,250,255,0.88) 32%, rgba(245,250,255,0.5) 60%, rgba(245,250,255,0) 100%)'
          }} />
          <div className="absolute inset-x-0 bottom-0 h-28" style={{
            background: 'linear-gradient(to top, rgba(245,250,255,1) 0%, rgba(245,250,255,0.6) 50%, transparent 100%)'
          }} />
          <div className="relative py-8 sm:py-12">
            <div className="max-w-[1680px] mx-auto px-4 sm:px-10 pb-4">
              <HeroBreadcrumb countrySlug={params.country} countryName={info.name} />
              <HeroTitle name={info.name} flag={flag} />
              {weather.description && (
                <p className="text-gray-700 text-sm sm:text-base max-w-xl leading-relaxed mt-2">
                  {weather.description.split(/\n\n+/)[0]}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1680px] mx-auto px-4 sm:px-10 py-6 sm:py-8 space-y-8">

        {/* Compact hero when no photo */}
        {!heroPhoto && (
          <div>
            <HeroBreadcrumb countrySlug={params.country} countryName={info.name} />
            <HeroTitle name={info.name} flag={flag} />
            {weather.description && (
              <p className="text-gray-500 text-sm mt-2 max-w-2xl leading-relaxed">
                {weather.description.split(/\n\n+/)[0]}
              </p>
            )}
          </div>
        )}

        {/* Weather + Best months */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Current weather widget */}
          {location.lat && location.lon && (
            <div className="lg:col-span-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Aktuální počasí</h2>
              <WeatherWidget lat={location.lat} lon={location.lon} location={info.name} />
            </div>
          )}

          {/* Best months */}
          {weather.best_months.length > 0 && (
            <div className={location.lat ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Nejlepší měsíce pro dovolenou</h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <BestMonthsStrip best={weather.best_months} />
                {weather.best_months.length > 0 && (
                  <p className="text-xs text-gray-400 mt-3">
                    Ideální: {weather.best_months.map(m => MONTH_NAMES[m - 1]).join(', ')}
                  </p>
                )}
                {weather.description && (
                  <p className="text-sm text-gray-600 leading-relaxed mt-3 border-t border-gray-50 pt-3">
                    {weather.description.split(/\n\n+/)[1] ?? ''}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Climate charts */}
        {hasCharts && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Průměrné teploty</h2>
            <ClimateChart
              name={`${info.name} — teploty vzduchu${weather.monthly_sea ? ' a moře' : ''}`}
              air={weather.monthly_air!}
              sea={weather.monthly_sea ?? undefined}
            />
          </div>
        )}

        {/* Sun + Rain charts */}
        {(weather.monthly_sun_hours || weather.monthly_rain_days) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {weather.monthly_sun_hours && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Sluneční svit</h2>
                <WeatherBarsChart
                  title="Průměrný denní počet hodin slunce"
                  values={weather.monthly_sun_hours}
                  color="#fbbf24"
                  unit="hodin/den"
                  highlightMonths={weather.best_months}
                />
              </div>
            )}
            {weather.monthly_rain_days && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Srážky</h2>
                <WeatherBarsChart
                  title="Průměrný počet dešťových dní v měsíci"
                  values={weather.monthly_rain_days}
                  color="#60a5fa"
                  unit="dní/měsíc"
                />
              </div>
            )}
          </div>
        )}

        {/* Seasonal cards */}
        {(weather.spring || weather.summer || weather.autumn || weather.winter) && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Počasí podle ročního období</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {weather.spring  && <SeasonCard icon="🌸" title="Jaro (březen–květen)"      text={weather.spring} />}
              {weather.summer  && <SeasonCard icon="☀️" title="Léto (červen–srpen)"       text={weather.summer} />}
              {weather.autumn  && <SeasonCard icon="🍂" title="Podzim (září–listopad)"     text={weather.autumn} />}
              {weather.winter  && <SeasonCard icon="❄️" title="Zima (prosinec–únor)"       text={weather.winter} />}
            </div>
          </div>
        )}

        {/* Wind + Sea info */}
        {(weather.wind_info || weather.sea_info) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {weather.wind_info && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">💨</span>
                  <span className="font-semibold text-sm text-gray-800">Vítr</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{weather.wind_info}</p>
              </div>
            )}
            {weather.sea_info && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🏊</span>
                  <span className="font-semibold text-sm text-gray-800">Teplota moře</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{weather.sea_info}</p>
              </div>
            )}
          </div>
        )}

        {/* Sub-destinations grid */}
        {info.subDestinations.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Počasí v oblastech a letoviscích</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {info.subDestinations.map((dest) => (
                <Link
                  key={dest.slug}
                  href={`/pocasi/${params.country}/${dest.slug}`}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#008afe]/30 transition-all p-4 flex flex-col gap-1"
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
          </div>
        )}

        {/* Tour banners */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            Zájezdy do {info.name}
          </h2>
          <p className="text-sm text-gray-400 mb-5">Nejlepší nabídky na tuto sezónu</p>
          <Suspense>
            <HotelGrid forcedDestination={info.name} />
          </Suspense>
        </div>

      </main>
    </div>
  )
}

function HeroBreadcrumb({ countrySlug, countryName }: { countrySlug: string; countryName: string }) {
  return (
    <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-3">
      <Link href="/" className="hover:text-[#008afe] transition-colors">Zaleto</Link>
      <span className="text-gray-200">/</span>
      <Link href="/pocasi" className="hover:text-[#008afe] transition-colors">Počasí</Link>
      <span className="text-gray-200">/</span>
      <span className="text-gray-700 font-medium">{countryName}</span>
    </nav>
  )
}

function HeroTitle({ name, flag }: { name: string; flag: string | null }) {
  return (
    <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-tight flex items-center gap-3 flex-wrap">
      {flag && (
        <span className="inline-flex items-center justify-center rounded-lg overflow-hidden leading-none flex-shrink-0 shadow-sm"
          style={{ fontSize: '0.75em', lineHeight: 1, padding: '0.05em 0.1em' }}>
          {flag}
        </span>
      )}
      Počasí — {name}
    </h1>
  )
}
