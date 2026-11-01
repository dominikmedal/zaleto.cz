import Link from 'next/link'
import Icon from './Icon'
import CardPhotos from './CardPhotos'
import { normalizeMealPlanLabel } from './format'
import type { Hotel } from '@/lib/types'

type H = Pick<Hotel, 'slug' | 'name' | 'thumbnail_url' | 'stars'> & { photos?: string | null } &
  Partial<Pick<Hotel, 'resort_town' | 'country' | 'review_score' | 'food_options'>>

function photosOf(h: H): string[] {
  const out: string[] = []
  if (h.thumbnail_url) out.push(h.thumbnail_url)
  try {
    const arr = h.photos ? JSON.parse(h.photos) : []
    if (Array.isArray(arr)) for (const u of arr) if (typeof u === 'string' && !out.includes(u)) out.push(u)
  } catch { /* neplatný JSON */ }
  return out.slice(0, 5)
}

/** Dlaždice hotelu bez ceny a termínu: fotka, hvězdičky, název, místo a drobné info. */
export default function HotelTile({ hotel, priority }: { hotel: H; priority?: boolean }) {
  const place = [hotel.resort_town, hotel.country].filter(Boolean).join(' · ')
  const meal = normalizeMealPlanLabel(hotel.food_options?.split('|')[0]?.replace(/\s+\d[\d\s,.]*\s*Kč\s*$/, '').trim())
  const stars = Math.min(5, Math.round(hotel.stars ?? 0))
  const score = hotel.review_score && hotel.review_score > 0 ? hotel.review_score : null
  return (
    <Link href={`/hotel/${hotel.slug}`} className="z-tk z-htile">
      <div className="z-htile__media"><CardPhotos photos={photosOf(hotel)} alt={hotel.name} priority={priority} /></div>
      <div className="z-htile__body">
        {place && <div className="z-kicker">{place}</div>}
        <h3 className="z-htile__title">{hotel.name}</h3>
        <div className="z-meta">
          {stars > 0 && <span className="z-htile__stars" aria-label={`${stars} hvězdiček`}>{Array.from({ length: stars }, (_, k) => <Icon key={k} name="hvezda" />)}</span>}
          {score ? <span><Icon name="hvezda" />{score.toFixed(1)}</span> : null}
          {meal && <span><Icon name="jidlo" />{meal}</span>}
        </div>
      </div>
    </Link>
  )
}
