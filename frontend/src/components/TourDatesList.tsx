'use client'
import { useState } from 'react'
import { Calendar, Plane, Moon, Utensils, ExternalLink } from 'lucide-react'
import { PiUserMinus, PiUserPlus } from 'react-icons/pi'
import type { Tour } from '@/lib/types'
import { API } from '@/lib/api'

function formatPrice(p: number) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(p)
}

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

function bookingUrl(slug: string, tour: Tour, adults: number) {
  const params = new URLSearchParams({
    date:   tour.departure_date || '',
    nights: String(tour.duration || 7),
    adults: String(adults),
  })
  return `${API}/api/redirect/${slug}?${params}`
}

export default function TourDatesList({ tours, slug }: { tours: Tour[]; slug: string }) {
  const [sortBy,      setSortBy]      = useState<'date_asc' | 'price_asc'>('date_asc')
  const [adults,      setAdults]      = useState(2)
  const [cityFilter,  setCityFilter]  = useState<string[]>([])

  const availableCities = Array.from(new Set(tours.map(t => t.departure_city).filter(Boolean) as string[]))

  const sorted = [...tours].sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price
    return (a.departure_date || '').localeCompare(b.departure_date || '')
  })

  const filtered = cityFilter.length > 0 ? sorted.filter(t => cityFilter.includes(t.departure_city || '')) : sorted

  if (tours.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl">
        <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Žádné dostupné termíny</p>
        <p className="text-sm text-gray-400 mt-1">Zkuste upravit datum nebo počet nocí</p>
      </div>
    )
  }

  return (
    <div>
      {/* Controls row */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Seřadit:</span>
          {(['date_asc', 'price_asc'] as const).map(opt => (
            <button key={opt} onClick={() => setSortBy(opt)}
              className={`text-sm px-3 py-1.5 rounded-xl border transition-all ${
                sortBy === opt ? 'bg-[#008afe] text-white border-[#008afe]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#008afe]'
              }`}>
              {opt === 'date_asc' ? 'Datum' : 'Cena'}
            </button>
          ))}
        </div>

        {/* Adults stepper */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Cestujících:</span>
          <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-1.5 py-1 bg-white">
            <button type="button" onClick={() => setAdults(a => Math.max(1, a - 1))}
              disabled={adults <= 1}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#008afe] transition-colors disabled:opacity-30">
              <PiUserMinus className="w-3.5 h-3.5" />
            </button>
            <span className="w-5 text-center text-sm font-semibold text-gray-800 select-none">{adults}</span>
            <button type="button" onClick={() => setAdults(a => Math.min(6, a + 1))}
              disabled={adults >= 6}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#008afe] transition-colors disabled:opacity-30">
              <PiUserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* City filter */}
      {availableCities.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap w-full mt-2">
          <span className="text-sm text-gray-500 flex-shrink-0">Odlet z:</span>
          <div className="flex gap-1.5 flex-wrap">
            {availableCities.map(city => (
              <button key={city} type="button"
                onClick={() => setCityFilter(p => p.includes(city) ? p.filter(x => x !== city) : [...p, city])}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-xl border transition-all ${
                  cityFilter.includes(city)
                    ? 'bg-[#008afe] text-white border-[#008afe]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#008afe]'
                }`}>
                <Plane className="w-3 h-3" />
                {city}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2.5">
        {filtered.map(tour => (
          <a key={tour.id} href={bookingUrl(slug, tour, adults)} target="_blank" rel="noopener noreferrer"
            className="block group bg-white border border-gray-100 hover:border-[#008afe]/30 rounded-2xl p-4 transition-all hover:shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-900">{formatDate(tour.departure_date)}</span>
                </div>
                {tour.duration && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Moon className="w-3.5 h-3.5 text-gray-400" />
                    {tour.duration} nocí
                  </div>
                )}
                {tour.meal_plan && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Utensils className="w-3.5 h-3.5 text-gray-400" />
                    {tour.meal_plan}
                  </div>
                )}
                {tour.transport && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Plane className="w-3.5 h-3.5 text-gray-400" />
                    {tour.transport}
                  </div>
                )}
                {tour.departure_city && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#008afe] bg-[#008afe]/8 px-2 py-0.5 rounded-lg">
                    <Plane className="w-3 h-3" />
                    {tour.departure_city}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-emerald-600">{formatPrice(tour.price)}</span>
                    <span className="text-xs text-gray-400">/ os.</span>
                  </div>
                  {adults > 1 && (
                    <p className="text-[11px] text-gray-400">celkem {formatPrice(tour.price * adults)}</p>
                  )}
                </div>
                <span className="hidden sm:flex items-center gap-1 text-sm font-medium text-white bg-[#008afe] hover:bg-[#0079e5] px-4 py-2 rounded-xl transition-colors">
                  Rezervovat <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      <p className="text-[11px] text-gray-400 mt-3">
        * Ceny jsou orientační a pochází z pravidelného stahování dat. Aktuální cena bude upřesněna na webu cestovní kanceláře.
      </p>
    </div>
  )
}
