'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  PiMapPin, PiBuildings, PiCalendarBlank, PiForkKnife,
  PiStarFill, PiCheckCircle, PiRuler, PiArrowRight, PiTimer, PiCalendarStar,
  PiSwimmingPool, PiWifiHigh, PiSpa, PiUmbrellaSimple,
} from 'react-icons/pi'
import type { Hotel } from '@/lib/types'
import FavoriteButton from './FavoriteButton'
import ToursModal from './ToursModal'

const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(n)

function formatDate(s: string | null) {
  if (!s) return null
  const [y, m, d] = s.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseMealPlans(raw: string | null): string[] {
  if (!raw) return []
  return raw.split('|').map(s => s.replace(/\s+\d[\d\s,.]*\s*Kč\s*$/, '').trim()).filter(Boolean)
}

function parseDistances(raw: string | null): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, 3) : []
  } catch {
    return raw.split(/[,;|]/).slice(0, 3).map(s => s.trim()).filter(Boolean)
  }
}

function amenityIcon(label: string) {
  const l = label.toLowerCase()
  if (l.includes('bazén') || l.includes('pool') || l.includes('aqua')) return PiSwimmingPool
  if (l.includes('wi-fi') || l.includes('wifi') || l.includes('internet')) return PiWifiHigh
  if (l.includes('spa') || l.includes('wellness') || l.includes('sauna') || l.includes('masáž')) return PiSpa
  if (l.includes('pláž') || l.includes('beach') || l.includes('moře')) return PiUmbrellaSimple
  return PiCheckCircle
}

function parsePriceIncludes(raw: string | null): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.slice(0, 4) : []
  } catch {
    return raw.split(/[,;|]/).slice(0, 4).map(s => s.trim()).filter(Boolean)
  }
}

