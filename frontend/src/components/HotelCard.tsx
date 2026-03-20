'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { PiMapPin, PiBuildings } from 'react-icons/pi'
import type { Hotel } from '@/lib/types'
import FavoriteButton from './FavoriteButton'

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

export default function HotelCard({ hotel, adults = 2 }: { hotel: Hotel; adults?: number }) {
  const nextDep = formatDate(hotel.next_departure)

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-cycle photos while hovered
  useEffect(() => {
    if (!hovered || photos.length <= 1) return
    intervalRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % photos.length)
    }, 1600)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [hovered, photos.length])

  const handleMouseEnter = () => setHovered(true)
  const handleMouseLeave = () => {
    setHovered(false)
    setActiveIdx(0)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const currentPhoto = photos[activeIdx] ?? photos[0]

  return (
    <Link href={`/hotel/${hotel.slug}`} className="group block">
      <article>
        {/* Image container */}
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 mb-3"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {currentPhoto ? (
            <Image
              src={currentPhoto}
              alt={hotel.name}
              fill
              className="object-cover transition-all duration-500 ease-out group-hover:scale-[1.04]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
              <PiBuildings className="w-12 h-12 text-blue-200" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />

          {/* Top-right: favorite */}
          <div className="absolute top-3 right-3">
            <FavoriteButton slug={hotel.slug} name={hotel.name} variant="card" />
          </div>

          {/* Photo dot indicators — visual progress, clickable as bonus */}
          {photos.length > 1 && (
            <div
              className={`absolute bottom-3 left-0 right-0 flex justify-center gap-1 transition-opacity duration-200 ${
                hovered ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={e => { e.preventDefault(); setActiveIdx(i) }}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIdx ? 'bg-white scale-125' : 'bg-white/55 hover:bg-white/80'
                  }`}
                  aria-label={`Fotka ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Text content */}
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

          {/* Agency + termíny row */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-gray-400">{hotel.agency}</span>
            {hotel.available_dates > 0 && (
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                {hotel.available_dates} {hotel.available_dates === 1 ? 'termín' : hotel.available_dates < 5 ? 'termíny' : 'termínů'}
              </span>
            )}
          </div>

          {/* Price row */}
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
  )
}
