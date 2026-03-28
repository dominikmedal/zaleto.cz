'use client'
import { useRef, useEffect, useCallback, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi'
import { slugify } from '@/lib/slugify'

interface Item {
  region: string
  count: number
  thumb: string | null
}

const CARD_W = 160   // px — approximate card width + gap for scroll step
const INTERVAL = 3000 // ms

export default function DestinationCarousel({ items }: { items: Item[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const updateButtons = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  const scrollBy = useCallback((dir: 1 | -1) => {
    trackRef.current?.scrollBy({ left: dir * CARD_W * 2, behavior: 'smooth' })
  }, [])

  const startAuto = useCallback(() => {
    timerRef.current = setInterval(() => {
      const el = trackRef.current
      if (!el) return
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4
      el.scrollBy({ left: atEnd ? -(el.scrollWidth) : CARD_W, behavior: 'smooth' })
    }, INTERVAL)
  }, [])

  const stopAuto = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  useEffect(() => {
    startAuto()
    return stopAuto
  }, [startAuto, stopAuto])

  return (
    <div className="relative group/carousel">
      {/* Left arrow */}
      {canPrev && (
        <button
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:text-[#008afe] hover:border-[#008afe]/30 transition-all opacity-0 group-hover/carousel:opacity-100"
        >
          <PiCaretLeft className="w-4 h-4" />
        </button>
      )}

      {/* Right arrow */}
      {canNext && (
        <button
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-600 hover:text-[#008afe] hover:border-[#008afe]/30 transition-all opacity-0 group-hover/carousel:opacity-100"
        >
          <PiCaretRight className="w-4 h-4" />
        </button>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        onScroll={updateButtons}
        onMouseEnter={stopAuto}
        onMouseLeave={startAuto}
        className="flex gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1"
      >
        {items.map(({ region, count, thumb }) => (
          <Link
            key={region}
            href={`/destinace/${slugify(region)}`}
            className="group relative flex-shrink-0 w-[148px] rounded-xl overflow-hidden bg-gray-100 block"
            style={{ aspectRatio: '3/4' }}
          >
            {thumb ? (
              <Image
                src={thumb}
                alt={region}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#008afe] to-blue-600" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white font-semibold text-sm leading-tight">{region}</p>
              <p className="text-white/60 text-[11px] mt-0.5">{count} h.</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
