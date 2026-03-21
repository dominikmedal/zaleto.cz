'use client'
import { useEffect, useState } from 'react'
import { Calendar, Plane, Moon, Utensils, ExternalLink, X } from 'lucide-react'
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

interface Props {
  slug: string
  name: string
  onClose: () => void
}

export default function ToursModal({ slug, name, onClose }: Props) {
  const [tours,   setTours]   = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy,  setSortBy]  = useState<'date_asc' | 'price_asc'>('date_asc')
  const [adults,  setAdults]  = useState(2)

  useEffect(() => {
    fetch(`${API}/api/hotels/${slug}/tours`)
      .then(r => r.json())
      .then(data => setTours(Array.isArray(data?.tours) ? data.tours : Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [slug])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const sorted = [...tours].sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price
    return (a.departure_date || '').localeCompare(b.departure_date || '')
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85dvh]">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 text-base leading-snug truncate">{name}</h2>
            {!loading && (
              <p className="text-sm text-gray-400 mt-0.5">
                {tours.length} {tours.length === 1 ? 'dostupný termín' : tours.length < 5 ? 'dostupné termíny' : 'dostupných termínů'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-100 flex-shrink-0 flex-wrap">
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Cestujících:</span>
            <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-1.5 py-1 bg-white">
              <button type="button" onClick={() => setAdults(a => Math.max(1, a - 1))} disabled={adults <= 1}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#008afe] transition-colors disabled:opacity-30">
                <PiUserMinus className="w-3.5 h-3.5" />
              </button>
              <span className="w-5 text-center text-sm font-semibold text-gray-800 select-none">{adults}</span>
              <button type="button" onClick={() => setAdults(a => Math.min(6, a + 1))} disabled={adults >= 6}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#008afe] transition-colors disabled:opacity-30">
                <PiUserPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Žádné dostupné termíny</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sorted.map(tour => (
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
          )}
          <p className="text-[11px] text-gray-400 mt-3">
            * Ceny jsou orientační a pochází z pravidelného stahování dat. Aktuální cena bude upřesněna na webu cestovní kanceláře.
          </p>
        </div>
      </div>
    </div>
  )
}
