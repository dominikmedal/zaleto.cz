import { unstable_cache } from 'next/cache'
import { query } from '@/server/db'
import ExitOfferDialog, { type ExitOfferData } from './ExitOfferDialog'

/** Nejlevnější last minute zájezd s fotkou (jinak nejlevnější termín v příštích 4 měsících). */
const loadOffer = unstable_cache(
  async (): Promise<ExitOfferData | null> => {
    const pick = async (lastMinute: boolean) => {
      const r = await query(
        `SELECT h.slug, h.name, h.stars, h.thumbnail_url, h.country, COALESCE(h.resort_town, h.country) AS place,
                t.price, t.departure_date, t.duration, t.meal_plan
         FROM tours t JOIN hotels h ON h.id = t.hotel_id
         WHERE t.price > 0 AND h.thumbnail_url IS NOT NULL
           AND t.departure_date >= CURRENT_DATE::text
           AND t.departure_date <= (CURRENT_DATE + INTERVAL '${lastMinute ? 45 : 120} days')::text
           AND (h.canonical_slug IS NULL OR h.canonical_slug = h.slug)
           ${lastMinute ? 'AND t.is_last_minute = 1' : ''}
         ORDER BY t.price ASC
         LIMIT 1`,
      )
      return r.rows[0] ?? null
    }
    const row = (await pick(true)) ?? (await pick(false))
    if (!row) return null
    return {
      slug: row.slug, name: row.name, stars: row.stars ?? null, photo: row.thumbnail_url, place: row.place ?? row.country ?? '',
      price: Number(row.price), departure: row.departure_date, nights: row.duration ?? null, meal: row.meal_plan ?? null,
    }
  },
  ['exit-offer'],
  { revalidate: 3600, tags: ['api'] },
)

/** Dialog „než odejdeš“ s nejlepší aktuální nabídkou. Zobrazí se jednou za relaci (viz ExitOfferDialog). */
export default async function ExitOffer() {
  const offer = await loadOffer().catch(() => null)
  return offer ? <ExitOfferDialog offer={offer} /> : null
}
