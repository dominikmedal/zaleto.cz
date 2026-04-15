/**
 * Normalizace hodnot stravování z různých CK na 5 kanonických skupin.
 * Používá se v meta.js (agregace filtru) i hotels.js (WHERE podmínka).
 */

/**
 * Převede raw meal_plan řetězec na kanonickou skupinu.
 * @param {string|null} raw
 * @returns {string|null}
 */
function normalizeMealPlan(raw) {
  if (!raw) return null
  const v = raw.toLowerCase().trim()
  if (!v) return null

  if (v.includes('bez strav') || v === 'room only' || v === 'ro') return 'Bez stravy'
  if (v.includes('snídan') || v.includes('snidan') || v.includes('breakfast')) return 'Snídaně'
  if (v.includes('polopenz') || v.includes('half board') || v === 'hb') return 'Polopenze'
  if (v.includes('plná penz') || v.includes('plna penz') || v.includes('full board') || v === 'fb') return 'Plná penze'
  if (v.includes('all incl') || v.includes('all-incl') || v.includes('unlimited') ||
      v.includes('splash') || v.includes('island plan') || v.includes('lobi') ||
      v.includes('varu') || v.includes('oblu') || v.includes('lux me') ||
      v.includes('fame style') || v.includes('deluxe all') || v.includes('high end all') ||
      v.includes('diamond all')) return 'All Inclusive'

  return null
}

/**
 * SQL LIKE podmínky pro každou kanonickou skupinu.
 * Používá se v WHERE klauzuli bez parametrů (hardcoded patterns = bezpečné).
 */
const MEAL_SQL = {
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
  'Plná penze':  `(LOWER(t.meal_plan) LIKE '%plná penz%' OR LOWER(t.meal_plan) LIKE '%plna penz%' OR LOWER(t.meal_plan) LIKE '%full board%')`,
  'Polopenze':   `(LOWER(t.meal_plan) LIKE '%polopenz%' OR LOWER(t.meal_plan) LIKE '%half board%')`,
  'Snídaně':     `(LOWER(t.meal_plan) LIKE '%snídan%' OR LOWER(t.meal_plan) LIKE '%snidan%' OR LOWER(t.meal_plan) LIKE '%breakfast%')`,
  'Bez stravy':  `(LOWER(t.meal_plan) LIKE '%bez strav%' OR LOWER(t.meal_plan) LIKE '%room only%')`,
}

/** Pořadí kanonických skupin pro zobrazení ve filtru */
const MEAL_ORDER = ['All Inclusive', 'Plná penze', 'Polopenze', 'Snídaně', 'Bez stravy']

module.exports = { normalizeMealPlan, MEAL_SQL, MEAL_ORDER }
