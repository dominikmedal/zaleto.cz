import Icon from './Icon'
import { formatDateRange, formatPrice } from './format'
import type { Hotel } from '@/lib/types'

type H = Pick<Hotel, 'slug' | 'name' | 'thumbnail_url' | 'min_price'> &
  Partial<Pick<Hotel, 'country' | 'resort_town' | 'stars' | 'next_departure' | 'next_return_date' | 'has_last_minute'>>

/** Reklamní lístek – oranžový, s označením „Reklama“. Na stránce je vždy jen jeden. */
export default function TourAd({ hotel, sticky = false, kicker = 'Nabídka dne' }: { hotel: H; sticky?: boolean; kicker?: string }) {
  const dates = formatDateRange(hotel.next_departure, hotel.next_return_date)
  const place = [hotel.resort_town, hotel.country].filter(Boolean).join(' · ')
  return (
    <aside className={`z-tk z-tk--h z-ad${sticky ? ' z-ad--sticky' : ''}`} aria-label="Nabídka">
      <div className="z-tk__in">
        <div className="z-ad__top"><span className="z-kicker">{kicker}</span></div>
        {place && <div className="z-kicker" style={{ marginBottom: 12 }}>{place}</div>}
        <div className="z-ad__media">
          {hotel.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hotel.thumbnail_url} alt={hotel.name} loading="lazy" />
          )}
          {hotel.has_last_minute ? <span className="z-stamp z-stamp--fill">Last minute</span> : null}
        </div>
        <h3 className="z-ad__title">{hotel.name}</h3>
        <ul className="z-ad__list">
          <li><Icon name="ok" />Porovnání cen od více CK</li>
          {dates && <li><Icon name="ok" />Nejbližší odlet {dates}</li>}
        </ul>
        <div className="z-ad__stub">
          <div><span className="z-price__note">od · za osobu</span><span className="z-price z-price--offer">{formatPrice(hotel.min_price)}</span></div>
          {/* celý banner je klikací (rozšířená plocha tlačítka) a vede rovnou k partnerovi s affiliate odkazem */}
          <a
            className="z-btn z-btn--offer z-btn--block z-ad__go"
            href={`/api/redirect/${encodeURIComponent(hotel.slug)}?best=1`}
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            Zobrazit nabídku<span className="z-btn__go"><Icon name="sipka" /></span>
          </a>
        </div>
      </div>
    </aside>
  )
}
