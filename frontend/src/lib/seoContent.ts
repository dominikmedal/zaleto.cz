import type { Filters } from './types'

/** Tvary AI obsahu pro SEO (tabulky hotel_ai, destination_seo, landing_ai plní scraper/ai_generate.py). */

export interface FaqItem { q: string; a: string }
export interface AudienceItem { who: string; text: string }

export interface HotelAI {
  summary: string
  audience: AudienceItem[]
  highlights: string[]
  watch_out: string[]
  location: string | null
  food: string | null
  faq: FaqItem[]
  generated_at: string
}

export type MonthRating = 'top' | 'dobre' | 'prumer' | 'slabe'

export interface DestinationSeo {
  months: { month: number; rating: MonthRating; text: string }[]
  audiences: AudienceItem[]
  budget: string | null
  comparison: { with: string; text: string } | null
  faq: FaqItem[]
  stats: { hotels?: number; min_price?: number; median_price?: number; monthly?: Record<string, number>; cheapest_month?: number; priciest_month?: number }
  generated_at: string
}

export interface LandingAI {
  slug: string
  type: 'meal' | 'stars' | 'month'
  value: string
  country: string | null
  title: string
  intro: string
  sections: { heading: string; text: string }[]
  faq: FaqItem[]
  hotel_count: number
  min_price: number | null
  generated_at: string
}

export const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
export const MONTHS_IN = ['lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu', 'červenci', 'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci']

export const RATING_LABEL: Record<MonthRating, string> = { top: 'Nejlepší', dobre: 'Dobrá', prumer: 'Průměrná', slabe: 'Slabší' }

/** Nejbližší výskyt měsíce (1–12) jako YYYY-MM; aktuální měsíc se bere jako ještě dostupný. */
export function nextMonth(month: number, now = new Date()): string {
  const cur = now.getMonth() + 1
  const year = month >= cur ? now.getFullYear() : now.getFullYear() + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

/** Filtry nabídky, které vstupní stránka ukazuje (stejné parametry jako /api/hotels). */
export function landingFilters(l: Pick<LandingAI, 'type' | 'value' | 'country'>, now = new Date()): Filters {
  const f: Filters = {}
  if (l.country) f.destination = l.country
  if (l.type === 'meal') f.meal_plan = l.value
  else if (l.type === 'stars') f.stars = l.value
  else f.date_month = nextMonth(Number(l.value), now)
  return f
}

/** Odkaz na vyhledávání se stejnými filtry (pro tlačítko „Všechny zájezdy“). */
export function landingSearchHref(l: Pick<LandingAI, 'type' | 'value' | 'country'>, now = new Date()): string {
  const f = landingFilters(l, now)
  const p = new URLSearchParams()
  if (f.destination) p.set('destination', f.destination)
  if (f.meal_plan) p.set('meal_plan', f.meal_plan)
  if (f.stars) p.set('stars', f.stars)
  if (f.date_month) {
    const [y, m] = f.date_month.split('-').map(Number)
    p.set('date_from', `${f.date_month}-01`)
    p.set('date_to', `${f.date_month}-${new Date(y, m, 0).getDate()}`)
    p.set('date_flex', '0')
  }
  return `/zajezdy?${p}`
}
