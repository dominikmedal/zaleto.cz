'use client'
import { useEffect, useState } from 'react'
import { Calendar, Plane, Moon, Utensils, ExternalLink, X } from 'lucide-react'
import { PiUserMinus, PiUserPlus } from 'react-icons/pi'
import type { Tour } from '@/lib/types'
import { API } from '@/lib/api'

function formatPrice(p: number) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(p)
}

function formatDateShort(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })
}

function bookingUrl(slug: string, tour: Tour, adults: number) {
  const params = new URLSearchParams({
    date:   tour.departure_date || '',
    nights: String(tour.duration || 7),
    adults: String(adults),
  })
  if (tour.url) params.set('tour_url', tour.url)
  return `${API}/api/redirect/${slug}?${params}`
}

function parseRoute(transport: string | null): { dep: string; arr: string } | null {
  if (!transport) return null
  const m = transport.match(/([A-Z]{3})[→>-]([A-Z]{3})/)
  if (!m) return null
  return { dep: m[1], arr: m[2] }
}

const IATA_CITIES: Record<string, string> = {
  PRG: 'Praha', BRQ: 'Brno', OSR: 'Ostrava', PED: 'Pardubice',
  AYT: 'Antalya', DLM: 'Dalaman', BJV: 'Bodrum', ADB: 'İzmir',
  HRG: 'Hurghada', SSH: 'Sharm el-Sheikh', CAI: 'Káhira',
  RHO: 'Rhodos', HER: 'Kréta', CFU: 'Korfu', ZTH: 'Zakynthos', KGS: 'Kos',
  ACE: 'Lanzarote', TFS: 'Tenerife', LPA: 'Gran Canaria', FUE: 'Fuerteventura',
  PMI: 'Mallorca', AGP: 'Málaga', ALC: 'Alicante', BCN: 'Barcelona',
  SOF: 'Sofia', VAR: 'Varna', BOJ: 'Burgas',
  PFO: 'Paphos', LCA: 'Larnaka',
  TUN: 'Tunis', DJE: 'Djerba',
  OPO: 'Porto', FNC: 'Funchal', FAO: 'Faro',
  MLE: 'Malé', DPS: 'Bali', BKK: 'Bangkok', CMB: 'Colombo',
  DXB: 'Dubaj', AUH: 'Abú Dhabí',
  ZNZ: 'Zanzibar', HAV: 'Havana', CUN: 'Cancún',
}

const CITY_TO_IATA: Record<string, string> = Object.fromEntries(
  Object.entries(IATA_CITIES).map(([code, city]) => [city, code])
)

function TourTicket({ tour, slug, adults }: { tour: Tour; slug: string; adults: number }) {
  const route = parseRoute(tour.transport)
  const depIata = CITY_TO_IATA[tour.departure_city ?? ''] ?? route?.dep ?? null
  const arrIata = route?.arr ?? null
  const depCityName = depIata ? (IATA_CITIES[depIata] ?? tour.departure_city) : (tour.departure_city ?? null)
  const arrCity = arrIata ? (IATA_CITIES[arrIata] ?? arrIata) : null

  return (
    <a href={bookingUrl(slug, tour, adults)} target="_blank" rel="noopener noreferrer" className="block group">
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all group-hover:border-[#008afe]/30 group-hover:shadow-md">

        {/* Horní část: trasa */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 min-w-[52px]">
              {depIata ? (
                <>
                  <div className="text-[22px] font-bold text-gray-900 leading-none">{depIata}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">{depCityName}</div>
                </>
              ) : (
                <div className="text-xs text-gray-400">{depCityName ?? '—'}</div>
              )}
            </div>
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <div className="flex-1 border-t border-dashed border-gray-200" />
              <Plane className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <div className="flex-1 border-t border-dashed border-gray-200" />
            </div>
            <div className="flex-shrink-0 min-w-[52px] text-right">
              {arrIata ? (
                <>
                  <div className="text-[22px] font-bold text-gray-900 leading-none">{arrIata}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">{arrCity}</div>
                </>
              ) : tour.transport ? (
                <div className="text-xs text-gray-400">{tour.transport}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Tear line */}
        <div className="relative flex items-center mx-0">
          <div className="absolute -left-2.5 w-5 h-5 rounded-full bg-gray-50 border border-gray-100 flex-shrink-0 z-10" />
          <div className="flex-1 border-t border-dashed border-gray-200 mx-2.5" />
          <div className="absolute -right-2.5 w-5 h-5 rounded-full bg-gray-50 border border-gray-100 flex-shrink-0 z-10" />
        </div>

        {/* Dolní část: datum, detaily, cena */}
        <div className="px-5 pt-3 pb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span className="flex items-center gap-1.5 font-medium text-gray-800">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {formatDateShort(tour.departure_date)}
            </span>
            {tour.duration && (
              <span className="flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-gray-400" />
                {tour.duration} nocí
              </span>
            )}
            {tour.meal_plan && (
              <span className="flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-gray-400" />
                {tour.meal_plan}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            <div className="text-right">
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-lg font-bold text-emerald-600">{formatPrice(tour.price)}</span>
                <span className="text-xs text-gray-400">/ os.</span>
              </div>
              {adults > 1 && (
                <p className="text-[11px] text-gray-400">celkem {formatPrice(tour.price * adults)}</p>
              )}
            </div>
            <span className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-white bg-[#008afe] group-hover:bg-[#0079e5] px-4 py-2 rounded-xl transition-colors">
              Rezervovat <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

      </div>
    </a>
  )
}

interface Props {
  slug: string
  name: string
  onClose: () => void
}

export default function ToursModal({ slug, name, onClose }: Props) {
  const [tours,      setTours]      = useState<Tour[]>([])
  const [loading,    setLoading]    = useState(true)
  const [sortBy,     setSortBy]     = useState<'date_asc' | 'price_asc'>('date_asc')
  const [adults,     setAdults]     = useState(2)
  const [cityFilter, setCityFilter] = useState<string[]>([])

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

  const availableCities = Array.from(new Set(tours.map(t => t.departure_city).filter(Boolean) as string[]))

  const sorted = [...tours].sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price
    return (a.departure_date || '').localeCompare(b.departure_date || '')
  })

  const filtered = cityFilter.length > 0 ? sorted.filter(t => cityFilter.includes(t.departure_city || '')) : sorted

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
          {availableCities.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap w-full">
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
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[108px] bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Žádné dostupné termíny</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(tour => (
                <TourTicket key={tour.id} tour={tour} slug={slug} adults={adults} />
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
