'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { formatDateRange, formatPrice } from '@/components/ui/format'

export interface ExitOfferData {
  slug: string; name: string; stars: number | null; photo: string; place: string
  price: number; departure: string; nights: number | null; meal: string | null
}

const KEY = 'zaleto-exit-offer'
const MIN_TIME_MS = 6000 // dialog hned po příchodu nevyskakuje

/**
 * Nabídka při pokusu o odchod. Webová stránka nemůže zachytit zavření tabu, proto se dialog ukáže, když kurzor
 * odjede nahoru k liště prohlížeče. Jen na počítačích (ne na telefonech a tabletech) a nejvýš jednou za relaci.
 */
export default function ExitOfferDialog({ offer }: { offer: ExitOfferData }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const since = useRef(Date.now())
  const shown = useRef(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  const show = useCallback(() => {
    if (shown.current) return
    if (Date.now() - since.current < MIN_TIME_MS) return
    try {
      if (sessionStorage.getItem(KEY)) { shown.current = true; return }
      sessionStorage.setItem(KEY, '1')
    } catch { /* soukromý režim */ }
    shown.current = true
    setOpen(true)
  }, [])

  const enabled = !pathname.startsWith('/admin') && !pathname.startsWith(`/hotel/${offer.slug}`)

  useEffect(() => {
    if (!enabled) return
    // na telefonech a tabletech (dotyk, úzký displej) se dialog nezobrazuje
    if (window.matchMedia('(pointer: coarse), (max-width: 1023px)').matches) return
    try { if (sessionStorage.getItem(KEY)) { shown.current = true; return } } catch { /* ignore */ }

    // počítač: kurzor opouští okno nahoře
    const onLeave = (e: MouseEvent) => { if (e.clientY <= 0 && !e.relatedTarget) show() }
    document.addEventListener('mouseout', onLeave)

    return () => document.removeEventListener('mouseout', onLeave)
  }, [enabled, show])

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; prev?.focus?.() }
  }, [open])

  if (!open) return null
  const meta = [offer.nights ? `${offer.nights} nocí` : null, offer.meal].filter(Boolean).join(' · ')

  return (
    <div className="z-modal z-exit" role="dialog" aria-modal="true" aria-labelledby="z-exit-title">
      <div className="z-modal__scrim" onClick={() => setOpen(false)} />
      <div className="z-exit__panel z-tk z-tk--h">
        <div className="z-tk__in">
          <button ref={closeRef} type="button" className="z-iconbtn z-exit__close" onClick={() => setOpen(false)} aria-label="Zavřít"><Icon name="zavrit" /></button>
          <span className="z-stamp z-stamp--fill z-exit__stamp">Nabídka dne</span>
          <div className="z-exit__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={offer.photo} alt={offer.name} />
          </div>
          <div className="z-exit__body">
            <div className="z-kicker">Než odejdeš</div>
            <h2 id="z-exit-title" className="z-exit__title">{offer.place}<span className="z-dot">.</span></h2>
            <p className="z-exit__hotel">{offer.name}{offer.stars ? ` · ${'★'.repeat(offer.stars)}` : ''}</p>
            <div className="z-meta">
              <span><Icon name="kalendar" />{formatDateRange(offer.departure)}</span>
              {meta && <span><Icon name="jidlo" />{meta}</span>}
            </div>
          </div>
          <div className="z-exit__stub">
            <div>
              <span className="z-price__note">od · za osobu</span>
              <span className="z-price">{formatPrice(offer.price)}</span>
            </div>
            <Link href={`/hotel/${offer.slug}`} className="z-btn z-btn--offer" onClick={() => setOpen(false)}>
              Zobrazit nabídku<span className="z-btn__go"><Icon name="sipka" /></span>
            </Link>
          </div>
        </div>
        <button type="button" className="z-more z-exit__skip" onClick={() => setOpen(false)}>Ne, děkuji</button>
      </div>
    </div>
  )
}
