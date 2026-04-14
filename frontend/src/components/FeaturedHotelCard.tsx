import Image from 'next/image'
import Link from 'next/link'
import { PiStarFill, PiMapPin, PiForkKnife, PiCalendarBlank, PiArrowRight, PiSparkle } from 'react-icons/pi'
import type { Hotel } from '@/lib/types'

function formatPrice(price: number) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(price)
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' })
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-amber-400 text-xs tracking-tighter">
      {'★'.repeat(Math.min(count, 5))}
    </span>
  )
}

function getPhoto(hotel: Hotel): string | null {
  if (hotel.thumbnail_url) return hotel.thumbnail_url
  try {
    const arr = JSON.parse(hotel.photos ?? '[]')
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null
  } catch { return null }
}

/** Compact vertical card — intended for 3-up grids */
export function FeaturedHotelCardCompact({ hotel }: { hotel: Hotel }) {
  const photo = getPhoto(hotel)
  const mealPlan = hotel.food_options?.split('|')[0]?.replace(/\s+\d[\d\s,.]*\s*Kč\s*$/, '').trim()
  const location = [hotel.resort_town, hotel.destination?.split('/').pop()].filter(Boolean).join(', ')

  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-[#008afe]/30 transition-all">
      {/* Badge */}
      <div className="absolute top-0 left-0 z-10 bg-[#0d4f52] text-white text-[10px] font-bold px-2.5 py-1 rounded-br-xl tracking-wide uppercase">
        Vybrali jsme pro vás
      </div>

      {/* Photo */}
      <div className="relative h-44 flex-shrink-0">
        {photo ? (
          <Image src={photo} alt={hotel.name} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#008afe]/10 to-sky-100 flex items-center justify-center">
            <PiMapPin className="w-10 h-10 text-[#008afe]/30" />
          </div>
        )}
        {/* Price badge */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-sm">
          <p className="text-[10px] text-gray-400 leading-none mb-0.5">od</p>
          <p className="text-base font-bold text-gray-800 leading-none">{formatPrice(hotel.min_price)} Kč</p>
        </div>
        {hotel.review_score && (
          <div className="absolute bottom-3 right-3 bg-[#008afe] text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
            {hotel.review_score.toFixed(1)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col gap-2.5">
        <div>
          {hotel.stars && <Stars count={hotel.stars} />}
          <h3 className="font-bold text-gray-900 text-sm leading-snug mt-0.5">{hotel.name}</h3>
          {location && (
            <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <PiMapPin className="w-3 h-3 flex-shrink-0" />
              {location}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {mealPlan && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-lg text-[11px] text-gray-500">
              <PiForkKnife className="w-3 h-3 text-gray-400" />
              {mealPlan}
            </span>
          )}
          {hotel.next_departure && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-lg text-[11px] text-gray-500">
              <PiCalendarBlank className="w-3 h-3 text-gray-400" />
              {formatDate(hotel.next_departure)}
            </span>
          )}
          {hotel.available_dates > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 border border-sky-100 rounded-lg text-[11px] text-sky-600 font-medium">
              {hotel.available_dates} {hotel.available_dates === 1 ? 'termín' : hotel.available_dates < 5 ? 'termíny' : 'termínů'}
            </span>
          )}
        </div>

        <div className="mt-auto pt-1">
          <Link
            href={`/hotel/${hotel.slug}`}
            className="inline-flex items-center gap-1.5 bg-[#0d4f52] hover:bg-[#0b4548] text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors"
          >
            Zobrazit zájezd
            <PiArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Full-width horizontal card — single featured hotel */
export default function FeaturedHotelCard({ hotel }: { hotel: Hotel }) {
  const photo = getPhoto(hotel)
  const mealPlan = hotel.food_options?.split('|')[0]?.replace(/\s+\d[\d\s,.]*\s*Kč\s*$/, '').trim()
  const location = [hotel.resort_town, hotel.destination?.split('/').pop()].filter(Boolean).join(', ')

  return (
    <div className="relative bg-white rounded-2xl border border-[#008afe]/20 shadow-[0_4px_24px_-4px_rgba(0,138,254,0.12)] overflow-hidden">
      {/* "Vybrali jsme pro vás" badge */}
      <div className="absolute top-0 left-0 z-10 bg-[#0d4f52] text-white text-[11px] font-bold px-3 py-1.5 rounded-br-xl tracking-wide uppercase">
        Vybrali jsme pro vás
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* Photo */}
        <div className="relative sm:w-56 lg:w-72 flex-shrink-0 h-48 sm:h-auto">
          {photo ? (
            <Image
              src={photo}
              alt={hotel.name}
              fill
              className="object-cover"
                         />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#008afe]/10 to-sky-100 flex items-center justify-center">
              <PiMapPin className="w-12 h-12 text-[#008afe]/30" />
            </div>
          )}
          {/* Price badge on photo */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm">
            <p className="text-[11px] text-gray-400 leading-none mb-0.5">od</p>
            <p className="text-lg font-bold leading-none">{formatPrice(hotel.min_price)} Kč</p>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 p-5 flex flex-col gap-3">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-snug">{hotel.name}</h3>
                {location && (
                  <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <PiMapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    {location}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {hotel.stars && <Stars count={hotel.stars} />}
                {hotel.review_score && (
                  <span className="bg-[#008afe] text-white text-xs font-bold px-2 py-0.5 rounded-lg">
                    {hotel.review_score.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {hotel.description && (
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
              {hotel.description.split('\n')[0]}
            </p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {mealPlan && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600">
                <PiForkKnife className="w-3.5 h-3.5 text-gray-400" />
                {mealPlan}
              </span>
            )}
            {hotel.next_departure && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600">
                <PiCalendarBlank className="w-3.5 h-3.5 text-gray-400" />
                Odjezd: {formatDate(hotel.next_departure)}
              </span>
            )}
            {hotel.available_dates > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 border border-sky-100 rounded-lg text-xs text-sky-600 font-medium">
                {hotel.available_dates} {hotel.available_dates === 1 ? 'termín' : hotel.available_dates < 5 ? 'termíny' : 'termínů'}
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="mt-auto pt-1">
            <Link
              href={`/hotel/${hotel.slug}`}
              className="inline-flex items-center gap-2 bg-[#0d4f52] hover:bg-[#0b4548] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-sm shadow-[#008afe]/25"
            >
              Zobrazit zájezd
              <PiArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Slim horizontal bar — 3 hotels in one row, dark teal bg, clickable */
export function FeaturedHotelsBar({ hotels }: { hotels: Hotel[] }) {
  if (!hotels.length) return null
  return (
    <div className="flex items-stretch rounded-2xl overflow-hidden shadow-sm">
      {/* Label column */}
      <div className="hidden sm:flex flex-shrink-0 flex-col items-center justify-center gap-1.5 px-4 bg-[#0d4f52] border-r border-white/10">
        <PiSparkle className="w-4 h-4 text-white/70" />
        <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          Doporučujeme
        </span>
      </div>
      {/* Hotel entries */}
      {hotels.map((hotel, idx) => {
        const photo = getPhoto(hotel)
        const stars = hotel.stars ? '★'.repeat(Math.min(hotel.stars, 5)) : null
        return (
          <Link
            key={hotel.slug}
            href={`/hotel/${hotel.slug}`}
            className={`flex-1 flex items-center gap-0 bg-[#0d4f52] hover:bg-[#0b4548] active:bg-[#093e41] transition-colors min-w-0 group overflow-hidden ${idx < hotels.length - 1 ? 'border-r border-white/10' : ''}`}
          >
            {/* Photo */}
            <div className="relative w-24 h-[108px] flex-shrink-0 bg-white/10">
              {photo ? (
                <Image src={photo} alt={hotel.name} fill className="object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <PiMapPin className="w-6 h-6 text-white/20" />
                </div>
              )}
              {/* Dark overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0d4f52]/60" />
            </div>
            {/* Info */}
            <div className="min-w-0 flex-1 px-4 py-3">
              {stars && <p className="text-amber-300 text-[11px] leading-none mb-1">{stars}</p>}
              <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-white/90">
                {hotel.name}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5 truncate">
                {[hotel.resort_town, hotel.destination?.split('/').pop()].filter(Boolean).join(', ')}
              </p>
              <p className="mt-2 text-xs text-white/70">
                od <span className="text-white font-bold text-sm">{formatPrice(hotel.min_price)}</span> Kč
              </p>
            </div>
            <PiArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/80 flex-shrink-0 mr-3 transition-colors" />
          </Link>
        )
      })}
    </div>
  )
}

/** Vertical sidebar strip — liquid glass with green accent */
export function FeaturedHotelsBarVertical({ hotels }: { hotels: Hotel[] }) {
  if (!hotels.length) return null
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(245,252,249,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(4,150,105,0.18)',
        boxShadow: '0 8px 32px rgba(4,150,105,0.10), 0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{
          background: 'linear-gradient(135deg, #049669 0%, #047857 100%)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        <PiSparkle className="w-3.5 h-3.5 text-white/70 flex-shrink-0" />
        <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest">Doporučujeme</span>
      </div>

      {/* Desktop: vertical stack */}
      <div className="hidden lg:block">
        {hotels.map((hotel, idx) => {
          const photo = getPhoto(hotel)
          const stars = hotel.stars ? '★'.repeat(Math.min(hotel.stars, 5)) : null
          return (
            <Link
              key={hotel.slug}
              href={`/hotel/${hotel.slug}`}
              className="flex flex-col group"
              style={idx > 0 ? { borderTop: '1px solid rgba(4,150,105,0.10)' } : {}}
            >
              <div className="relative h-28 overflow-hidden flex-shrink-0" style={{ background: 'rgba(4,150,105,0.06)' }}>
                {photo && (
                  <Image src={photo} alt={hotel.name} fill className="object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                )}
              </div>
              <div className="px-3 py-2.5">
                {stars && <p className="text-amber-500 text-[10px] mb-0.5 leading-none">{stars}</p>}
                <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-1 group-hover:text-[#049669] transition-colors">
                  {hotel.name}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                  {[hotel.resort_town, hotel.destination?.split('/').pop()].filter(Boolean).join(', ')}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[11px] text-gray-400">
                    od <span className="text-sm font-bold" style={{ color: '#049669' }}>{formatPrice(hotel.min_price)}</span> Kč
                  </p>
                  <PiArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#049669] transition-colors flex-shrink-0" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Mobile: horizontal scrollable row */}
      <div className="lg:hidden flex overflow-x-auto gap-0 snap-x snap-mandatory">
        {hotels.map((hotel, idx) => {
          const photo = getPhoto(hotel)
          const stars = hotel.stars ? '★'.repeat(Math.min(hotel.stars, 5)) : null
          return (
            <Link
              key={hotel.slug}
              href={`/hotel/${hotel.slug}`}
              className="flex-shrink-0 w-48 flex flex-col group snap-start"
              style={idx > 0 ? { borderLeft: '1px solid rgba(4,150,105,0.10)' } : {}}
            >
              <div className="relative h-24 overflow-hidden" style={{ background: 'rgba(4,150,105,0.06)' }}>
                {photo && (
                  <Image src={photo} alt={hotel.name} fill className="object-cover" />
                )}
              </div>
              <div className="px-3 py-2">
                {stars && <p className="text-amber-500 text-[10px] mb-0.5 leading-none">{stars}</p>}
                <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">
                  {hotel.name}
                </p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  od <span className="font-bold" style={{ color: '#049669' }}>{formatPrice(hotel.min_price)}</span> Kč
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
