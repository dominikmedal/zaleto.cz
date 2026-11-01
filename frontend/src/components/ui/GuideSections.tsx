import Link from 'next/link'
import Icon, { type IconName } from './Icon'
import type { GuidePlace, GuideResort } from '@/lib/guide'

const UNSPLASH = 'https://unsplash.com/?utm_source=zaleto&utm_medium=referral'

/** Karta místa s fotkou z Unsplash (kláštery, památky, příroda, vesničky). Bez fotky vznikne stylová ikonová dlaždice. */
export function PlaceCards({ items, icon }: { items: GuidePlace[]; icon: IconName }) {
  return (
    <div className="z-gcards">
      {items.map(it => (
        <article key={it.name} className="z-gcard">
          <div className="z-gcard__media">
            {it.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.image.url} alt={it.name} loading="lazy" />
            ) : <span className="z-gcard__ph" aria-hidden="true"><Icon name={icon} size="lg" /></span>}
            {it.kind && <span className="z-gcard__kind">{it.kind}</span>}
            {it.image && (
              <span className="z-gcard__credit">
                <a href={it.image.creditUrl} target="_blank" rel="noopener noreferrer">{it.image.credit}</a> / <a href={UNSPLASH} target="_blank" rel="noopener noreferrer">Unsplash</a>
              </span>
            )}
          </div>
          <div className="z-gcard__body">
            {it.location && <div className="z-kicker">{it.location}</div>}
            <h3 className="z-gcard__title">{it.name}</h3>
            <p>{it.description}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

/** Střediska oblasti: odkaz na vlastní stránku střediska, pokud ji na Zaletu máme. */
export function ResortCards({ items, links }: { items: GuideResort[]; links: Record<string, string> }) {
  return (
    <div className="z-resorts">
      {items.map(r => {
        const href = links[r.name]
        const inner = (
          <>
            <span className="z-resort__ic"><Icon name="poloha" /></span>
            <div>
              <h3 className="z-resort__title">{r.name}</h3>
              {r.vibe && <span className="z-resort__vibe">{r.vibe}</span>}
              <p>{r.description}</p>
            </div>
            {href && <span className="z-resort__go" aria-hidden="true"><Icon name="sipka" size="sm" /></span>}
          </>
        )
        return href
          ? <Link key={r.name} href={href} className="z-resort z-resort--link">{inner}</Link>
          : <div key={r.name} className="z-resort">{inner}</div>
      })}
    </div>
  )
}

/** Základní údaje o oblasti jako pás popisků. */
export function FactsStrip({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <dl className="z-facts">
      {facts.map(f => (
        <div key={f.label}><dt className="z-kicker">{f.label}</dt><dd>{f.value}</dd></div>
      ))}
    </dl>
  )
}

/** Doprava do oblasti a po oblasti (dva lístky vedle sebe). */
export function TransportCards({ transport }: { transport: { to?: string; around?: string } }) {
  const rows: { icon: IconName; title: string; text?: string }[] = [
    { icon: 'letadlo', title: 'Jak se tam dostat', text: transport.to },
    { icon: 'auto', title: 'Jak se pohybovat po oblasti', text: transport.around },
  ]
  return (
    <div className="z-grid-2">
      {rows.filter(r => r.text).map(r => (
        <article key={r.title} className="z-tk z-tk--v z-itemcard" style={{ ['--stub' as string]: '96px' }}>
          <div className="z-tk__in z-itemcard__in">
            <div className="z-itemcard__body"><h3 className="h4">{r.title}</h3><p>{r.text}</p></div>
            <div className="z-itemcard__stub" aria-hidden="true">
              <span className="z-itemcard__ic"><Icon name={r.icon} /></span><span className="z-itemcard__route" /><span className="z-itemcard__dot" />
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
