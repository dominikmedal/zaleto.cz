'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { PiBuildings, PiTimer, PiCalendarStar, PiArrowRight, PiArrowSquareOut } from 'react-icons/pi'
import type { Hotel } from '@/lib/types'
import FavoriteButton from './FavoriteButton'
import ToursModal from './ToursModal'

function formatPrice(price: number) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(price)
}

function parseMealPlan(raw: string | null): string | null {
  if (!raw) return null
  const first = raw.split('|')[0]
  return first.replace(/\s+\d[\d\s,.]*\s*Kč\s*$/, '').trim() || null
}

const MEAL_SHORT: Record<string, string> = {
  'all inclusive':       'All Inclusive',
  'ultra all inclusive': 'Ultra All Incl.',
  'plná penze':          'Plná penze',
  'polopenze':           'Polopenze',
  'snídaně':             'Snídaně',
  'bez stravy':          'Bez stravy',
}
function mealLabel(s: string): string {
  return MEAL_SHORT[s.toLowerCase()] ?? s
}

function terminyLabel(n: number) {
  if (n === 1) return '1 termín'
  if (n < 5)  return `${n} termíny`
  return `${n} termínů`
}

export default function HotelCard({
  hotel,
  adults = 2,
  activeTourType,
  priority = false,
}: {
  hotel: Hotel
  adults?: number
  activeTourType?: string
  priority?: boolean
}) {
  const meal  = parseMealPlan(hotel.food_options ?? null)
  const isLM  = hotel.has_last_minute === 1
  const isFM  = !isLM && hotel.has_first_minute === 1

  const photos: string[] = (() => {
    try {
      const arr = hotel.photos ? JSON.parse(hotel.photos) : []
      return arr.length ? arr.slice(0, 5) : hotel.thumbnail_url ? [hotel.thumbnail_url] : []
    } catch {
      return hotel.thumbnail_url ? [hotel.thumbnail_url] : []
    }
  })()

  const [activeIdx, setActiveIdx] = useState(0)
  const [hovered,   setHovered]   = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [preloaded, setPreloaded] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const overlayRef  = useRef<HTMLDivElement>(null)
  const cardRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (photos.length <= 1 || preloaded) return
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        obs.disconnect()
        const t = setTimeout(() => setPreloaded(true), 700)
        return () => clearTimeout(t)
      }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [photos.length, preloaded])

  useEffect(() => {
    if (!hovered || photos.length <= 1) return
    intervalRef.current = setInterval(() => setActiveIdx(i => (i + 1) % photos.length), 1600)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [hovered, photos.length])

  const onEnter = () => setHovered(true)
  const onLeave = () => {
    setHovered(false)
    setActiveIdx(0)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  return (
    <>
      <Link href={`/hotel/${hotel.slug}`} className="block group" onClick={() => { if (overlayRef.current) overlayRef.current.style.display = 'flex' }}>
        <article ref={cardRef} onMouseEnter={onEnter} onMouseLeave={onLeave} onTouchStart={() => { if (!hovered) setHovered(true) }}>

          {/* ── Photo — the card itself, borderless ── */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gray-200 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.10)] group-hover:shadow-[0_8px_28px_rgba(0,0,0,0.16)] transition-shadow duration-300">

            {photos.length > 0 ? (
              <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-[1.05]">
                {(hovered || preloaded ? photos : photos.slice(0, 1)).map((src, i) => (
                  <Image
                    key={src}
                    src={src}
                    alt={hotel.name}
                    fill
                    className={`object-cover transition-opacity duration-500 ${i === activeIdx ? 'opacity-100' : 'opacity-0'}`}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    priority={priority && i === 0}
                  />
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <PiBuildings className="w-12 h-12 text-blue-300" />
              </div>
            )}

            {/* Loader */}
            <div ref={overlayRef} style={{ display: 'none' }} className="absolute inset-0 bg-black/20 items-center justify-center z-20">
              <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>

            {/* LM / FM badge — top left */}
            {isLM && (
              <div className="absolute top-3 left-3 z-10">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-red-500 px-2.5 py-1 rounded-full shadow-sm">
                  <PiTimer className="w-3 h-3" /> Last minute
                </span>
              </div>
            )}
            {isFM && (
              <div className="absolute top-3 left-3 z-10">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full shadow-sm">
                  <PiCalendarStar className="w-3 h-3" /> First minute
                </span>
              </div>
            )}

            {/* Favorite + open in new tab — top right */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Otevřít v novém okně"
                onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(`/hotel/${hotel.slug}`, '_blank') }}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all group bg-black/25 backdrop-blur-sm hover:bg-white/90"
              >
                <PiArrowSquareOut className="w-4 h-4 text-white group-hover:text-[#0093FF] transition-colors" />
              </button>
              <FavoriteButton slug={hotel.slug} name={hotel.name} variant="card" />
            </div>

            {/* Termíny count — bottom left, scarcity */}
            {hotel.available_dates > 0 && (
              <div className="absolute bottom-3 left-3 z-10">
                <button
                  type="button"
                  onClick={e => { e.preventDefault(); setModalOpen(true) }}
                  className="text-[11px] font-semibold text-white px-2.5 py-1 rounded-full transition-opacity hover:opacity-90"
                  style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(6px)' }}
                >
                  {terminyLabel(hotel.available_dates)}
                </button>
              </div>
            )}
          </div>

          {/* ── Info strip — sits on page background, no box ── */}
          <div className="px-0.5">

            {/* Row 1: stars · location   ·   meal tag */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {hotel.stars && hotel.stars > 0 && (
                  <span className="text-amber-400 text-[11px] leading-none tracking-tighter flex-shrink-0">
                    {'★'.repeat(Math.min(hotel.stars, 5))}
                  </span>
                )}
                <span className="text-[11px] text-gray-500 truncate">
                  {[hotel.resort_town, hotel.country].filter(Boolean).join(', ')}
                </span>
              </div>
              {meal && (
                <span className="text-[10px] text-gray-400 font-medium flex-shrink-0 truncate max-w-[90px]">
                  {mealLabel(meal)}
                </span>
              )}
            </div>

            {/* Row 2: Hotel name — the single marketing anchor */}
            <h3
              className="font-bold text-gray-900 leading-snug line-clamp-1 mb-2.5 group-hover:text-[#0093FF] transition-colors duration-200"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1rem' }}
            >
              {hotel.name}
            </h3>

            {/* Row 3: price + expanding pill CTA */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[16px] font-bold tabular-nums" style={{ color: '#049669' }}>
                  {formatPrice(hotel.min_price)}
                </span>
                <span className="text-[12px] text-gray-400 ml-1">Kč / os.</span>
                {adults > 1 && (
                  <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">
                    spolu {formatPrice(hotel.min_price * adults)} Kč
                  </p>
                )}
              </div>

              {/* Expanding pill */}
              <div className="flex items-center gap-1.5 rounded-full border border-[#C8E3FF] bg-[#EDF6FF] group-hover:bg-[#0093FF] group-hover:border-[#0093FF] transition-all duration-200 overflow-hidden flex-shrink-0 px-2.5 py-[7px] group-hover:px-3.5">
                <span className="text-[11px] font-semibold text-[#0093FF] group-hover:text-white transition-colors duration-200 max-w-0 group-hover:max-w-[56px] overflow-hidden whitespace-nowrap">
                  Zobrazit
                </span>
                <PiArrowRight className="w-3.5 h-3.5 text-[#0093FF] group-hover:text-white transition-all duration-200 group-hover:translate-x-0.5 flex-shrink-0" />
              </div>
            </div>
          </div>
        </article>
      </Link>

      {modalOpen && <ToursModal slug={hotel.slug} name={hotel.name} onClose={() => setModalOpen(false)} />}
    </>
  )
}
