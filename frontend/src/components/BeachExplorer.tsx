'use client'
import { useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import type { MapPin } from './GuideMap'
import type { GuideBeach } from '@/lib/guide'
import { PhotoCredit } from '@/components/ui/GuideSections'

const GuideMap = dynamic(() => import('./GuideMap'), { ssr: false, loading: () => <div className="z-map z-map--loading" /> })

const CROWD: Record<string, string> = { 'klidná': 'klidná', 'střední': 'středně rušná', 'rušná': 'rušná' }
const OTHER = 'Další pláže'

/** Pláže oblasti: mapa s značkami, filtr podle střediska a karty pláží seskupené podle středisek. */
export default function BeachExplorer({ beaches, resortLinks = {}, regionName }: { beaches: GuideBeach[]; resortLinks?: Record<string, string>; regionName: string }) {
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

      <div className="z-beaches__grid">
        {shown.flatMap(([k, list]) => list.map(b => ({ b, k }))).map(({ b, k }) => (
          <article key={b.name} className="z-beach" data-active={active === b.name || undefined}>
            <div className="z-beach__media">
              {b.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.image.url} alt={`${b.name} – pláž`} loading="lazy" />
              ) : <span className="z-beach__ph" aria-hidden="true"><Icon name="plaz" size="lg" /></span>}
              {b.type && <span className="z-beach__type">{b.type}</span>}
              {b.image && <PhotoCredit photo={b.image} className="z-beach__credit" />}
            </div>
            <div className="z-beach__body">
              {k !== OTHER && <div className="z-kicker">{resortLinks[k] ? <Link href={resortLinks[k]}>{k}</Link> : k}</div>}
              <h4 className="z-beach__title">{b.name}</h4>
              <p>{b.description}</p>
              {(b.facilities?.length || b.suitable_for?.length || b.crowd) ? (
                <ul className="z-beach__chips">
                  {b.crowd && <li data-k="crowd">{CROWD[b.crowd] ?? b.crowd}</li>}
                  {b.suitable_for?.map(x => <li key={x} data-k="for">{x}</li>)}
                  {[...new Set(b.facilities ?? [])].filter(x => !b.suitable_for?.includes(x)).map(x => <li key={x}>{x}</li>)}
                </ul>
              ) : null}
              {b.tip && <p className="z-beach__tip"><Icon name="info" size="sm" /><span>{b.tip}</span></p>}
              {typeof b.lat === 'number' && (
                <button type="button" className="z-more z-beach__map" onClick={() => onMap(b.name)}><Icon name="mapa" size="sm" />Ukázat na mapě</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
