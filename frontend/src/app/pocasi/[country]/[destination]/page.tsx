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

  const [weather, location, heroPhoto, hotels] = await Promise.all([
    fetchWeatherAI(info.name),
    fetchWeatherLocation(info.name),
    fetchDestinationPhoto(info.name).then(u => u ?? fetchDestinationPhoto(info.country)).catch(() => null),
    fetchHotels({ destination: info.name, limit: 6, sort: 'stars_desc' }).then(r => r.hotels).catch(() => []),
  ])

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Počasí', item: 'https://zaleto.cz/pocasi' },
      { '@type': 'ListItem', position: 3, name: info.country, item: `https://zaleto.cz/pocasi/${params.country}` },
      { '@type': 'ListItem', position: 4, name: info.name, item: `https://zaleto.cz/pocasi/${params.country}/${params.destination}` },
    ],
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <Header />
      <WeatherView
        name={info.name}
        crumbs={[{ label: 'Zaleto', href: '/' }, { label: 'Počasí', href: '/pocasi' }, { label: info.country, href: `/pocasi/${params.country}` }, { label: info.name }]}
        weather={weather}
        location={location}
        heroPhoto={heroPhoto}
        hotels={hotels}
        toursHref={`/destinace/${params.destination}`}
      />
    </>
  )
}
