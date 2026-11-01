import type { IconName } from '@/components/ui/Icon'
import type { DestinationGuide } from './guide'

/** Sekce průvodce: každá má vlastní podstránku /destinace/<slug>/<key>. */
export const GUIDE_SECTIONS: { key: string; label: string; heading: string; icon: IconName; field: keyof DestinationGuide }[] = [
  { key: 'strediska', label: 'Střediska', heading: 'střediska a letoviska', icon: 'poloha', field: 'resorts' },
  { key: 'plaze', label: 'Pláže', heading: 'pláže', icon: 'plaz', field: 'beaches' },
  { key: 'klastery', label: 'Kláštery', heading: 'kláštery a poutní místa', icon: 'mesto', field: 'monasteries' },
  { key: 'pamatky', label: 'Památky a muzea', heading: 'památky a muzea', icon: 'kompas', field: 'sights' },
  { key: 'priroda', label: 'Příroda', heading: 'přírodní zajímavosti', icon: 'hory', field: 'nature' },
  { key: 'vesnicky', label: 'Vesničky', heading: 'vesničky a městečka', icon: 'srdce', field: 'villages' },
  { key: 'doprava', label: 'Doprava', heading: 'jak se tam dostat a jak se pohybovat', icon: 'auto', field: 'transport' },
]

export function sectionCount(g: DestinationGuide, field: keyof DestinationGuide): number {
  const v = g[field]
  if (Array.isArray(v)) return v.length
  if (v && typeof v === 'object') return Object.values(v).filter(Boolean).length
  return 0
}
