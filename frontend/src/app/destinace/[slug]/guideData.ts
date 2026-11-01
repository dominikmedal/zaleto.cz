import 'server-only'
import { destinationGuide } from '@/server/content'
import { fetchDestinations } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import type { DestInfo } from './resolve'
import type { DestinationGuide } from '@/lib/guide'

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
