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

export const revalidate = 3600
export const dynamicParams = true

const MONTH_NAMES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const MONTH_SHORT = ['Led', 'Únr', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

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

interface DestInfo {
  name: string
  country: string
  countrySlug: string
  destSlug: string
}

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const info = await resolveDestination(params.country, params.destination)
  if (!info) return { title: 'Počasí | Zaleto' }
  const title = `Počasí ${info.name} — klima, teploty, nejlepší doba | Zaleto`
  const description = `Průměrné teploty vzduchu a moře, sluneční svit, srážky a nejlepší měsíce pro dovolenou v ${info.name}. Aktuální předpověď počasí.`
  const canonical = `https://zaleto.cz/pocasi/${params.country}/${params.destination}`
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
            isBest ? 'bg-[#008afe] text-white' : 'bg-gray-100 text-gray-400'
          }`}>{m}</span>
        )
      })}
    </div>
  )
}

function InfoCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="font-semibold text-sm text-gray-800">{title}</span>
      </div>
      <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
    </div>
  )
}

export default async function DestinationWeatherPage({ params }: Props) {
  const info = await resolveDestination(params.country, params.destination)
  if (!info) notFound()

  const [weather, location, heroPhoto] = await Promise.all([
    fetchWeatherAI(info.name),
    fetchWeatherLocation(info.name),
    fetchDestinationPhoto(info.name).catch(() => null),
  ])

  const hasCharts = weather.monthly_air && weather.monthly_air.length === 12

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto',       item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Počasí',       item: 'https://zaleto.cz/pocasi' },
      { '@type': 'ListItem', position: 3, name: info.country,   item: `https://zaleto.cz/pocasi/${params.country}` },
      { '@type': 'ListItem', position: 4, name: info.name,      item: `https://zaleto.cz/pocasi/${params.country}/${params.destination}` },
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
              <Breadcrumb info={info} params={params} />
              <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-tight mt-1">
                Počasí — {info.name}
              </h1>
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

        {!heroPhoto && (
          <div>
            <Breadcrumb info={info} params={params} />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-1">Počasí — {info.name}</h1>
            {weather.description && (
              <p className="text-gray-500 text-sm mt-2 max-w-2xl leading-relaxed">
                {weather.description.split(/\n\n+/)[0]}
              </p>
            )}
          </div>
        )}

        {/* Weather widget + best months */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {location.lat && location.lon && (
            <div className="lg:col-span-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Aktuální počasí</h2>
              <WeatherWidget lat={location.lat} lon={location.lon} location={info.name} />
            </div>
          )}

          {weather.best_months.length > 0 && (
            <div className={location.lat ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Nejlepší měsíce pro dovolenou</h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full">
                <BestMonthsStrip best={weather.best_months} />
                <p className="text-xs text-gray-400 mt-3">
                  Ideální: {weather.best_months.map(m => MONTH_NAMES[m - 1]).join(', ')}
                </p>
                {weather.description?.split(/\n\n+/)[1] && (
                  <p className="text-sm text-gray-600 leading-relaxed mt-3 pt-3 border-t border-gray-50">
                    {weather.description.split(/\n\n+/)[1]}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Temperature chart */}
        {hasCharts && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Průměrné teploty</h2>
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

        {/* Sea temp if available */}
        {hasCharts && weather.monthly_sea && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Teplota moře</h2>
            <WeatherBarsChart
              title={`${info.name} — průměrná teplota moře`}
              values={weather.monthly_sea}
              color="#4db6e8"
              unit="°C"
              highlightMonths={weather.best_months}
            />
          </div>
        )}

        {/* Seasonal overview */}
        {(weather.spring || weather.summer || weather.autumn || weather.winter) && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Počasí podle ročního období</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {weather.spring && <InfoCard icon="🌸" title="Jaro (březen–květen)">{weather.spring}</InfoCard>}
              {weather.summer && <InfoCard icon="☀️" title="Léto (červen–srpen)">{weather.summer}</InfoCard>}
              {weather.autumn && <InfoCard icon="🍂" title="Podzim (září–listopad)">{weather.autumn}</InfoCard>}
              {weather.winter && <InfoCard icon="❄️" title="Zima (prosinec–únor)">{weather.winter}</InfoCard>}
            </div>
          </div>
        )}

        {/* Wind + Sea info */}
        {(weather.wind_info || weather.sea_info) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {weather.wind_info && (
              <InfoCard icon="💨" title="Vítr">{weather.wind_info}</InfoCard>
            )}
            {weather.sea_info && (
              <InfoCard icon="🏊" title="Teplota moře a koupání">{weather.sea_info}</InfoCard>
            )}
          </div>
        )}

        {/* Tour banners */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Zájezdy — {info.name}</h2>
          <p className="text-sm text-gray-400 mb-5">Nejlepší nabídky na tuto sezónu</p>
          <Suspense>
            <HotelGrid forcedDestination={info.name} />
          </Suspense>
        </div>

      </main>
    </div>
  )
}

function Breadcrumb({ info, params }: { info: DestInfo; params: { country: string; destination: string } }) {
  return (
    <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-2">
      <Link href="/" className="hover:text-[#008afe] transition-colors">Zaleto</Link>
      <span className="text-gray-200">/</span>
      <Link href="/pocasi" className="hover:text-[#008afe] transition-colors">Počasí</Link>
      <span className="text-gray-200">/</span>
      <Link href={`/pocasi/${params.country}`} className="hover:text-[#008afe] transition-colors">{info.country}</Link>
      <span className="text-gray-200">/</span>
      <span className="text-gray-700 font-medium">{info.name}</span>
    </nav>
  )
}
