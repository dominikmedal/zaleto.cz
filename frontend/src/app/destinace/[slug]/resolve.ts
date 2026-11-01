import { fetchDestinations } from '@/lib/api'
import { slugify } from '@/lib/slugify'

export interface DestInfo {
  name: string
  country: string | null
  type: 'country' | 'region' | 'town'
  breadcrumb: { label: string; href: string }[]
}

export async function resolveDestination(slug: string): Promise<DestInfo | null> {
  let destinations
  try { destinations = await fetchDestinations() } catch { return null }

  for (const d of destinations) {
    if (d.country && slugify(d.country) === slug) {
      return { name: d.country, country: d.country, type: 'country', breadcrumb: [{ label: d.country, href: `/destinace/${slugify(d.country)}` }] }
    }
  }
  for (const d of destinations) {
    const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
    if (region && slugify(region) === slug) {
      const crumbs: { label: string; href: string }[] = []
      if (d.country) crumbs.push({ label: d.country, href: `/destinace/${slugify(d.country)}` })
      crumbs.push({ label: region, href: `/destinace/${slugify(region)}` })
      return { name: region, country: d.country, type: 'region', breadcrumb: crumbs }
    }
  }
  for (const d of destinations) {
    if (d.resort_town && slugify(d.resort_town) === slug) {
      const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
      const crumbs: { label: string; href: string }[] = []
      if (d.country) crumbs.push({ label: d.country, href: `/destinace/${slugify(d.country)}` })
      if (region && region !== d.resort_town) crumbs.push({ label: region, href: `/destinace/${slugify(region)}` })
      crumbs.push({ label: d.resort_town, href: `/destinace/${slugify(d.resort_town)}` })
      return { name: d.resort_town, country: d.country, type: 'town', breadcrumb: crumbs }
    }
  }
  return null
}

