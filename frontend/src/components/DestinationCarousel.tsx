'use client'
import { useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PiCaretLeft, PiCaretRight, PiArrowRight } from 'react-icons/pi'
import { slugify } from '@/lib/slugify'

interface Item {
  region: string
  count: number
  thumb: string | null
  minPrice?: number | null
}

const fmt = (n: number) =>
  n >= 10_000 ? `od ${Math.round(n / 1000)} tis. Kč` : `od ${n.toLocaleString('cs-CZ')} Kč`

// How many cards per page per breakpoint — we can't use hooks conditionally,
// so we detect window width at render time for SSR-safe default of 6.
const COLS = 3
const ROWS = 2
const PAGE_SIZE = COLS * ROWS // 6

export default function DestinationCarousel({ items }: { items: Item[] }) {
  const [page, setPage] = useState(0)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / PAGE_SIZE)), [items.length])

  const prev = useCallback(() => setPage(p => Math.max(0, p - 1)), [])
  const next = useCallback(() => setPage(p => Math.min(totalPages - 1, p + 1)), [totalPages])

  const pageItems = useMemo(
    () => items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [items, page]
  )

  return (
    <div className="relative h-full flex flex-col gap-3">

      {/* Grid — desktop: 3 cols × 2 rows; mobile: horizontal single-row scroll */}
      <div className="hidden lg:grid flex-1 min-h-0" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)`, gap: '10px' }}>
        {pageItems.map(({ region, thumb, minPrice, count }) => (
          <DestCard key={region} region={region} thumb={thumb} minPrice={minPrice} count={count} />
        ))}
        {/* Fill empty cells so grid stays stable */}
        {Array.from({ length: PAGE_SIZE - pageItems.length }).map((_, i) => (
          <div key={`empty-${i}`} className="rounded-2xl bg-gray-50/50" />
        ))}
      </div>

      {/* Mobile: horizontal scroll (unchanged behaviour) */}
      <div
        className="flex lg:hidden gap-3 h-44 overflow-x-auto scrollbar-hide"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {items.map(({ region, thumb, minPrice, count }) => (
          <div key={region} className="flex-shrink-0" style={{ width: 'clamp(160px, 48vw, 220px)', scrollSnapAlign: 'start' }}>
            <DestCard region={region} thumb={thumb} minPrice={minPrice} count={count} fullHeight />
          </div>
        ))}
      </div>

      {/* Pagination row — desktop only */}
      <div className="hidden lg:flex items-center justify-between gap-3 flex-shrink-0">

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`rounded-full transition-all duration-200 ${
                i === page
                  ? 'w-5 h-2 bg-[#0093FF]'
                  : 'w-2 h-2 bg-gray-200 hover:bg-[#0093FF]/40'
              }`}
              aria-label={`Strana ${i + 1}`}
            />
          ))}
        </div>

        {/* Arrow buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            disabled={page === 0}
            aria-label="Předchozí"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border ${
              page === 0
                ? 'border-gray-100 text-gray-200 cursor-not-allowed'
                : 'border-[#0093FF]/20 text-[#0093FF] hover:bg-[#0093FF] hover:text-white hover:border-[#0093FF] hover:shadow-md hover:shadow-[#0093FF]/20'
            }`}
          >
            <PiCaretLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            disabled={page === totalPages - 1}
            aria-label="Další"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border ${
              page === totalPages - 1
                ? 'border-gray-100 text-gray-200 cursor-not-allowed'
                : 'border-[#0093FF]/20 text-[#0093FF] hover:bg-[#0093FF] hover:text-white hover:border-[#0093FF] hover:shadow-md hover:shadow-[#0093FF]/20'
            }`}
          >
            <PiCaretRight className="w-4 h-4" />
          </button>

          {/* "Všechny destinace" link */}
          <Link
            href="/destinace"
            className="flex items-center gap-1.5 text-[12px] font-semibold text-[#0093FF] hover:text-[#0070E0] transition-colors ml-1"
          >
            Všechny destinace <PiArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

    </div>
  )
}

function DestCard({
  region,
  thumb,
  minPrice,
  count,
  fullHeight,
}: Item & { fullHeight?: boolean }) {
  return (
    <Link
      href={`/destinace/${slugify(region)}`}
      className={`group relative rounded-2xl overflow-hidden bg-gray-200 block ${fullHeight ? 'h-full' : 'h-full'}`}
    >
      {thumb ? (
        <Image
          src={thumb}
          alt={region}
          fill
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF] to-blue-700" />
      )}

      {/* Gradient overlay — stronger at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      {/* Subtle hover overlay */}
      <div className="absolute inset-0 bg-[#0093FF]/0 group-hover:bg-[#0093FF]/10 transition-colors duration-300" />

      {/* Hotel count badge — top right */}
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-[9px] font-bold text-white/90 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
          {count} hot.
        </span>
      </div>

      {/* Text strip — glass */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <div style={{
          background: 'rgba(6,14,32,0.30)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '10px',
          padding: '6px 10px',
        }}>
          <p className="text-white font-bold leading-tight truncate" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            {region}
          </p>
          {minPrice != null && (
            <p className="text-white/55 font-medium mt-0.5" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
              {fmt(minPrice)}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
