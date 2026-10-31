import Link from 'next/link'
import Icon from './Icon'
import { formatDateRange, formatPrice, normalizeMealPlanLabel } from './format'
import type { Hotel } from '@/lib/types'

type H = Pick<Hotel, 'slug' | 'name' | 'thumbnail_url' | 'min_price' | 'stars'> &
  Partial<Pick<Hotel, 'agency' | 'country' | 'destination' | 'resort_town' | 'next_departure' | 'next_return_date' | 'has_last_minute' | 'has_first_minute' | 'food_options'>>

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
          {hotel.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hotel.thumbnail_url} alt={hotel.name} loading={priority ? 'eager' : 'lazy'} />
          )}
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
