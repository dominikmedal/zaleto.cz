import Link from 'next/link'
import Icon, { type IconName } from './Icon'
import { PhotoCredit } from './PhotoCredit'
import { slugify } from '@/lib/slugify'
import type { GuidePlace } from '@/lib/guide'

const nr = (i: number) => String(i + 1).padStart(2, '0')

/**
 * Místa průvodce jako palubní lístky: fotka v okénku, razítko s typem, ústřižek s pořadovým číslem.
 * První položka je větší. Klik vede na vlastní stránku položky; bez fotky vznikne ikonová dlaždice.
 */
export default function PlaceCards({ items, icon, base }: { items: GuidePlace[]; icon: IconName; base: string }) {
  return (
    <div className="z-places">
      {items.map((it, i) => (
        <article key={it.name} className="z-tk z-tk--h z-place" data-lead={(i === 0 && items.length > 2) || undefined} style={{ ['--cut' as string]: '68px' }}>
          <div className="z-tk__in">
            <div className="z-place__media" data-tilt={i % 2}>
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image.url} alt={it.name} loading="lazy" />
              ) : <span className="z-place__ph" aria-hidden="true"><Icon name={icon} size="lg" /></span>}
              {it.kind && <span className="z-stamp z-place__stamp">{it.kind}</span>}
              {it.image && <PhotoCredit photo={it.image} className="z-place__credit" />}
            </div>
            <div className="z-place__body">
              {it.location && <div className="z-kicker">{it.location}</div>}
              <h3 className="z-place__title"><Link className="z-gcard__hit" href={`${base}/${slugify(it.name)}`}>{it.name}</Link></h3>
              <p>{it.description}</p>
            </div>
            <div className="z-place__stub">
              <span className="z-place__nr"><Icon name={icon} size="sm" />Nº {nr(i)}</span>
              <span className="z-place__go" aria-hidden="true"><Icon name="sipka" /></span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
