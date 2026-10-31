/** Krátký popisek stravování pro metadata lístku (kanonické skupiny, jinak původní text). */
export function normalizeMealPlanLabel(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = raw.toLowerCase()
  if (v.includes('bez strav') || v.includes('room only')) return 'Bez stravy'
  if (v.includes('snídan') || v.includes('snidan') || v.includes('breakfast')) return 'Snídaně'
  if (v.includes('polopenz') || v.includes('half board')) return 'Polopenze'
  if (v.includes('plná penz') || v.includes('plna penz') || v.includes('full board')) return 'Plná penze'
  if (v.includes('all incl') || v.includes('all-incl') || v.includes('ultra')) return 'All inclusive'
  return raw.length > 22 ? null : raw
}
