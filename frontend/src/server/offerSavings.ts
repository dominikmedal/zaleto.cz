import { query } from './db'

const cache = new Map<string, { at: number; pct: number | null }>()
const TTL = 10 * 60 * 1000

/**
 * Skutečná úspora nejlevnějšího termínu hotelu oproti průměru jeho termínů.
 * Porovnává se srovnatelné (stejná délka pobytu a strava, skupina s nejvíce termíny, alespoň 3 termíny),
 * ne původní cena. Vrací celá procenta, nebo null, když rozdíl není aspoň 8 %.
 */
export async function hotelSavings(slugs: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  const missing: string[] = []
  const now = Date.now()
  for (const s of slugs) {
    const c = cache.get(s)
    if (c && now - c.at < TTL) out.set(s, c.pct)
    else missing.push(s)
  }
  if (missing.length) {
    try {
      const r = await query<{ slug: string; mn: number; av: number }>(
        `SELECT DISTINCT ON (slug) slug, mn, av FROM (
           SELECT h.slug, t.duration, COALESCE(t.meal_plan, '') AS meal, COUNT(*) AS n, MIN(t.price) AS mn, AVG(t.price) AS av
           FROM tours t JOIN hotels h ON h.id = t.hotel_id
           WHERE h.slug = ANY(?::text[]) AND t.price > 0 AND t.departure_date >= CURRENT_DATE::text
           GROUP BY h.slug, t.duration, COALESCE(t.meal_plan, '')
           HAVING COUNT(*) >= 3
         ) g ORDER BY slug, n DESC`, [missing])
      const found = new Map(r.rows.map(x => [x.slug, x]))
      for (const s of missing) {
        const x = found.get(s)
        const pct = x && x.av > 0 ? Math.floor((1 - Number(x.mn) / Number(x.av)) * 100) : 0
        const val = pct >= 8 ? Math.min(pct, 60) : null
        cache.set(s, { at: now, pct: val })
        out.set(s, val)
      }
    } catch { for (const s of missing) out.set(s, null) }
  }
  return out
}
