import type { MetadataRoute } from 'next'
import { fetchHotels, fetchDestinations } from '@/lib/api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://zaleto.cz'
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: base,              lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${base}/faq`,     lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/kontakt`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/o-zaleto`,lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]

  // Hotel detail pages (all, paginated)
  let hotelUrls: MetadataRoute.Sitemap = []
  try {
    // Fetch in two batches of 2000 to cover large catalogs
    const [a, b] = await Promise.all([
      fetchHotels({ limit: 2000, page: 1 }),
      fetchHotels({ limit: 2000, page: 2 }),
    ])
    const hotels = [...a.hotels, ...b.hotels]
    hotelUrls = hotels.map(h => ({
      url: `${base}/hotel/${h.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  } catch {}

  // Destination landing pages (top regions + countries)
  let destUrls: MetadataRoute.Sitemap = []
  try {
    const destinations = await fetchDestinations()
    const seen = new Set<string>()
    for (const d of destinations) {
      if (d.country && !seen.has(d.country)) {
        seen.add(d.country)
        destUrls.push({
          url: `${base}/?destination=${encodeURIComponent(d.country)}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.7,
        })
      }
      const region = d.destination?.split('/').map((s: string) => s.trim())[1] ?? d.destination?.split('/')[0]?.trim()
      if (region && !seen.has(region)) {
        seen.add(region)
        destUrls.push({
          url: `${base}/?destination=${encodeURIComponent(region)}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.65,
        })
      }
      if (d.resort_town && !seen.has(d.resort_town)) {
        seen.add(d.resort_town)
        destUrls.push({
          url: `${base}/?destination=${encodeURIComponent(d.resort_town)}`,
          lastModified: now,
          changeFrequency: 'daily' as const,
          priority: 0.6,
        })
      }
    }
  } catch {}

  return [...staticPages, ...destUrls, ...hotelUrls]
}
