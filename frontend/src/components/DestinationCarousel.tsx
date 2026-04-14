'use client'
import { useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PiCaretLeft, PiCaretRight, PiArrowRight, PiMapPin } from 'react-icons/pi'
import { slugify } from '@/lib/slugify'

interface Item {
  region: string
  count: number
  thumb: string | null
  minPrice?: number | null
}

function fmtKc(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)} tis. Kč`
  return `${n.toLocaleString('cs-CZ')} Kč`
}

// Magazine mosaic: 1 featured (2 rows) + 4 compact
const PAGE_SIZE = 5

export default function DestinationCarousel({ items }: { items: Item[] }) {
  const [page, setPage] = useState(0)
  const totalPages = useMemo(() => Math.max(1, Math.ceil(items.length / PAGE_SIZE)), [items.length])

  const prev = useCallback(() => setPage(p => Math.max(0, p - 1)), [])
  const next = useCallback(() => setPage(p => Math.min(totalPages - 1, p + 1)), [totalPages])

  const pageItems = useMemo(
    () => items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [items, page]
  )

  const featured = pageItems[0] ?? null
  const compacts = pageItems.slice(1)
  const empties  = Math.max(0, 4 - compacts.length)

  return (
    <div className="relative h-full flex flex-col gap-3">
      <style>{`
        @keyframes _mosaic_in {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        ._mosaic { animation: _mosaic_in 0.4s cubic-bezier(.22,.68,0,1.2) both; }
        ._m1 { animation-delay: 0ms; }
        ._m2 { animation-delay: 40ms; }
        ._m3 { animation-delay: 80ms; }
        ._m4 { animation-delay: 110ms; }
        ._m5 { animation-delay: 140ms; }
      `}</style>

      {/* ── Desktop: magazine mosaic (1 featured + 4 compact) ── */}
      <div
        key={`page-${page}`}
        className="hidden lg:grid flex-1 min-h-0"
        style={{
          gridTemplateColumns: '2.1fr 1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '10px',
        }}
      >
        {/* Featured — spans full height */}
        {featured ? (
          <Link
            href={`/destinace/${slugify(featured.region)}`}
            className="group relative overflow-hidden bg-gray-200 block rounded-2xl _mosaic _m1"
            style={{ gridRow: 'span 2' }}
          >
            {featured.thumb ? (
              <Image src={featured.thumb} alt={featured.region} fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF] to-blue-700" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-black/25" />

            {/* Hotel count pill — top left */}
            <div className="absolute top-3.5 left-3.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/90 backdrop-blur-md border border-white/20 px-2 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.22)' }}>
                <PiMapPin className="w-2.5 h-2.5" />
                {featured.count} hotelů
              </span>
            </div>

            {/* Content — bottom */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white font-bold leading-tight mb-2.5 drop-shadow-md"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2vw, 28px)' }}>
                {featured.region}
              </p>
              {featured.minPrice != null ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg, #0093FF, #0070E0)', boxShadow: '0 2px 12px rgba(0,147,255,0.45)' }}>
                  <span className="text-[12px] font-bold text-white tracking-wide">od {fmtKc(featured.minPrice)}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <span className="text-[11px] font-medium text-white/70">Zobrazit nabídky</span>
                </div>
              )}
            </div>

            {/* Hover arrow */}
            <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center border border-white/25 bg-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:bg-white"
              style={{ backdropFilter: 'blur(8px)' }}>
              <PiArrowRight className="w-3.5 h-3.5 text-white group-hover:text-[#0093FF]" />
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl bg-gray-50/50" style={{ gridRow: 'span 2' }} />
        )}

        {/* Compact cards */}
        {compacts.map((item, i) => (
          <Link
            key={item.region}
            href={`/destinace/${slugify(item.region)}`}
            className={`group relative rounded-xl overflow-hidden bg-gray-200 block h-full _mosaic _m${i + 2}`}
          >
            {item.thumb ? (
              <Image src={item.thumb} alt={item.region} fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF] to-blue-700" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/8 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-2.5">
              <p className="text-white font-bold text-[12px] leading-tight truncate drop-shadow-sm">{item.region}</p>
              {item.minPrice != null ? (
                <p className="text-white/80 text-[10px] font-semibold mt-0.5">od {fmtKc(item.minPrice)}</p>
              ) : (
                <p className="text-white/45 text-[10px] mt-0.5">{item.count} hotelů</p>
              )}
            </div>
          </Link>
        ))}

        {/* Empty placeholders */}
        {Array.from({ length: empties }).map((_, i) => (
          <div key={`e-${i}`} className="rounded-xl bg-gray-50/60" />
        ))}
      </div>

      {/* ── Mobile: horizontal scroll ── */}
      <div className="flex lg:hidden gap-3 h-48 overflow-x-auto scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
        {items.map(item => (
          <Link
            key={item.region}
            href={`/destinace/${slugify(item.region)}`}
            className="group relative flex-shrink-0 h-full rounded-2xl overflow-hidden bg-gray-200 block"
            style={{ width: 'clamp(155px, 50vw, 210px)', scrollSnapAlign: 'start' }}
          >
            {item.thumb ? (
              <Image src={item.thumb} alt={item.region} fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF] to-blue-700" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <p className="text-white font-bold text-[14px] leading-tight drop-shadow-sm">{item.region}</p>
              {item.minPrice != null ? (
                <div className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,147,255,0.85)' }}>
                  <span className="text-[10px] font-bold text-white">od {fmtKc(item.minPrice)}</span>
                </div>
              ) : (
                <p className="text-white/55 text-[11px] mt-0.5">{item.count} hotelů</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* ── Pagination — desktop ── */}
      <div className="hidden lg:flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button key={i} onClick={() => setPage(i)} aria-label={`Strana ${i + 1}`}
              className={`rounded-full transition-all duration-200 ${i === page ? 'w-6 h-2 bg-[#0093FF]' : 'w-2 h-2 bg-gray-200 hover:bg-[#0093FF]/50'}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} disabled={page === 0} aria-label="Předchozí"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border ${
              page === 0 ? 'border-gray-100 text-gray-200 cursor-not-allowed'
                : 'border-[#0093FF]/25 text-[#0093FF] hover:bg-[#0093FF] hover:text-white hover:border-[#0093FF] hover:shadow-md hover:shadow-[#0093FF]/25'
            }`}>
            <PiCaretLeft className="w-4 h-4" />
          </button>
          <button onClick={next} disabled={page === totalPages - 1} aria-label="Další"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 border ${
              page === totalPages - 1 ? 'border-gray-100 text-gray-200 cursor-not-allowed'
                : 'border-[#0093FF]/25 text-[#0093FF] hover:bg-[#0093FF] hover:text-white hover:border-[#0093FF] hover:shadow-md hover:shadow-[#0093FF]/25'
            }`}>
            <PiCaretRight className="w-4 h-4" />
          </button>
          <Link href="/destinace"
            className="flex items-center gap-1 text-[12px] font-semibold text-[#0093FF] hover:text-[#0070E0] transition-colors ml-1">
            Všechny destinace <PiArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
