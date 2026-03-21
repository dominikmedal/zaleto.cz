'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { PiBuildings, PiTimer, PiCalendarStar, PiCheckCircle, PiForkKnife, PiSwimmingPool, PiWifiHigh, PiSpa, PiUmbrellaSimple } from 'react-icons/pi'
import type { Hotel } from '@/lib/types'
import FavoriteButton from './FavoriteButton'
import ToursModal from './ToursModal'

function formatPrice(price: number) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(price)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-amber-400 text-xs tracking-tighter leading-none">
      {'★'.repeat(Math.min(count, 5))}
    </span>
  )
}

function parseMealPlans(raw: string | null): string[] {
  if (!raw) return []
  return raw.split('|').map(s => s.replace(/\s+\d[\d\s,.]*\s*Kč\s*$/, '').trim()).filter(Boolean)
}

function parseAmenities(raw: string | null): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return raw.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
  }
}

// Map amenity keywords to icons
function amenityIcon(label: string) {
  const l = label.toLowerCase()
  if (l.includes('bazén') || l.includes('pool') || l.includes('aqua')) return PiSwimmingPool
  if (l.includes('wi-fi') || l.includes('wifi') || l.includes('internet')) return PiWifiHigh
  if (l.includes('spa') || l.includes('wellness') || l.includes('sauna') || l.includes('masáž')) return PiSpa
  if (l.includes('pláž') || l.includes('beach') || l.includes('moře')) return PiUmbrellaSimple
  return PiCheckCircle
}

export default function HotelCard({ hotel, adults = 2 }: { hotel: Hotel; adults?: number }) {
  const nextDep  = formatDate(hotel.next_departure)
  const meals    = parseMealPlans(hotel.food_options ?? null).slice(0, 2)
  const amenities = parseAmenities(hotel.amenities ?? null).slice(0, 3)

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!hovered || photos.length <= 1) return
    intervalRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % photos.length)
    }, 1600)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [hovered, photos.length])

  const handleMouseEnter = () => setHovered(true)
  const handleMouseLeave = () => {
    setHovered(false)
    setActiveIdx(0)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  return (
    <>
    <Link href={`/hotel/${hotel.slug}`} className="group block">
      <article onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>

        {/* ── Image ── */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 mb-3">
          {photos.length > 0 ? (
            <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.04]">
              {photos.map((photo, i) => (
                <Image
                  key={photo}
                  src={photo}
                  alt={hotel.name}
                  fill
                  className={`object-cover transition-opacity duration-400 ${i === activeIdx ? 'opacity-100' : 'opacity-0'}`}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <PiBuildings className="w-12 h-12 text-blue-200" />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

          {/* Top-left: LM/FM badge + dates badge stacked */}
          <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {hotel.has_last_minute ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-red-500 px-2 py-1 rounded-lg leading-none shadow-sm">
                <PiTimer className="w-3 h-3 flex-shrink-0" />
                Last minute
              </span>
            ) : hotel.has_first_minute ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500 px-2 py-1 rounded-lg leading-none shadow-sm">
                <PiCalendarStar className="w-3 h-3 flex-shrink-0" />
                First minute
              </span>
            ) : null}

            {hotel.available_dates > 0 && (
              <button
                type="button"
                onClick={e => { e.preventDefault(); setModalOpen(true) }}
                className="inline-flex items-center text-[10px] font-semibold text-white bg-black/40 hover:bg-black/55 backdrop-blur-sm px-2 py-1 rounded-lg leading-none transition-colors"
              >
                {hotel.available_dates} {hotel.available_dates === 1 ? 'termín' : hotel.available_dates < 5 ? 'termíny' : 'termínů'}
              </button>
            )}
          </div>

          {/* Top-right: favorite */}
          <div className="absolute top-3 right-3">
            <FavoriteButton slug={hotel.slug} name={hotel.name} variant="card" />
          </div>

          {/* Photo dots */}
          {photos.length > 1 && (
            <div className={`absolute bottom-3 left-0 right-0 flex justify-center gap-1 transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={e => { e.preventDefault(); setActiveIdx(i) }}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeIdx ? 'bg-white scale-125' : 'bg-white/55 hover:bg-white/80'}`}
                  aria-label={`Fotka ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Text ── */}
        <div className="px-0.5">

          {/* Location row */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1 min-w-0">
              {hotel.stars && hotel.stars > 0 && <Stars count={hotel.stars} />}
              <span className="text-xs text-gray-400 truncate ml-0.5">
                {[hotel.resort_town, hotel.country].filter(Boolean).join(', ')}
              </span>
            </div>
            {nextDep && (
              <span className="text-[11px] text-gray-400 whitespace-nowrap ml-2 flex-shrink-0">
                od {nextDep}
              </span>
            )}
          </div>

          {/* Hotel name */}
          <h3 className="font-semibold text-gray-900 text-[15px] leading-snug line-clamp-2 group-hover:text-[#0093FF] transition-colors mb-2">
            {hotel.name}
          </h3>

          {/* Highlights */}
          {(meals.length > 0 || amenities.length > 0) && (() => {
            const items = [
              ...meals.slice(0, 1).map(m => ({ label: m, Icon: PiForkKnife, color: 'text-amber-400' })),
              ...amenities.slice(0, 1).map(a => ({ label: a, Icon: amenityIcon(a), color: 'text-[#008afe]' })),
            ].slice(0, 2)
            return (
              <div className="flex items-center mb-2 overflow-hidden">
                {items.map(({ label, Icon, color }, i) => (
                  <span key={label} className={`inline-flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0 ${i === items.length - 1 ? 'min-w-0 flex-shrink' : ''}`}>
                    {i > 0 && <span className="text-gray-200 flex-shrink-0 mx-1">·</span>}
                    <Icon className={`w-3 h-3 flex-shrink-0 ${color}`} />
                    <span className={i === items.length - 1 ? 'truncate' : ''}>{label}</span>
                  </span>
                ))}
              </div>
            )
          })()}

          {/* Price */}
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-gray-400">od</span>
            <span className="text-lg font-bold text-emerald-600">{formatPrice(hotel.min_price)}</span>
            <span className="text-xs text-gray-400">Kč / os.</span>
          </div>
          {adults > 1 && (
            <p className="text-[11px] text-gray-400 mt-0.5">
              celkem {formatPrice(hotel.min_price * adults)} Kč
            </p>
          )}
        </div>
      </article>
    </Link>

    {modalOpen && (
      <ToursModal slug={hotel.slug} name={hotel.name} onClose={() => setModalOpen(false)} />
    )}
    </>
  )
}
