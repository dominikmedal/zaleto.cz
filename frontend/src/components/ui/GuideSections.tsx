import Photo from '@/components/ui/Photo'
import Link from 'next/link'
import Icon, { type IconName } from './Icon'
import { PhotoCredit } from './PhotoCredit'
import type { GuidePhoto, GuideResort, DestinationGuide } from '@/lib/guide'
import { GUIDE_SECTIONS, sectionCount } from '@/lib/guideSections'

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
                <Photo widths={[400, 800]} sizes="(max-width: 767px) 90vw, 400px" src={ph.url} alt="" loading="lazy" />
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

/** Střediska oblasti jako lístky stejně jako památky: fotka, štítek s charakterem, odkaz na stránku střediska, pokud ji na Zaletu máme. */
export function ResortCards({ items, links, photos = {} }: { items: GuideResort[]; links: Record<string, string>; photos?: Record<string, GuidePhoto> }) {
  return (
    <div className="z-places">
      {items.map((r, i) => {
        const href = links[r.name]
        const ph = photos[r.name]
        return (
          <article key={r.name} className="z-tk z-tk--h z-place" data-lead={(i === 0 && items.length > 2) || undefined} style={{ ['--cut' as string]: href ? '68px' : '0px' }}>
            <div className="z-tk__in">
              <div className="z-place__media" data-tilt={i % 2}>
                {ph ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Photo widths={[400, 800]} sizes="(max-width: 767px) 90vw, 400px" src={ph.url} alt={r.name} loading="lazy" />
                ) : <span className="z-place__ph" aria-hidden="true"><Icon name="poloha" size="lg" /></span>}
                {r.vibe && <span className="z-stamp z-place__stamp">{r.vibe}</span>}
                {ph?.credit && <PhotoCredit photo={ph} className="z-place__credit" />}
              </div>
              <div className="z-place__body">
                <h3 className="z-place__title">{href ? <Link className="z-gcard__hit" href={href}>{r.name}</Link> : r.name}</h3>
                <p>{r.description}</p>
              </div>
              {href && (
                <div className="z-place__stub">
                  <span className="z-place__nr">Zobrazit středisko</span>
                  <span className="z-place__go" aria-hidden="true"><Icon name="sipka" /></span>
                </div>
              )}
            </div>
          </article>
        )
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
