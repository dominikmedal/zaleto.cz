'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { PiCaretLeft, PiCaretRight, PiMapPin } from 'react-icons/pi'
import { slugify } from '@/lib/slugify'

interface Item {
  region: string
  count: number
}

export default function DestinationChipsBar({ items }: { items: Item[] }) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const active   = sp.get('destination') ?? ''

  const trackRef  = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const updateArrows = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    return () => el.removeEventListener('scroll', updateArrows)
  }, [updateArrows])

  const scrollBy = useCallback((dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }, [])

  const handleClick = useCallback((region: string) => {
    const params = new URLSearchParams(sp.toString())
    if (params.get('destination') === region) {
      params.delete('destination')
    } else {
      params.set('destination', region)
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [sp, pathname, router])

  if (items.length === 0) return null

  return (
    <div className="relative flex items-center gap-2">
      {/* Left arrow */}
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Posunout doleva"
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 glass-pill ${
          canPrev ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <PiCaretLeft className="w-3.5 h-3.5 text-[#0093FF]" />
      </button>

      {/* Scrollable track */}
      <div
        ref={trackRef}
        className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1"
        style={{ scrollSnapType: 'x proximity' }}
      >
        {items.map(({ region, count }) => {
          const isActive = active === region
          return (
            <button
              key={region}
              type="button"
              onClick={() => handleClick(region)}
              style={{ scrollSnapAlign: 'start' }}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap border ${
                isActive
                  ? 'bg-[#0093FF] text-white border-[#0093FF] shadow-[0_2px_10px_rgba(0,147,255,0.30)]'
                  : 'text-gray-600 border-[rgba(200,227,255,0.65)] bg-[rgba(237,246,255,0.72)] hover:bg-white hover:border-[rgba(0,147,255,0.32)] hover:text-[#0093FF]'
              }`}
            >
              <PiMapPin className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-[#0093FF]'}`} />
              {region}
              <span className={`text-[10px] font-normal ${isActive ? 'text-white/75' : 'text-gray-400'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scrollBy(1)}
        aria-label="Posunout doprava"
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 glass-pill ${
          canNext ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <PiCaretRight className="w-3.5 h-3.5 text-[#0093FF]" />
      </button>
    </div>
  )
}
