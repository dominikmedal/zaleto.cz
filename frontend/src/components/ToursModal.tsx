'use client'
import { useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import TourDatesList from './TourDatesList'

interface Props {
  slug: string
  name: string
  onClose: () => void
}

/** Okno s termíny: obal v designu „Palubní deník“, obsah je sdílený seznam `TourDatesList`. */
export default function ToursModal({ slug, name, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div className="z-modal" role="dialog" aria-modal="true" aria-label={`Termíny zájezdů – ${name}`}>
      <div className="z-modal__scrim" onClick={onClose} />
      <div className="z-modal__panel">
        <div className="z-modal__head">
          <div style={{ minWidth: 0 }}>
            <div className="z-kicker">Termíny zájezdů</div>
            <h2 className="h3" style={{ marginTop: 'var(--space-1)' }}>{name}<span className="z-dot">.</span></h2>
          </div>
          <button type="button" className="z-iconbtn" onClick={onClose} aria-label="Zavřít"><Icon name="zavrit" /></button>
        </div>
        <div className="z-modal__body">
          <TourDatesList slug={slug} />
        </div>
      </div>
    </div>
  )
}
