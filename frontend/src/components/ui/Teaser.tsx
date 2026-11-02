'use client'
import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/ui/Icon'

/**
 * Sekce s ukázkou obsahu: vidět je jen začátek, který se pozvolna ztrácí do stínu. Rozbalí ji kliknutí na nadpis,
 * na ukázku obsahu i na tlačítko pod ní (odkazy uvnitř textu dál fungují jako odkazy). Celý text je v HTML i sbalený
 * (jen oříznutý přes max-height), takže ho čtou i vyhledávače. Krátký obsah se neořezává.
 */
export default function Teaser({ head, children, collapsedHeight = 230, openLabel = 'Zobrazit celou sekci', closeLabel = 'Skrýt' }: {
  /** Nadpis sekce (kicker + h2); je-li obsah delší než ukázka, je klikací a ukazuje šipku. */
  head?: React.ReactNode
  children: React.ReactNode
  collapsedHeight?: number; openLabel?: string; closeLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [full, setFull] = useState<number | null>(null)
  const [needs, setNeeds] = useState(true)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = body.current
    if (!el) return
    const measure = () => { setFull(el.scrollHeight); setNeeds(el.scrollHeight > collapsedHeight + 60) }
    measure()
    // obsah se může doplnit později (obrázky, fonty); přeměříme při změně velikosti
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [collapsedHeight])

  const expanded = open || !needs
  const toggle = () => setOpen(o => !o)
  // klik na ukázku sbalený obsah rozbalí (odkaz v textu klik nepřebírá)
  const onBodyClick = (e: React.MouseEvent) => {
    if (expanded || (e.target as HTMLElement).closest('a')) return
    setOpen(true)
  }

  return (
    <div className="z-teaser" data-open={expanded ? 'true' : 'false'}>
      {head && (
        needs
          ? (
            <div className="z-teaser__head" role="button" tabIndex={0} aria-expanded={open} onClick={toggle}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}>
              <div>{head}</div>
              <Icon name="chevron" className="z-teaser__headchev" />
            </div>
          )
          : <div>{head}</div>
      )}
      <div ref={body} className="z-teaser__body" style={{ maxHeight: expanded ? (full ?? undefined) : collapsedHeight, cursor: expanded ? undefined : 'pointer' }} onClick={onBodyClick}>{children}</div>
      {needs && (
        <button type="button" className="z-btn z-btn--line z-btn--sm z-teaser__btn" onClick={toggle} aria-expanded={open}>
          {open ? closeLabel : openLabel}
          <Icon name="chevron" className="z-teaser__chev" />
        </button>
      )}
    </div>
  )
}
