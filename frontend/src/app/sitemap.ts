import type { MetadataRoute } from 'next'
import { fetchAllHotelSlugs, fetchAllArticleSlugs, fetchDestinations } from '@/lib/api'
import { slugify } from '@/lib/slugify'

// Nevygenerovat při buildu — Railway by timeoutovalo.
// Sitemap se vygeneruje on-demand a Vercel ji cachuje 24 hodin.
export const dynamic = 'force-dynamic'
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://zaleto.cz'
  const now = new Date()

  // ── Statické stránky ──────────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: base,                               lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${base}/?tour_type=last_minute`,   lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${base}/?tour_type=first_minute`,  lastModified: now, changeFrequency: 'daily',   priority: 0.85 },
    { url: `${base}/destinace`,                lastModified: now, changeFrequency: 'daily',   priority: 0.85 },
    { url: `${base}/clanky`,                   lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/faq`,                      lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/kontakt`,                  lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/o-zaleto`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]

  // ── Stránky destinací ─────────────────────────────────────────────────────
  let destUrls: MetadataRoute.Sitemap = []
  let weatherUrls: MetadataRoute.Sitemap = []
  try {
    const destinations = await fetchDestinations()
    const seen = new Set<string>()
    const weatherCountrySeen = new Set<string>()
    const weatherDestSeen = new Set<string>()

    // Landing počasí
    weatherUrls.push({ url: `${base}/pocasi`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 })

    for (const d of destinations) {
      // Země
      if (d.country) {
        const s = slugify(d.country)
        if (!seen.has(s)) {
          seen.add(s)
          destUrls.push({ url: `${base}/destinace/${s}`, lastModified: now, changeFrequency: 'daily', priority: 0.8 })
        }
        if (!weatherCountrySeen.has(s)) {
          weatherCountrySeen.add(s)
          weatherUrls.push({ url: `${base}/pocasi/${s}`, lastModified: now, changeFrequency: 'weekly', priority: 0.75 })
        }
      }
      // Region
      const region = d.destination?.split('/').map((s: string) => s.trim())[1]
        ?? d.destination?.split('/')[0]?.trim()
      if (region && !/safari|bike|trek|plus|sport|aktivní/i.test(region)) {
        const s = slugify(region)
        if (!seen.has(s)) {
          seen.add(s)
          destUrls.push({ url: `${base}/destinace/${s}`, lastModified: now, changeFrequency: 'daily', priority: 0.75 })
        }
        if (d.country) {
          const weatherKey = `${slugify(d.country)}_${s}`
          if (!weatherDestSeen.has(weatherKey)) {
            weatherDestSeen.add(weatherKey)
            weatherUrls.push({
              url: `${base}/pocasi/${slugify(d.country)}/${s}`,
              lastModified: now,
              changeFrequency: 'weekly',
              priority: 0.7,
            })
          }
        }
      }
      // Letovisko
      if (d.resort_town) {
        const s = slugify(d.resort_town)
        if (!seen.has(s)) {
          seen.add(s)
          destUrls.push({ url: `${base}/destinace/${s}`, lastModified: now, changeFrequency: 'daily', priority: 0.7 })
        }
      }
    }
  } catch {}

  // ── Detaily hotelů ────────────────────────────────────────────────────────
  let hotelUrls: MetadataRoute.Sitemap = []
  try {
    const slugs = await fetchAllHotelSlugs()
    hotelUrls = slugs.map(({ slug, updated_at }) => ({
      url: `${base}/hotel/${slug}`,
      lastModified: updated_at ? new Date(updated_at) : now,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  } catch {}

  // ── Články ────────────────────────────────────────────────────────────────
  let articleUrls: MetadataRoute.Sitemap = []
  try {
    const articleSlugs = await fetchAllArticleSlugs()
    articleUrls = articleSlugs.map(({ slug, published_at }) => ({
      url: `${base}/clanky/${slug}`,
      lastModified: published_at ? new Date(published_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch {}

  return [...staticPages, ...destUrls, ...weatherUrls, ...hotelUrls, ...articleUrls]
}
