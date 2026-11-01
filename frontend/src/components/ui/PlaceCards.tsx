import Link from 'next/link'
import Icon, { type IconName } from './Icon'
import { PhotoCredit } from './PhotoCredit'
import { slugify } from '@/lib/slugify'
import type { GuidePlace } from '@/lib/guide'

/** Karty míst (kláštery, památky, příroda, vesničky); každá vede na vlastní stránku položky. Bez fotky vznikne ikonová dlaždice. */
export default function PlaceCards({ items, icon, base }: { items: GuidePlace[]; icon: IconName; base: string }) {
  return (
    <div className="z-gcards">
      {items.map(it => (
        <article key={it.name} className="z-gcard z-gcard--open">
          <div className="z-gcard__media">
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image.url} alt={it.name} loading="lazy" />
            ) : <span className="z-gcard__ph" aria-hidden="true"><Icon name={icon} size="lg" /></span>}
            {it.kind && <span className="z-gcard__kind">{it.kind}</span>}
            {it.image && <PhotoCredit photo={it.image} className="z-gcard__credit" />}
          </div>
          <div className="z-gcard__body">
            {it.location && <div className="z-kicker">{it.location}</div>}
            <h3 className="z-gcard__title"><Link className="z-gcard__hit" href={`${base}/${slugify(it.name)}`}>{it.name}</Link></h3>
            <p>{it.description}</p>
            <span className="z-more z-gcard__more" aria-hidden="true">Podrobnosti</span>
          </div>
        </article>
      ))}
    </div>
  )
}
