import { Linked, type AutoLink } from '@/lib/autolink'
import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

interface Props {
  title: string
  text: string
  icon: IconName
  /** Volitelné údaje pod textem (vzdálenost, doba jízdy…). */
  meta?: ReactNode
}

/** Lístek s ústřižkem: vpravo kulatá ikona, tečkovaná trasa a modrá tečka. */
export default function ItemCard({ title, text, icon, meta }: Props) {
  return (
    <article className="z-tk z-tk--v z-itemcard" style={{ ['--stub' as string]: '96px' }}>
      <div className="z-tk__in z-itemcard__in">
        <div className="z-itemcard__body">
          <h3 className="h4">{title}</h3>
          <p>{text}</p>
          {meta && <div className="z-meta" style={{ marginTop: 'var(--space-3)' }}>{meta}</div>}
        </div>
        <div className="z-itemcard__stub" aria-hidden="true">
          <span className="z-itemcard__ic"><Icon name={icon} /></span>
          <span className="z-itemcard__route" />
          <span className="z-itemcard__dot" />
        </div>
      </div>
    </article>
  )
}

interface Item { name: string; description: string }
interface LinkProps { links?: AutoLink[]; exclude?: string[] }

/** „Co vidět“: lístky, každý druhý s nakloněným razítkem – vypadá to jako sbírka vstupenek. */
export function PlaceTickets({ items, links, exclude }: { items: Item[] } & LinkProps) {
  return (
    <div className="z-grid-2">
      {items.map((it, i) => (
        <article key={it.name} className="z-tk z-tk--h z-placecard" style={{ ['--cut' as string]: '0px' }} data-odd={i % 2 === 1 || undefined}>
          <div className="z-tk__in">
            <span className="z-placecard__stamp"><Icon name="poloha" /></span>
            <h3 className="h3">{it.name}</h3>
            <p><Linked text={it.description} links={links} exclude={exclude} /></p>
          </div>
        </article>
      ))}
    </div>
  )
}

/** „Jídlo“: jídelní lístek na sky podkladu, názvy s tečkovaným vodítkem. */
export function FoodMenu({ items, links, exclude }: { items: Item[] } & LinkProps) {
  return (
    <div className="z-menu">
      <div className="z-menu__head"><Icon name="jidlo" size="lg" /><span className="z-kicker">Jídelní lístek</span></div>
      <ul className="z-menu__list">
        {items.map(it => (
          <li key={it.name}>
            <div className="z-menu__row"><h3 className="h4">{it.name}</h3><span className="z-menu__leader" /><span className="z-menu__dot" /></div>
            <p><Linked text={it.description} links={links} exclude={exclude} /></p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** „Výlety“: svislá trasa s modrými uzly, položky jako zastávky. */
export function TripRoute({ items, links, exclude }: { items: Item[] } & LinkProps) {
  return (
    <ol className="z-triproute">
      {items.map((it, i) => (
        <li key={it.name}>
          <span className="z-triproute__node" aria-hidden="true"><Icon name={i % 2 ? 'auto' : 'trasa'} size="sm" /></span>
          <div>
            <h3 className="h4">{it.name}</h3>
            <p><Linked text={it.description} links={links} exclude={exclude} /></p>
          </div>
        </li>
      ))}
      <li className="z-triproute__end" aria-hidden="true"><span className="z-triproute__dot" /></li>
    </ol>
  )
}
