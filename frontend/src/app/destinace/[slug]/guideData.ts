import 'server-only'
import { destinationGuide } from '@/server/content'
import { query } from '@/server/db'
import { fetchDestinations } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import type { DestInfo } from './resolve'
import type { DestinationGuide, GuidePhoto } from '@/lib/guide'

/** Průvodce pro destinaci: oblast má vlastní, letovisko dostane jen pláže, které k němu patří. */
export async function loadGuide(dest: DestInfo): Promise<{ guide: DestinationGuide | null; resortLinks: Record<string, string> }> {
  const regionCrumb = dest.type === 'town' && dest.breadcrumb.length >= 3 ? dest.breadcrumb[1].label : null
  const raw = dest.type === 'region' ? await destinationGuide(dest.name) : regionCrumb ? await destinationGuide(regionCrumb) : null
  const guide = raw && dest.type === 'town'
    ? { ...raw, facts: [], resorts: [], monasteries: [], sights: [], nature: [], villages: [], transport: {},
        beaches: raw.beaches.filter(b => b.resort && slugify(b.resort) === slugify(dest.name)) }
    : raw
  const resortLinks: Record<string, string> = {}
  if (guide) {
    const known = new Set<string>()
    for (const d of await fetchDestinations().catch(() => [])) if (d.resort_town) known.add(slugify(d.resort_town))
    for (const n of [...guide.resorts.map(r => r.name), ...guide.beaches.map(b => b.resort ?? '')]) {
      if (n && known.has(slugify(n)) && slugify(n) !== slugify(dest.name)) resortLinks[n] = `/destinace/${slugify(n)}`
    }
  }
  return { guide, resortLinks }
}

/** Fotky středisek (v datech průvodce nejsou): nejdřív fotka pláže patřící k středisku, jinak nejlépe hodnocený hotel v něm. */
export async function loadResortPhotos(guide: DestinationGuide): Promise<Record<string, GuidePhoto>> {
  const out: Record<string, GuidePhoto> = {}
  const missing: string[] = []
  for (const r of guide.resorts) {
    const beach = guide.beaches.find(b => b.image && b.resort && slugify(b.resort) === slugify(r.name))
    if (beach?.image) out[r.name] = beach.image
    else missing.push(r.name)
  }
  if (missing.length) {
    try {
      const rows = (await query(
        `SELECT DISTINCT ON (h.resort_town) h.resort_town, h.thumbnail_url
         FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id
         WHERE h.thumbnail_url IS NOT NULL AND s.min_price IS NOT NULL AND h.resort_town IN (${missing.map(() => '?').join(',')})
         ORDER BY h.resort_town, h.review_score DESC NULLS LAST, h.stars DESC NULLS LAST`,
        [missing],
      )).rows
      for (const row of rows) out[row.resort_town] = { url: row.thumbnail_url, credit: '', creditUrl: '' }
    } catch { /* bez fotek se zobrazí ikona */ }
  }
  return out
}
