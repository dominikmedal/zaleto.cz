'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { PiHeart, PiHeartFill, PiX } from 'react-icons/pi'
import { useFavorites } from '@/hooks/useFavorites'

export default function HeaderFavorites() {
  const { favoriteHotels, toggleFavorite } = useFavorites()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = favoriteHotels.length

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Oblíbené"
        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all ${
          open ? 'bg-red-50 text-red-500' : 'text-gray-500 hover:bg-gray-100 hover:text-red-400'
        }`}
      >
        {count > 0 ? <PiHeartFill className="w-5 h-5 text-red-500 transition-all duration-200" /> : <PiHeart className="w-5 h-5 transition-all duration-200" />}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2.5 w-76 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-black/8 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <PiHeartFill className="w-3.5 h-3.5 text-red-500" />
              <span className="text-sm font-semibold text-gray-900">Oblíbené hotely</span>
              {count > 0 && (
                <span className="text-xs text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded-full">{count}</span>
              )}
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500 transition-colors p-0.5">
              <PiX className="w-4 h-4" />
            </button>
          </div>

          {/* List */}
          {count === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <PiHeart className="w-5 h-5 text-gray-200" />
              </div>
              <p className="text-sm font-medium text-gray-500">Žádné oblíbené hotely</p>
              <p className="text-xs text-gray-400 mt-1">Klikněte na ♡ u hotelu pro uložení</p>
            </div>
          ) : (
            <ul className="py-1.5 max-h-72 overflow-y-auto divide-y divide-gray-50">
              {favoriteHotels.map(({ slug, name }) => (
                <li key={slug} className="flex items-center gap-1 px-2 py-1 hover:bg-gray-50/80 transition-colors group">
                  <Link
                    href={`/hotel/${slug}`}
                    onClick={() => setOpen(false)}
                    className="flex-1 px-2 py-2 min-w-0"
                  >
                    <span className="text-[13px] font-medium text-gray-800 group-hover:text-blue-600 transition-colors block truncate leading-tight">
                      {name}
                    </span>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">zobrazit detail →</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(slug)}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Odebrat z oblíbených"
                  >
                    <PiX className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
