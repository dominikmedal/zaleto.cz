import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import Icon from '@/components/ui/Icon'
import { query } from '@/server/db'
import { formatDateRange, formatPrice } from '@/components/ui/format'

interface Offer { slug: string; place: string; price: number; departure: string; lastMinute: boolean }

/** Skutečné nabídky přímo z platných termínů (budoucí odlet, kladná cena); jedna na místo. */
const loadOffers = unstable_cache(
  async (): Promise<Offer[]> => {
    const pick = async (lastMinute: boolean) => {
      const r = await query(
        `SELECT h.slug, COALESCE(h.resort_town, h.country) AS place, t.price, t.departure_date
         FROM tours t JOIN hotels h ON h.id = t.hotel_id
         WHERE t.price > 0
           AND t.departure_date >= CURRENT_DATE::text
           AND t.departure_date <= (CURRENT_DATE + INTERVAL '${lastMinute ? 45 : 120} days')::text
           AND (h.canonical_slug IS NULL OR h.canonical_slug = h.slug)
           AND COALESCE(h.resort_town, h.country) IS NOT NULL
           ${lastMinute ? 'AND t.is_last_minute = 1' : ''}
         ORDER BY t.price ASC
         LIMIT 60`,
      )
      const seen = new Set<string>()
      const out: Offer[] = []
      for (const row of r.rows) {
        if (seen.has(row.place)) continue
        seen.add(row.place)
        out.push({ slug: row.slug, place: row.place, price: Number(row.price), departure: row.departure_date, lastMinute })
        if (out.length === 3) break
      }
      return out
    }
    const lm = await pick(true)
    return lm.length > 0 ? lm : pick(false)
  },
  ['offer-bar'],
  { revalidate: 3600, tags: ['api'] },
)

/**
 * Úzký oranžový proužek s nabídkou nad menu (oranžová je v designu vyhrazená nabídkám).
 * Last minute zájezdy v nejbližších 45 dnech; když žádné nejsou, nejlevnější termíny v příštích 4 měsících.
 */
export default async function OfferBar() {
  const offers = await loadOffers().catch(() => [] as Offer[])
  if (offers.length === 0) return null
  const isLast = offers[0].lastMinute

  return (
    <aside className="z-offerbar" aria-label="Aktuální nabídky">
      <div className="z-offerbar__in">
        <span className="z-offerbar__tag">{isLast ? 'Last minute' : 'Zájezdy'}</span>
        <ul className="z-offerbar__list">
          {offers.map(o => (
            <li key={o.slug}>
              <Link href={`/hotel/${o.slug}`}>
                <b>{o.place}</b> {formatDateRange(o.departure)} od {formatPrice(o.price)}
              </Link>
            </li>
          ))}
        </ul>
        <Link className="z-offerbar__all" href={isLast ? '/zajezdy?tour_type=last_minute' : '/zajezdy'}>
          Všechny nabídky<Icon name="sipka" size="sm" />
        </Link>
      </div>
    </aside>
  )
}
