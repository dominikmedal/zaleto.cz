'use client'
import { useCallback, useState } from 'react'
import Icon, { type IconName } from './Icon'
import DetailModal from './DetailModal'
import { PhotoCredit } from './PhotoCredit'
import type { GuidePlace } from '@/lib/guide'

/** Karty míst (kláštery, památky, příroda, vesničky); klik otevře detail v okně. Bez fotky vznikne ikonová dlaždice. */
export default function PlaceCards({ items, icon, regionName }: { items: GuidePlace[]; icon: IconName; regionName?: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const prev = useCallback(() => setOpen(i => (i != null && i > 0 ? i - 1 : i)), [])
  const next = useCallback(() => setOpen(i => (i != null && i < items.length - 1 ? i + 1 : i)), [items.length])
  const cur = open != null ? items[open] : null

  return (
    <>
      <div className="z-gcards">
        {items.map((it, i) => (
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
              <h3 className="z-gcard__title"><button type="button" className="z-gcard__hit" onClick={() => setOpen(i)} aria-haspopup="dialog">{it.name}</button></h3>
              <p>{it.description}</p>
              <span className="z-more z-gcard__more" aria-hidden="true">Detail</span>
            </div>
          </article>
        ))}
      </div>
      {cur && (
        <DetailModal title={cur.name} kicker={cur.location} badge={cur.kind} image={cur.image} onClose={close}
          onPrev={open! > 0 ? prev : undefined} onNext={open! < items.length - 1 ? next : undefined}>
          <p className="z-detail__text">{cur.description}</p>
          <a className="z-more" target="_blank" rel="noopener noreferrer"
            href={`https://www.openstreetmap.org/search?query=${encodeURIComponent([cur.name, cur.location, regionName].filter(Boolean).join(', '))}`}>
            <Icon name="mapa" size="sm" />Najít na mapě
          </a>
        </DetailModal>
      )}
    </>
  )
}
