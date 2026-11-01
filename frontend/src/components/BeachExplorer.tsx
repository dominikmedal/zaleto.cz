'use client'
import { useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { MapPin } from './GuideMap'
import type { GuideBeach } from '@/lib/guide'
import { PhotoCredit } from '@/components/ui/PhotoCredit'
import { slugify } from '@/lib/slugify'

const GuideMap = dynamic(() => import('./GuideMap'), { ssr: false, loading: () => <div className="z-map z-map--loading" /> })

const CROWD: Record<string, string> = { 'klidná': 'klidná', 'střední': 'středně rušná', 'rušná': 'rušná' }
const CROWDLVL: Record<string, number> = { 'klidná': 1, 'střední': 2, 'rušná': 3 }
const OTHER = 'Další pláže'

/** Pláže oblasti: mapa s značkami, filtr podle střediska a karty pláží seskupené podle středisek. */
export default function BeachExplorer({ beaches, resortLinks = {}, regionName, base }: { beaches: GuideBeach[]; resortLinks?: Record<string, string>; regionName: string; base: string }) {
  const [resort, setResort] = useState<string>('all')
  const [active, setActive] = useState<string | null>(null)
  const mapBox = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const m = new Map<string, GuideBeach[]>()
    for (const b of beaches) {
      const k = b.resort?.trim() || OTHER
      m.set(k, [...(m.get(k) ?? []), b])
    }
    // středisko s nejvíc plážemi první, „Další pláže“ vždy poslední
    return [...m.entries()].sort((a, b) => (a[0] === OTHER ? 1 : b[0] === OTHER ? -1 : b[1].length - a[1].length))
  }, [beaches])

  const shown = useMemo(() => (resort === 'all' ? groups : groups.filter(([k]) => k === resort)), [groups, resort])

  const pins = useMemo<MapPin[]>(() => shown.flatMap(([, list]) => list)
    .filter(b => typeof b.lat === 'number' && typeof b.lng === 'number')
    .map(b => ({
      id: b.name, lat: b.lat as number, lng: b.lng as number, kind: 'beach' as const,
      title: b.name, sub: b.resort, image: b.image?.url ? `${b.image.url.split('?')[0]}?w=480&q=70&fit=crop&auto=format` : null,
      meta: [b.type ?? '', b.crowd ? CROWD[b.crowd] ?? b.crowd : ''],
    })), [shown])

  const onMap = (name: string) => {
    setActive(name)
    mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="z-beaches">
      {pins.length > 0 && (
        <div ref={mapBox} className="z-beaches__map">
          <GuideMap pins={pins} activeId={active} onSelect={setActive} ariaLabel={`Mapa pláží: ${regionName}`} />
          <span className="z-beaches__count"><Icon name="plaz" size="sm" />{pins.length} pláží na mapě</span>
        </div>
      )}

      {groups.length > 1 && (
        <div className="z-beaches__chips" role="group" aria-label="Filtr podle střediska">
          <button type="button" className="z-chip" aria-pressed={resort === 'all'} onClick={() => setResort('all')}>Všechny ({beaches.length})</button>
          {groups.map(([k, list]) => (
            <button key={k} type="button" className="z-chip" aria-pressed={resort === k} onClick={() => setResort(k)}>{k} ({list.length})</button>
          ))}
        </div>
      )}

      <div className="z-beaches__grid z-places">
        {shown.flatMap(([k, list]) => list.map(b => ({ b, k }))).map(({ b, k }, i) => (
          <article key={b.name} className="z-tk z-tk--h z-place z-place--beach" data-active={active === b.name || undefined} style={{ ['--cut' as string]: '68px' }}>
            <div className="z-tk__in">
              <div className="z-place__media" data-tilt={i % 2}>
                {b.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.image.url} alt={`${b.name} – pláž`} loading="lazy" />
                ) : <span className="z-place__ph" aria-hidden="true"><Icon name="plaz" size="lg" /></span>}
                {b.type && <span className="z-stamp z-place__stamp">{b.type}</span>}
                {b.image && <PhotoCredit photo={b.image} className="z-place__credit" />}
              </div>
              <div className="z-place__body">
                {k !== OTHER && <div className="z-kicker">{resortLinks[k] ? <Link href={resortLinks[k]}>{k}</Link> : k}</div>}
                <h3 className="z-place__title"><Link className="z-gcard__hit" href={`${base}/${slugify(b.name)}`}>{b.name}</Link></h3>
                <p>{b.description}</p>
                {(b.facilities?.length || b.suitable_for?.length || b.crowd) ? (
                  <ul className="z-beach__chips">
                    {b.crowd && <li data-k="crowd">{CROWD[b.crowd] ?? b.crowd}</li>}
                    {b.suitable_for?.map(x => <li key={x} data-k="for">{x}</li>)}
                    {[...new Set(b.facilities ?? [])].filter(x => !b.suitable_for?.includes(x)).slice(0, 4).map(x => <li key={x}>{x}</li>)}
                  </ul>
                ) : null}
                {typeof b.lat === 'number' && (
                  <button type="button" className="z-more z-beach__map" onClick={() => onMap(b.name)}><Icon name="mapa" size="sm" />Ukázat na mapě</button>
                )}
              </div>
              <div className="z-place__stub">
                {b.crowd && CROWDLVL[b.crowd] ? (
                  <span className="z-place__nr" title={`Rušnost: ${CROWD[b.crowd] ?? b.crowd}`}>
                    <span className="z-place__crowd" data-lvl={CROWDLVL[b.crowd]} aria-hidden="true"><i /><i /><i /></span>
                    {CROWD[b.crowd] ?? b.crowd}
                  </span>
                ) : <span className="z-place__nr">Podrobnosti</span>}
                <span className="z-place__go" aria-hidden="true"><Icon name="sipka" /></span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
