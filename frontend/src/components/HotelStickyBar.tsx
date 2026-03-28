'use client'
import { useState, useEffect, useRef } from 'react'
import { PiStarFill, PiMapPin, PiCalendarBlank } from 'react-icons/pi'
import FavoriteButton from './FavoriteButton'

interface Props {
  name: string
  slug: string
  stars: number | null
  location: string
  minPrice: number
}

function fmt(p: number) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(p)
}

export default function HotelStickyBar({ name, slug, stars, location, minPrice }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      // Top: -96px = promo bar (32px) + header (64px)
      // Bottom: +9999px = sentinel below the fold counts as intersecting (not yet scrolled past)
      { threshold: 0, rootMargin: '-96px 0px 9999px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scrollToTerminy = () =>
    document.getElementById('terminy')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <>
      {/* Zero-height sentinel — observed to know when hotel header left viewport */}
      <div ref={sentinelRef} aria-hidden />

      {/* Sticky bar — slides in from behind the main header (no gap) */}
      <div
        className={`fixed top-[100px] inset-x-0 z-30 transition-all duration-300 ease-out ${
          visible
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]">
          <div className="max-w-[1680px] mx-auto px-6 sm:px-8 h-14 flex items-center gap-4">

            {/* Stars + name */}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              {stars && stars > 0 && (
                <div className="hidden sm:flex gap-px flex-shrink-0">
                  {Array.from({ length: stars }).map((_, i) => (
                    <PiStarFill key={i} className="w-3 h-3 text-amber-400" />
                  ))}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{name}</p>
                <div className="flex items-center gap-1.5 mt-px">
                  <PiMapPin className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <span className="text-[11px] text-gray-400 truncate">{location}</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-7 bg-gray-100 flex-shrink-0" />

            {/* Price */}
            <div className="hidden sm:flex flex-col items-end flex-shrink-0">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">
                od osoby
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-[17px] font-bold text-emerald-600 leading-tight">{fmt(minPrice)}</span>
                <span className="text-xs text-gray-400 font-medium">Kč</span>
              </div>
            </div>

            {/* Favorite */}
            <FavoriteButton slug={slug} variant="detail" className="flex-shrink-0 hidden sm:inline-flex" />

            {/* CTA */}
            <button
              onClick={scrollToTerminy}
              className="flex-shrink-0 inline-flex items-center gap-2 bg-[#008afe] hover:bg-[#0079e5] active:scale-[0.97] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-sm shadow-[#008afe]/25 whitespace-nowrap"
            >
              <PiCalendarBlank className="w-4 h-4" />
              <span>Vybrat termín</span>
            </button>

          </div>
        </div>
      </div>
    </>
  )
}
