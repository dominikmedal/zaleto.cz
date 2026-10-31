import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { fetchHotels } from '@/lib/api'
import { formatPrice } from '@/components/ui/format'

/**
 * Úzký oranžový proužek s nabídkou nad menu (oranžová je v designu vyhrazená nabídkám).
 * Plní se skutečnými nejlevnějšími last minute zájezdy; bez nich ukáže nejlevnější nabídku vůbec.
 */
export default async function OfferBar() {
  const lm = await fetchHotels({ tour_type: 'last_minute', sort: 'price_asc', limit: 12 }).then(r => r.hotels).catch(() => [])
  const isLast = lm.length > 0
  const pool = isLast ? lm : await fetchHotels({ sort: 'price_asc', limit: 12 }).then(r => r.hotels).catch(() => [])

  // jedna nabídka na místo, ať se nic neopakuje
  const seen = new Set<string>()
  const offers = pool
    .filter(h => {
      const key = h.resort_town ?? h.country ?? h.slug
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 3)
  if (offers.length === 0) return null

  return (
    <aside className="z-offerbar" aria-label="Aktuální nabídky">
      <div className="z-offerbar__in">
        <span className="z-offerbar__tag">{isLast ? 'Last minute' : 'Zájezdy'}</span>
        <ul className="z-offerbar__list">
          {offers.map(h => (
            <li key={h.slug}>
              <Link href={`/hotel/${h.slug}`}>
                <b>{h.resort_town ?? h.country}</b> od {formatPrice(h.min_price)}
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
