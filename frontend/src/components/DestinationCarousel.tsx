'use client'
import { useRef, useCallback, useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi'
import { slugify } from '@/lib/slugify'

interface Item {
  region: string
  count: number
  thumb: string | null
  minPrice?: number | null
}

const fmt = (n: number) =>
  n >= 1_000 ? `od ${Math.round(n / 1000)} tis. Kč` : `od ${n.toLocaleString('cs-CZ')} Kč`

export default function DestinationCarousel({ items }: { items: Item[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
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
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows])

  const scrollBy = useCallback((dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })
  }, [])

  return (
    <div className="relative h-full group/carousel">

      {/* Arrow — prev */}
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Předchozí"
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 glass-pill shadow-[0_2px_12px_rgba(0,147,255,0.15)] ${
          canPrev
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <PiCaretLeft className="w-4 h-4 text-[#0093FF]" />
      </button>

      {/* Arrow — next */}
      <button
        onClick={() => scrollBy(1)}
        aria-label="Další"
        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 glass-pill shadow-[0_2px_12px_rgba(0,147,255,0.15)] ${
          canNext
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <PiCaretRight className="w-4 h-4 text-[#0093FF]" />
      </button>

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-3 h-full overflow-x-auto scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {items.map(({ region, thumb, minPrice }) => (
          <Link
            key={region}
            href={`/destinace/${slugify(region)}`}
            className="group relative flex-shrink-0 rounded-2xl overflow-hidden bg-gray-200 block h-full"
            style={{ width: 'clamp(180px, 22vw, 280px)', scrollSnapAlign: 'start' }}
          >
            {thumb ? (
              <Image
                src={thumb}
                alt={region}
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF] to-blue-700" />
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-black/2 to-transparent" />

            {/* Text — glass strip */}
            <div className="absolute bottom-0 left-0 right-0 p-2.5">
              <div style={{
                background: 'rgba(8,18,40,0.28)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                padding: '8px 12px',
              }}>
                <p
                  className="text-white font-bold leading-tight"
                  style={{ fontSize: 'clamp(12px, 1.1vw, 15px)' }}
                >
                  {region}
                </p>
                {minPrice != null && (
                  <p className="text-white/55 text-[14px] font-medium mt-0.5">
                    {fmt(minPrice)}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
