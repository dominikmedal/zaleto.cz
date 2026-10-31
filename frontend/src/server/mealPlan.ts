/** Normalizace stravování z různých CK na 5 kanonických skupin. */

export function normalizeMealPlan(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = raw.toLowerCase().trim()
  if (!v) return null

  if (v.includes('bez strav') || v === 'room only' || v === 'ro') return 'Bez stravy'
  if (v.includes('snídan') || v.includes('snidan') || v.includes('breakfast')) return 'Snídaně'
  if (v.includes('polopenz') || v.includes('half board') || v === 'hb') return 'Polopenze'
  if (v.includes('plná penz') || v.includes('plna penz') || v.includes('full board') || v === 'fb') return 'Plná penze'
  if (
    v.includes('all incl') || v.includes('all-incl') || v.includes('unlimited') ||
    v.includes('splash') || v.includes('island plan') || v.includes('lobi') ||
    v.includes('varu') || v.includes('oblu') || v.includes('lux me') ||
    v.includes('fame style') || v.includes('deluxe all') || v.includes('high end all') ||
    v.includes('diamond all')
  ) return 'All Inclusive'

  return null
}

/** SQL podmínky pro každou kanonickou skupinu (hardcoded patterns = bezpečné). */
export const MEAL_SQL: Record<string, string> = {
  'All Inclusive': `(LOWER(t.meal_plan) LIKE '%all incl%' OR LOWER(t.meal_plan) LIKE '%all-incl%'
    OR LOWER(t.meal_plan) LIKE '%unlimited%'
    OR LOWER(t.meal_plan) LIKE '%splash%'
    OR LOWER(t.meal_plan) LIKE '%island plan%'
    OR LOWER(t.meal_plan) LIKE '%lobi%'
    OR LOWER(t.meal_plan) LIKE '%varu plan%'
    OR LOWER(t.meal_plan) LIKE '%oblu%'
    OR LOWER(t.meal_plan) LIKE '%lux me%'
    OR LOWER(t.meal_plan) LIKE '%fame style%'
    OR LOWER(t.meal_plan) LIKE '%deluxe all%'
    OR LOWER(t.meal_plan) LIKE '%high end all%'
    OR LOWER(t.meal_plan) LIKE '%diamond all%')`,
  'Plná penze': `(LOWER(t.meal_plan) LIKE '%plná penz%' OR LOWER(t.meal_plan) LIKE '%plna penz%' OR LOWER(t.meal_plan) LIKE '%full board%')`,
  'Polopenze': `(LOWER(t.meal_plan) LIKE '%polopenz%' OR LOWER(t.meal_plan) LIKE '%half board%')`,
  'Snídaně': `(LOWER(t.meal_plan) LIKE '%snídan%' OR LOWER(t.meal_plan) LIKE '%snidan%' OR LOWER(t.meal_plan) LIKE '%breakfast%')`,
  'Bez stravy': `(LOWER(t.meal_plan) LIKE '%bez strav%' OR LOWER(t.meal_plan) LIKE '%room only%')`,
}

export const MEAL_ORDER = ['All Inclusive', 'Plná penze', 'Polopenze', 'Snídaně', 'Bez stravy']
