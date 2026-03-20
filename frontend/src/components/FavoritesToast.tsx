'use client'
import { useState, useEffect } from 'react'
import { Heart, X } from 'lucide-react'

interface Toast { id: number; name: string; added: boolean; leaving: boolean }

export default function FavoritesToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const { name, added } = (e as CustomEvent<{ name: string; added: boolean }>).detail
      const id = Date.now()

      setToasts(prev => [...prev.slice(-2), { id, name, added, leaving: false }])

      // Begin leave animation after 2.4s
      const leaveTimer = setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
        // Remove from DOM after animation
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 200)
      }, 2400)

      return () => clearTimeout(leaveTimer)
    }

    window.addEventListener('zaleto:favorites-change', handler)
    return () => window.removeEventListener('zaleto:favorites-change', handler)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-5 z-[200] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-black/8 px-4 py-3 min-w-[230px] max-w-[300px] ${
            t.leaving ? 'animate-toast-out' : 'animate-toast-in'
          }`}
        >
          {/* Icon */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            t.added ? 'bg-red-50' : 'bg-gray-50'
          }`}>
            <Heart className={`w-[15px] h-[15px] ${t.added ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">{t.name}</p>
            <p className="text-[11px] text-gray-400 mt-px">
              {t.added ? 'Přidáno do oblíbených' : 'Odebráno z oblíbených'}
            </p>
          </div>

          {/* Dismiss dot */}
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.added ? 'bg-red-400' : 'bg-gray-300'}`} />
        </div>
      ))}
    </div>
  )
}
