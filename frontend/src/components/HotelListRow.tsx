'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  PiMapPin, PiBuildings, PiCalendarBlank, PiForkKnife,
  PiStarFill, PiCheckCircle, PiRuler, PiArrowRight,
} from 'react-icons/pi'
import type { Hotel } from '@/lib/types'
import FavoriteButton from './FavoriteButton'

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

  const [activeIdx, setActiveIdx] = useState(0)
  const [hovered, setHovered]     = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!hovered || photos.length <= 1) return
    intervalRef.current = setInterval(() => setActiveIdx(i => (i + 1) % photos.length), 1600)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [hovered, photos.length])

  const currentPhoto = photos[activeIdx] ?? photos[0]

  const amenities: string[] = (() => {
    try { return hotel.amenities ? JSON.parse(hotel.amenities) : [] }
    catch { return [] }
  })()

  const description = hotel.description ? stripHtml(hotel.description) : null

  return (
    <Link href={`/hotel/${hotel.slug}`} className="group block">
      <article className="bg-white border border-gray-100 hover:border-[#008afe]/25 hover:shadow-md rounded-2xl overflow-hidden transition-all duration-200 flex min-h-[200px]">

        {/* ── Image ── */}
        <div
          className="relative flex-shrink-0 w-[220px] sm:w-[260px] self-stretch"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); setActiveIdx(0); if (intervalRef.current) clearInterval(intervalRef.current) }}
        >
          {currentPhoto ? (
            <Image
              src={currentPhoto}
              alt={hotel.name}
              fill
              className="object-cover transition-all duration-500 group-hover:scale-[1.03]"
              sizes="260px"
            />
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
              <span className="text-[11px] text-gray-300 flex-shrink-0">·</span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{hotel.agency}</span>
            </div>

            {/* Name */}
            <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-[#008afe] transition-colors">
              {hotel.name}
            </h3>

            {/* Description */}
            {description && (
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                {description}
              </p>
            )}

            {/* Meal plans */}
            {mealPlans.length > 0 && (
              <div className="flex items-center flex-wrap gap-1.5">
                {mealPlans.map(m => (
                  <span key={m} className="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                    <PiForkKnife className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    {m}
                  </span>
                ))}
              </div>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <div className="flex items-center flex-wrap gap-1.5">
                {amenities.slice(0, 8).map(a => (
                  <span key={a} className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                    {a}
                  </span>
                ))}
                {amenities.length > 8 && (
                  <span className="text-[11px] text-gray-400">+{amenities.length - 8} dalších</span>
                )}
              </div>
            )}

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
              {hotel.available_dates > 0 && (
                <span className="text-[11px] font-semibold text-[#008afe] bg-[#008afe]/8 px-2.5 py-1 rounded-full whitespace-nowrap">
                  {hotel.available_dates} {hotel.available_dates === 1 ? 'termín' : hotel.available_dates < 5 ? 'termíny' : 'termínů'}
                </span>
              )}
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
  )
}
