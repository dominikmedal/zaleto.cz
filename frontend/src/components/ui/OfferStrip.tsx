import Icon from './Icon'
import CardPhotos from './CardPhotos'
import type { Hotel } from '@/lib/types'
import { hotelSavings } from '@/server/offerSavings'

type H = Pick<Hotel, 'slug' | 'name' | 'thumbnail_url' | 'stars'> & { photos?: string | null } &
  Partial<Pick<Hotel, 'resort_town' | 'country' | 'has_last_minute' | 'has_first_minute'>>

/** Kandidáti do banneru: s fotkou, nejdřív last minute, pak podle hvězdiček. Konečné tři vybere OfferStrip podle skutečné úspory. */
export function pickOffers<T extends H>(hotels: T[], count = 24): T[] {
  return hotels
    .filter(h => !!h.thumbnail_url)
    .map((h, i) => ({ h, i }))
    .sort((a, b) => (Number(!!b.h.has_last_minute) - Number(!!a.h.has_last_minute)) || ((b.h.stars ?? 0) - (a.h.stars ?? 0)) || a.i - b.i)
    .slice(0, count)
    .map(x => x.h)
}

function photosOf(h: H): string[] {
  const out: string[] = []
  if (h.thumbnail_url) out.push(h.thumbnail_url)
  try {
    const arr = h.photos ? JSON.parse(h.photos) : []
    if (Array.isArray(arr)) for (const u of arr) if (typeof u === 'string' && !out.includes(u)) out.push(u)
  } catch { /* neplatný JSON */ }
  return out.slice(0, 4)
}

/** Pás tří zájezdů pod nadpisem: fotka, hvězdičky, název a úspora. Bez cen a termínů. Z kandidátů bere ty s největší skutečnou úsporou. */
export default async function OfferStrip({ hotels, label = 'Vybrané zájezdy' }: { hotels: H[]; label?: string }) {
  if (hotels.length === 0) return null
  const savings = await hotelSavings(hotels.map(h => h.slug))
  const chosen = hotels
    .map((h, i) => ({ h, i, save: savings.get(h.slug) ?? null }))
    .sort((a, b) => ((b.save ?? 0) - (a.save ?? 0)) || a.i - b.i)
    .slice(0, 3)
  return (
    <section className="z-strip" aria-label={label}>
      {chosen.map(({ h, save }, i) => {
        const badge = save ? `Až −${save} %` : h.has_last_minute ? 'Last minute' : h.has_first_minute ? 'First minute' : null
        const stars = Math.min(5, Math.round(h.stars ?? 0))
        return (
          <a
            key={h.slug}
            href={`/api/redirect/${encodeURIComponent(h.slug)}?best=1`}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="z-tk z-strip__card"
          >
            <div className="z-strip__media">
              <CardPhotos photos={photosOf(h)} alt={h.name} priority={i === 0} />
              {badge && <span className="z-strip__badge" data-hot={save || h.has_last_minute || h.has_first_minute ? '' : undefined}>{badge}</span>}
            </div>
            <div className="z-strip__body">
              {stars > 0 && <span className="z-strip__stars" aria-label={`${stars} hvězdiček`}>{Array.from({ length: stars }, (_, k) => <Icon key={k} name="hvezda" />)}</span>}
              <h3 className="z-strip__title">{h.name}</h3>
              <span className="z-strip__place">{[h.resort_town, h.country].filter(Boolean).join(' · ')}</span>
              {save && <span className="z-strip__save">levnější než průměr termínů</span>}
              <span className="z-strip__go" aria-hidden="true"><Icon name="sipka" /></span>
            </div>
          </a>
        )
      })}
    </section>
  )
}
