'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import Icon from './Icon'
import { PhotoCredit } from './PhotoCredit'
import type { GuidePhoto } from '@/lib/guide'

/** Detail položky průvodce v překryvném okně (Esc, klik mimo, šipky mezi položkami, návrat fokusu). */
export default function DetailModal({ title, kicker, badge, image, children, onClose, onPrev, onNext }: {
  title: string; kicker?: string; badge?: string; image?: GuidePhoto | null
  children: ReactNode; onClose: () => void; onPrev?: () => void; onNext?: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev?.()
      else if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = overflow; prev?.focus?.() }
  }, [onClose, onPrev, onNext])

  return (
    <div className="z-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="z-modal__scrim" onClick={onClose} />
      <div className="z-modal__panel z-detail">
        <button ref={closeRef} type="button" className="z-iconbtn z-detail__close" onClick={onClose} aria-label="Zavřít"><Icon name="zavrit" /></button>
        <div className="z-detail__scroll">
          <div className="z-detail__media">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt={title} />
            ) : null}
            {badge && <span className="z-detail__badge">{badge}</span>}
            {image && <PhotoCredit photo={image} className="z-detail__credit" />}
          </div>
          <div className="z-detail__body">
            {kicker && <div className="z-kicker">{kicker}</div>}
            <h2 className="z-detail__title">{title}<span className="z-dot">.</span></h2>
            {children}
          </div>
        </div>
        {(onPrev || onNext) && (
          <div className="z-detail__nav">
            <button type="button" className="z-more" onClick={onPrev} disabled={!onPrev}>Předchozí</button>
            <button type="button" className="z-more" onClick={onNext} disabled={!onNext}>Další</button>
          </div>
        )}
      </div>
    </div>
  )
}
