import Link from 'next/link'
import Icon, { type IconName } from './Icon'
import type { GuidePhoto, GuidePlace, GuideResort, DestinationGuide } from '@/lib/guide'
import { GUIDE_SECTIONS, sectionCount } from '@/lib/guideSections'

const UNSPLASH = 'https://unsplash.com/?utm_source=zaleto&utm_medium=referral'

/** Zdroj fotky: autor + Wikimedia Commons (s licencí) nebo Unsplash. */
export function PhotoCredit({ photo, className }: { photo: GuidePhoto; className?: string }) {
  const wiki = photo.source === 'wikimedia'
  return (
    <span className={className}>
      <a href={photo.creditUrl} target="_blank" rel="noopener noreferrer">{photo.credit}</a>{' / '}
      {wiki
        ? <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Wikimedia Commons{photo.license ? `, ${photo.license}` : ''}</a>
        : <a href={UNSPLASH} target="_blank" rel="noopener noreferrer">Unsplash</a>}
    </span>
  )
}

/** Rozcestník průvodce na stránce destinace: dlaždice sekcí, každá vede na vlastní podstránku. */
export function GuideHub({ guide, base }: { guide: DestinationGuide; base: string }) {
  const tiles = GUIDE_SECTIONS.map(sec => ({ sec, n: sectionCount(guide, sec.field) })).filter(t => t.n > 0)
  if (!tiles.length) return null
  const photo = (field: string): GuidePhoto | null => {
    const v = guide[field as keyof DestinationGuide]
    return Array.isArray(v) ? ((v as { image?: GuidePhoto | null }[]).find(x => x.image)?.image ?? null) : null
  }
  return (
    <div className="z-ghub">
      {tiles.map(({ sec, n }) => {
        const ph = photo(sec.field)
        return (
          <Link key={sec.key} href={`${base}/${sec.key}`} className="z-ghub__tile">
            <div className="z-ghub__media">
              {ph ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ph.url} alt="" loading="lazy" />
              ) : <span aria-hidden="true"><Icon name={sec.icon} size="lg" /></span>}
            </div>
            <div className="z-ghub__body">
              <span className="z-ghub__ic"><Icon name={sec.icon} /></span>
              <h3>{sec.label}</h3>
              <span className="z-data">{sec.field === 'transport' ? 'letiště, doprava na místě' : `${n} ${n === 1 ? 'položka' : n < 5 ? 'položky' : 'položek'}`}</span>
              <span className="z-ghub__go" aria-hidden="true"><Icon name="sipka" size="sm" /></span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

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
            {it.image && <PhotoCredit photo={it.image} className="z-gcard__credit" />}
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
