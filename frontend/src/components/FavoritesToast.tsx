'use client'
import { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'

interface Toast { id: number; name: string; added: boolean; leaving: boolean }

/** Bublinka po přidání / odebrání z oblíbených: malý lístek s perforací a modrou tečkou. */
export default function FavoritesToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const { name, added } = (e as CustomEvent<{ name: string; added: boolean }>).detail
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev.slice(-2), { id, name, added, leaving: false }])
      setTimeout(() => {
        setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)))
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250)
      }, 2600)
    }
    window.addEventListener('zaleto:favorites-change', handler)
    return () => window.removeEventListener('zaleto:favorites-change', handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="z-toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="z-toast" data-added={t.added || undefined} data-leaving={t.leaving || undefined}>
          <span className="z-toast__icon" aria-hidden="true"><Icon name="srdce" /></span>
          <span className="z-toast__text">
            <b>{t.name}</b>
            <small>{t.added ? 'Uloženo do oblíbených' : 'Odebráno z oblíbených'}</small>
          </span>
          <span className="z-toast__stub" aria-hidden="true"><i /></span>
        </div>
      ))}
    </div>
  )
}