export default function HotelListRow({ hotel, adults = 2 }: { hotel: Hotel; adults?: number }) {
  const nextDep   = formatDate(hotel.next_departure)
  const mealPlans = parseMealPlans(hotel.food_options)
  const distances = parseDistances(hotel.distances)
  const includes  = parsePriceIncludes(hotel.price_includes)

  const photos: string[] = (() => {
    try {
      const arr = hotel.photos ? JSON.parse(hotel.photos) : []
      return arr.length ? arr.slice(0, 5) : hotel.thumbnail_url ? [hotel.thumbnail_url] : []
    } catch {
      return hotel.thumbnail_url ? [hotel.thumbnail_url] : []
    }
  })()

  const [activeIdx,  setActiveIdx]  = useState(0)
  const [hovered,    setHovered]    = useState(false)
  const [modalOpen,  setModalOpen]  = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!hovered || photos.length <= 1) return
    intervalRef.current = setInterval(() => setActiveIdx(i => (i + 1) % photos.length), 1600)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [hovered, photos.length])

  const amenities: string[] = (() => {
    try { return hotel.amenities ? JSON.parse(hotel.amenities) : [] }
    catch { return [] }
  })()

  const description = hotel.description ? stripHtml(hotel.description) : null

  return (
    <>
    <Link href={`/hotel/${hotel.slug}`} className="group block">
      <article
        className="bg-white border border-gray-100 hover:border-[#008afe]/25 hover:shadow-md rounded-2xl overflow-hidden transition-all duration-200 flex min-h-[200px]"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setActiveIdx(0); if (intervalRef.current) clearInterval(intervalRef.current) }}
      >

        {/* ── Image ── */}
        <div className="relative flex-shrink-0 w-[220px] sm:w-[260px] self-stretch">
          {photos.length > 0 ? (
            <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]">
              {photos.map((photo, i) => (
                <Image
                  key={photo}
                  src={photo}
                  alt={hotel.name}
                  fill
                  className={`object-cover transition-opacity duration-400 ${i === activeIdx ? 'opacity-100' : 'opacity-0'}`}
                  sizes="260px"
                />
              ))}
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <PiBuildings className="w-12 h-12 text-blue-200" />
            </div>
          )}
          {photos.length > 1 && (
            <div className={`absolute bottom-2 left-0 right-0 flex justify-center gap-1 transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
              {photos.map((_, i) => (
                <button key={i} type="button"
                  onClick={e => { e.preventDefault(); setActiveIdx(i) }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIdx ? 'bg-white scale-125' : 'bg-white/55'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-w-0 p-5 gap-5">

          {/* ── Left: main info ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">

            {/* Stars + score + location */}
            <div className="flex items-center gap-2 flex-wrap">
              {hotel.stars && hotel.stars > 0 && (
                <div className="flex gap-px flex-shrink-0">
                  {Array.from({ length: hotel.stars }).map((_, i) => (
                    <PiStarFill key={i} className="w-3 h-3 text-amber-400" />
                  ))}
                </div>
              )}
              {hotel.review_score != null && (
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-1.5 py-px rounded-md leading-none flex-shrink-0">
                  {hotel.review_score.toFixed(1)}
                </span>
              )}
              <div className="flex items-center gap-1 text-xs text-gray-400 min-w-0">
                <PiMapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{[hotel.resort_town, hotel.country].filter(Boolean).join(', ')}</span>
              </div>
            </div>

            {/* Name + badges */}
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-[#008afe] transition-colors">
                {hotel.name}
              </h3>
              <div className="flex flex-col items-start gap-1 mt-0.5 flex-shrink-0">
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
                    className="inline-flex items-center text-[10px] font-semibold text-[#008afe] bg-[#008afe]/8 hover:bg-[#008afe]/15 px-2 py-1 rounded-lg leading-none transition-colors whitespace-nowrap"
                  >
                    {hotel.available_dates} {hotel.available_dates === 1 ? 'termín' : hotel.available_dates < 5 ? 'termíny' : 'termínů'}
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            {description && (
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                {description}
              </p>
            )}

            {/* Highlights */}
            {(mealPlans.length > 0 || amenities.length > 0) && (() => {
              const items = [
                ...mealPlans.slice(0, 1).map(m => ({ label: m, Icon: PiForkKnife, color: 'text-amber-400' })),
                ...amenities.slice(0, 1).map(a => ({ label: a, Icon: amenityIcon(a), color: 'text-[#008afe]' })),
              ].slice(0, 2)
              return (
                <div className="flex items-center overflow-hidden">
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

            {/* Distances */}
            {distances.length > 0 && (
              <div className="flex items-center flex-wrap gap-3">
                {distances.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                    <PiRuler className="w-3 h-3 flex-shrink-0" />
                    {d}
                  </span>
                ))}
              </div>
            )}

            {/* Price includes */}
            {includes.length > 0 && (
              <div className="flex items-center flex-wrap gap-2">
                {includes.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                    <PiCheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: price + CTA ── */}
          <div className="flex-shrink-0 flex flex-col items-end justify-between gap-3 min-w-[140px] border-l border-gray-100 pl-5">

            <FavoriteButton slug={hotel.slug} name={hotel.name} variant="card" />

            <div className="flex flex-col items-end gap-2 text-right">
              {nextDep && (
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  <PiCalendarBlank className="w-3 h-3 flex-shrink-0" />
                  <span className="whitespace-nowrap">{nextDep}</span>
                </div>
              )}
              <div className="mt-1">
                <p className="text-[11px] text-gray-400 mb-0.5">cena od osoby</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-emerald-600 leading-none">{fmt(hotel.min_price)}</span>
                  <span className="text-sm text-gray-400 font-medium">Kč</span>
                </div>
                {adults > 1 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">celkem {fmt(hotel.min_price * adults)} Kč</p>
                )}
              </div>
            </div>

            <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#008afe] hover:bg-[#0079e5] active:scale-[0.97] px-4 py-2.5 rounded-xl transition-all whitespace-nowrap w-full justify-center">
              Zobrazit
              <PiArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </article>
    </Link>

    {modalOpen && (
      <ToursModal slug={hotel.slug} name={hotel.name} onClose={() => setModalOpen(false)} />
    )}
    </>
  )
}
