import type { MetadataRoute } from 'next'
import { landingList } from '@/server/content'
import { fetchAllHotelSlugs, fetchAllArticleSlugs, fetchDestinations, fetchDynamicCarDestinations } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { guideSitemapPaths } from '@/server/content'
import { mergeDestinations } from '@/lib/carRental'
import { SITE as base, type SitemapId } from '@/lib/seo'

// Sitemapa je rozdělená na části (/sitemap/<id>.xml, app/sitemap/[id]/route.ts); index je v app/sitemap.xml/route.ts.
// Generuje se on-demand (nikdy při buildu) a Vercel ji cachuje 24 hodin.

// lastModified uvádíme jen tam, kde známe skutečné datum změny; jinak ho vynecháváme
// (vymyšlené „teď“ u všech adres vyhledávače naučí datu nevěřit).

type Entry = MetadataRoute.Sitemap[number]

function staticPages(): Entry[] {
  // Stránky s pevným obsahem mají pevné datum změny; seznamy nabídek se mění průběžně (bez data).
  const staticDate = new Date('2026-10-31T00:00:00Z')
  return [
    { url: base,                                    changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${base}/zajezdy`,                       changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${base}/zajezdy?tour_type=last_minute`, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${base}/zajezdy?tour_type=first_minute`, changeFrequency: 'daily',  priority: 0.85 },
    { url: `${base}/destinace`,                     changeFrequency: 'daily',   priority: 0.85 },
    { url: `${base}/cestopisy`,                     changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/clanky`,                        changeFrequency: 'daily',   priority: 0.8 },
    { url: `${base}/ubytovani`,                     changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/pujcovna-aut`,                  changeFrequency: 'weekly',  priority: 0.85 },
    { url: `${base}/faq`,                           lastModified: staticDate, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/spoluprace`,                    lastModified: staticDate, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/kontakt`,                       lastModified: staticDate, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/o-zaleto`,                      lastModified: staticDate, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/ochrana-osobnich-udaju`,        lastModified: staticDate, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/developers`,                    lastModified: staticDate, changeFrequency: 'monthly', priority: 0.4 },
  ]
}

/** Země, regiony a letoviska (destinace) + odpovídající stránky počasí. */
async function destinationPages(): Promise<{ dest: Entry[]; weather: Entry[] }> {
  const dest: Entry[] = []
  const weather: Entry[] = [{ url: `${base}/pocasi`, changeFrequency: 'weekly', priority: 0.8 }]
  try {
    const destinations = await fetchDestinations()
    const seen = new Set<string>()
    const weatherCountrySeen = new Set<string>()
    const weatherDestSeen = new Set<string>()

    for (const d of destinations) {
      // Země
      if (d.country) {
        const s = slugify(d.country)
        if (!seen.has(s)) {
          seen.add(s)
          dest.push({ url: `${base}/destinace/${s}`, changeFrequency: 'daily', priority: 0.8 })
        }
        if (!weatherCountrySeen.has(s)) {
          weatherCountrySeen.add(s)
          weather.push({ url: `${base}/pocasi/${s}`, changeFrequency: 'weekly', priority: 0.75 })
        }
      }
      // Region
      const region = d.destination?.split('/').map((s: string) => s.trim())[1]
        ?? d.destination?.split('/')[0]?.trim()
      if (region && !/safari|bike|trek|plus|sport|aktivní/i.test(region)) {
        const s = slugify(region)
        if (!seen.has(s)) {
          seen.add(s)
          dest.push({ url: `${base}/destinace/${s}`, changeFrequency: 'daily', priority: 0.75 })
        }
        if (d.country) {
          const weatherKey = `${slugify(d.country)}_${s}`
          if (!weatherDestSeen.has(weatherKey)) {
            weatherDestSeen.add(weatherKey)
            weather.push({ url: `${base}/pocasi/${slugify(d.country)}/${s}`, changeFrequency: 'weekly', priority: 0.7 })
          }
        }
      }
      // Letovisko
      if (d.resort_town) {
        const s = slugify(d.resort_town)
        if (!seen.has(s)) {
          seen.add(s)
          dest.push({ url: `${base}/destinace/${s}`, changeFrequency: 'daily', priority: 0.7 })
        }
      }
    }
  } catch {}
  return { dest, weather }
}

async function hotelPages(): Promise<Entry[]> {
  try {
    const slugs = await fetchAllHotelSlugs()
    return slugs.map(({ slug, updated_at }) => ({
      url: `${base}/hotel/${slug}`,
      ...(updated_at ? { lastModified: new Date(updated_at) } : {}),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))
  } catch { return [] }
}

/** Vstupní stránky (All Inclusive Egypt, Řecko v září …); vznikají jen tam, kde je dost hotelů a AI text. */
async function landingPages(): Promise<Entry[]> {
  return (await landingList()).map(l => ({ url: `${base}/zajezdy/${l.slug}`, lastModified: new Date(l.generated_at), changeFrequency: 'daily' as const, priority: l.country ? 0.7 : 0.8 }))
}

async function articlePages(): Promise<Entry[]> {
  try {
    const articleSlugs = await fetchAllArticleSlugs()
    return articleSlugs.map(({ slug, published_at }) => ({
      url: `${base}/clanky/${slug}`,
      ...(published_at ? { lastModified: new Date(published_at) } : {}),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch { return [] }
}

async function carRentalPages(): Promise<Entry[]> {
  const dynamicCarDests = await fetchDynamicCarDestinations().catch(() => [])
  const allCarDests = mergeDestinations(dynamicCarDests)
  return allCarDests.flatMap(d => [
    { url: `${base}/pujcovna-aut/${d.slug}`,                          changeFrequency: 'weekly' as const,  priority: d.popular ? 0.80 : 0.70 },
    { url: `${base}/pujcovna-aut/${d.slug}/tipy-na-vylety-autem`,     changeFrequency: 'monthly' as const, priority: d.popular ? 0.65 : 0.55 },
    { url: `${base}/pujcovna-aut/${d.slug}/pravidla-provozu`,         changeFrequency: 'monthly' as const, priority: d.popular ? 0.65 : 0.55 },
    { url: `${base}/pujcovna-aut/${d.slug}/nejcastejsi-dotazy`,       changeFrequency: 'monthly' as const, priority: d.popular ? 0.65 : 0.55 },
  ])
}

async function guidePages(): Promise<Entry[]> {
  return (await guideSitemapPaths()).map(g => ({ url: `${base}${g.path}`, lastModified: new Date(g.at), changeFrequency: 'monthly' as const, priority: 0.6 }))
}

export async function sitemapEntries(id: SitemapId): Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case 'stranky':      return staticPages()
    case 'destinace':    return (await destinationPages()).dest
    case 'pocasi':       return (await destinationPages()).weather
    case 'pruvodce':     return guidePages()
    case 'hotely':       return hotelPages()
    case 'prehledy':     return landingPages()
    case 'clanky':       return articlePages()
    case 'pujcovna-aut': return carRentalPages()
  }
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function sitemapXml(entries: MetadataRoute.Sitemap): string {
  const rows = entries.map(e =>
    `  <url><loc>${esc(e.url)}</loc>` +
    (e.lastModified ? `<lastmod>${new Date(e.lastModified).toISOString()}</lastmod>` : '') +
    (e.changeFrequency ? `<changefreq>${e.changeFrequency}</changefreq>` : '') +
    (e.priority != null ? `<priority>${e.priority}</priority>` : '') +
    `</url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`
}
