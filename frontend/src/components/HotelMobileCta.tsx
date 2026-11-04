'use client'
import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'

/** Telefon: po odscrollování rezervační karty se dole objeví lišta s cenou a tlačítkem na termíny. CSS ji na desktopu skrývá. */
/** `href` = místo posunu na termíny otevře externí odkaz (hotel bez zájezdu → ubytování). */
export default function HotelMobileCta({ price, label, href }: { price: string; label: string; href?: string }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const box = document.querySelector('.z-bookbox')
    const dates = document.getElementById('terminy')
    if (!box) return
    let boxGone = false
    let datesIn = false
    const update = () => setShow(boxGone && !datesIn)
    const a = new IntersectionObserver(([e]) => { boxGone = !e.isIntersecting && e.boundingClientRect.top < 0; update() })
    const b = dates ? new IntersectionObserver(([e]) => { datesIn = e.isIntersecting; update() }) : null
    a.observe(box)
    if (dates && b) b.observe(dates)
    return () => { a.disconnect(); b?.disconnect() }
  }, [])
  return (
    <div className="z-hotelcta" data-show={show ? '' : undefined} aria-hidden={!show}>
      <div className="z-hotelcta__price"><span>od · za osobu</span><b>{price}</b></div>
      {href ? (
        <a className="z-btn z-btn--offer z-btn--sm" tabIndex={show ? 0 : -1} href={href} target="_blank" rel="noopener noreferrer sponsored">
          {label}<span className="z-btn__go"><Icon name="sipka" /></span>
        </a>
      ) : (
        <button type="button" className="z-btn z-btn--offer z-btn--sm" tabIndex={show ? 0 : -1}
          onClick={() => document.getElementById('terminy')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {label}<span className="z-btn__go"><Icon name="sipka" /></span>
        </button>
      )}
    </div>
  )
}
