import Link from 'next/link'
import Icon from './Icon'
import CardPhotos from './CardPhotos'
import { formatDateRange, formatPrice, normalizeMealPlanLabel } from './format'
import type { Hotel } from '@/lib/types'

type H = Pick<Hotel, 'slug' | 'name' | 'thumbnail_url' | 'min_price' | 'stars'> &
  { photos?: string | null } &
  Partial<Pick<Hotel, 'agency' | 'country' | 'destination' | 'resort_town' | 'next_departure' | 'next_return_date' | 'has_last_minute' | 'has_first_minute' | 'food_options'>>

/** Až 5 fotek hotelu: miniatura jako první, pak další z galerie (bez duplicit). */
function cardPhotos(hotel: { thumbnail_url: string | null; photos?: string | null }): string[] {
  const out: string[] = []
  if (hotel.thumbnail_url) out.push(hotel.thumbnail_url)
  try {
    const arr = hotel.photos ? JSON.parse(hotel.photos) : []
    if (Array.isArray(arr)) for (const u of arr) if (typeof u === 'string' && !out.includes(u)) out.push(u)
  } catch { /* neplatný JSON */ }
  return out.slice(0, 5)
}

/** Zájezd jako palubní lístek (`z-tk z-tk--h`). Odkaz vede na detail hotelu. */
export default function TourCard({ hotel, priority }: { hotel: H; priority?: boolean }) {
  const place = [hotel.resort_town, hotel.country].filter(Boolean).join(' · ')
  const dates = formatDateRange(hotel.next_departure, hotel.next_return_date)
  const stamp = hotel.has_last_minute ? 'Last minute' : hotel.has_first_minute ? 'First minute' : null

  return (
    <Link className="z-tk z-tk--h z-tour" href={`/hotel/${hotel.slug}`}>
      {stamp && <span className="z-stamp z-stamp--fill">{stamp}</span>}
      <div className="z-tk__in">
        <div className="z-tour__media">
          <CardPhotos photos={cardPhotos(hotel)} alt={hotel.name} priority={priority} />
        </div>
        <div className="z-tour__body">
          {place && <div className="z-kicker">{place}</div>}
          <h3 className="z-tour__title">
            {hotel.name}
          </h3>
          <div className="z-meta">
            {dates && <span><Icon name="kalendar" />{dates}</span>}
            {hotel.stars ? <span><Icon name="hvezda" />{Math.min(5, hotel.stars)}</span> : null}
            {hotel.agency && <span><Icon name="hotel" />{hotel.agency}</span>}
          </div>
        </div>
        <div className="z-tour__stub">
          <div>
            <span className="z-price__note">od · za osobu</span>
            <span className="z-price">{formatPrice(hotel.min_price)}</span>
          </div>
          <span className="z-round" style={{ width: 52, height: 52 }} aria-hidden="true"><Icon name="sipka" /></span>
        </div>
      </div>
    </Link>
  )
}
