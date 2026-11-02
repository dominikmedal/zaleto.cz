'use client'
import Photo from '@/components/ui/Photo'
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '@/components/ui/Icon'

interface Photo { url: string; credit: string; creditUrl: string; alt: string | null }
const UNSPLASH = 'https://unsplash.com/?utm_source=zaleto&utm_medium=referral'

/** Galerie fotek destinace: mozaika, klik otevře prohlížeč přes celou obrazovku (šipky, Esc, swipe). */
export default function PhotoGallery({ photos, name }: { photos: Photo[]; name: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchX = useRef<number | null>(null)
  const n = photos.length

  const go = useCallback((d: number) => setOpen(i => (i == null ? i : (i + d + n) % n)), [n])
  const close = useCallback(() => setOpen(null), [])

  useEffect(() => {
    if (open == null) return
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = overflow; prev?.focus?.() }
  }, [open == null, close, go]) // eslint-disable-line react-hooks/exhaustive-deps

  const cur = open != null ? photos[open] : null
  const alt = (p: Photo) => p.alt ?? `${name} – fotografie`

  return (
    <>
      <div className="z-gallery">
        {photos.map((ph, i) => (
          <figure key={ph.url} className="z-gallery__item" data-big={i === 0 || undefined}>
            <button type="button" className="z-gallery__open" onClick={() => setOpen(i)} aria-label={`Zvětšit fotografii ${i + 1} z ${n}`} aria-haspopup="dialog">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Photo widths={[400, 800]} sizes="(max-width: 767px) 50vw, 33vw" src={ph.url} alt={alt(ph)} loading="lazy" />
            </button>
            <figcaption>
              <a href={ph.creditUrl} target="_blank" rel="noopener noreferrer">{ph.credit}</a> / <a href={UNSPLASH} target="_blank" rel="noopener noreferrer">Unsplash</a>
            </figcaption>
          </figure>
        ))}
      </div>

      {cur && (
        <div className="z-lightbox" role="dialog" aria-modal="true" aria-label={`Fotogalerie: ${name}`}
          onTouchStart={e => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            if (touchX.current == null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
            touchX.current = null
          }}>
          <div className="z-lightbox__scrim" onClick={close} />
          <button ref={closeRef} type="button" className="z-lightbox__btn z-lightbox__close" onClick={close} aria-label="Zavřít"><Icon name="zavrit" /></button>
          {n > 1 && <button type="button" className="z-lightbox__btn z-lightbox__prev" onClick={() => go(-1)} aria-label="Předchozí fotografie"><Icon name="chevron" /></button>}
          {n > 1 && <button type="button" className="z-lightbox__btn z-lightbox__next" onClick={() => go(1)} aria-label="Další fotografie"><Icon name="chevron" /></button>}
          <figure className="z-lightbox__fig">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Photo widths={[400, 800]} sizes="(max-width: 767px) 50vw, 33vw" src={cur.url} alt={alt(cur)} />
            <figcaption>
              <span className="z-data">{(open ?? 0) + 1} / {n}</span>
              <span><a href={cur.creditUrl} target="_blank" rel="noopener noreferrer">{cur.credit}</a> / <a href={UNSPLASH} target="_blank" rel="noopener noreferrer">Unsplash</a></span>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  )
}
