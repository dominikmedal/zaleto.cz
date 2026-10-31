import { normalizeMealPlanLabel } from './meal'

export function formatPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return ''
  return `${Math.round(n).toLocaleString('cs-CZ').replace(/\s/g, ' ')} Kč`
}

/** „12.–19. 6.“ z ISO dat; bez návratu jen „12. 6.“. */
export function formatDateRange(from: string | null | undefined, to?: string | null): string {
  if (!from) return ''
  const a = new Date(from)
  if (isNaN(a.getTime())) return ''
  if (!to) return `${a.getDate()}. ${a.getMonth() + 1}.`
  const b = new Date(to)
  if (isNaN(b.getTime())) return `${a.getDate()}. ${a.getMonth() + 1}.`
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}.–${b.getDate()}. ${b.getMonth() + 1}.`
  return `${a.getDate()}. ${a.getMonth() + 1}.–${b.getDate()}. ${b.getMonth() + 1}.`
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
}

/** Kódy odletových letišť (jen ověřená česká, jinak null – žádné vymyšlené kódy). */
const AIRPORTS: Record<string, string> = {
  praha: 'PRG', brno: 'BRQ', ostrava: 'OSR', pardubice: 'PED', 'karlovy vary': 'KLV', bratislava: 'BTS',
}
export function airportCode(city: string | null | undefined): string | null {
  if (!city) return null
  return AIRPORTS[city.trim().toLowerCase()] ?? null
}

export { normalizeMealPlanLabel }

export function readingTime(min: number | null | undefined): string {
  return `${min ?? 5} min čtení`
}
