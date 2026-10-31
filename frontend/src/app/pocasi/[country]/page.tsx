import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import WeatherView from '@/components/WeatherView'
import JsonLd from '@/components/JsonLd'
import { fetchDestinations, fetchDestinationPhoto, fetchWeatherAI, fetchWeatherLocation, fetchHotels } from '@/lib/api'
import { slugify } from '@/lib/slugify'

export const revalidate = 3600
export const dynamicParams = true

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

  const [weather, location, heroPhoto, hotels] = await Promise.all([
    fetchWeatherAI(info.name),
    fetchWeatherLocation(info.name),
    fetchDestinationPhoto(info.name).catch(() => null),
    fetchHotels({ destination: info.name, limit: 6, sort: 'stars_desc' }).then(r => r.hotels).catch(() => []),
  ])

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
    <>
      <JsonLd data={breadcrumbSchema} />
      <Header />
      <WeatherView
        name={info.name}
        crumbs={[{ label: 'Zaleto', href: '/' }, { label: 'Počasí', href: '/pocasi' }, { label: info.name }]}
        weather={weather}
        location={location}
        heroPhoto={heroPhoto}
        hotels={hotels}
        toursHref={`/destinace/${params.country}`}
        subDestinations={info.subDestinations}
        subBase={`/pocasi/${params.country}`}
      />
    </>
  )
}
