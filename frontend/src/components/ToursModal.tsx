'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Calendar, Plane, Moon, Utensils, ExternalLink, X, Loader2 } from 'lucide-react'
import { PiUserMinus, PiUserPlus } from 'react-icons/pi'
import type { Tour } from '@/lib/types'
import { API } from '@/lib/api'

const PAGE_SIZE = 20

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

        {/* Trasa */}
        <div className="px-4 pt-3.5 pb-2.5">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 min-w-[48px]">
              {depIata ? (
                <>
                  <div className="text-[20px] font-bold text-gray-900 leading-none">{depIata}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">{depCityName}</div>
                </>
              ) : (
                <div className="text-xs text-gray-400">{depCityName ?? '—'}</div>
              )}
            </div>
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <div className="flex-1 border-t border-dashed border-gray-200" />
              <Plane className="w-3 h-3 text-gray-300 flex-shrink-0" />
              <div className="flex-1 border-t border-dashed border-gray-200" />
            </div>
            <div className="flex-shrink-0 min-w-[48px] text-right">
              {arrIata ? (
                <>
                  <div className="text-[20px] font-bold text-gray-900 leading-none">{arrIata}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">{arrCity}</div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Tear line */}
        <div className="relative flex items-center">
          <div className="absolute -left-2.5 w-4 h-4 rounded-full bg-gray-50 border border-gray-100 z-10" />
          <div className="flex-1 border-t border-dashed border-gray-200 mx-2" />
          <div className="absolute -right-2.5 w-4 h-4 rounded-full bg-gray-50 border border-gray-100 z-10" />
        </div>

        {/* Datum + cena */}
        <div className="px-4 pt-2.5 pb-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {formatDateShort(tour.departure_date)}
            </span>
            {tour.duration && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Moon className="w-3 h-3 text-gray-400" />{tour.duration} nocí
              </span>
            )}
            {tour.meal_plan && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Utensils className="w-3 h-3 text-gray-400" />{tour.meal_plan}
              </span>
            )}
            {tour.agency && (
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
                {tour.agency}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0 ml-auto">
            <div className="text-right">
              <div className="flex items-baseline gap-0.5 justify-end">
                <span className="text-base font-bold text-emerald-600">{formatPrice(tour.price)}</span>
                <span className="text-[11px] text-gray-400">/ os.</span>
              </div>
              {adults > 1 && (
                <p className="text-[10px] text-gray-400">celkem {formatPrice(tour.price * adults)}</p>
              )}
            </div>
            <span className="hidden sm:flex items-center gap-1 text-xs font-semibold text-white bg-[#008afe] group-hover:bg-[#0079e5] px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
              Rezervovat <ExternalLink className="w-3 h-3" />
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
  const [allTours,   setAllTours]   = useState<Tour[]>([])
  const [loading,    setLoading]    = useState(true)
  const [sortBy,     setSortBy]     = useState<'date_asc' | 'price_asc'>('date_asc')
  const [adults,     setAdults]     = useState(2)
  const [cityFilter, setCityFilter] = useState<string[]>([])
  const [page,       setPage]       = useState(1)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollRef   = useRef<HTMLDivElement>(null)

  // Načte vše jednou — backend je optimalizovaný (hotel_ids bez subquery, select jen potřebné sloupce)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    setLoading(true)
    fetch(`${API}/api/hotels/${slug}/tours?sort=${sortBy}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        setAllTours(Array.isArray(data?.tours) ? data.tours : Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setLoading(false) })
    return () => { controller.abort(); clearTimeout(timer) }
  }, [slug, sortBy])

  // Reset stránky při změně sortBy nebo filtru, scroll nahoru
  useEffect(() => {
    setPage(1)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [sortBy, cityFilter])

  const availableCities = Array.from(new Set(allTours.map(t => t.departure_city).filter(Boolean) as string[]))

  const filtered = cityFilter.length > 0
    ? allTours.filter(t => cityFilter.includes(t.departure_city || ''))
    : allTours

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = filtered.length > visible.length

  const loadMore = useCallback(() => {
    if (hasMore) setPage(p => p + 1)
  }, [hasMore])

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { root: scrollRef.current, rootMargin: '200px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  // Zavřít na Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

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
            <p className="text-sm text-gray-400 mt-0.5 h-5">
              {loading
                ? <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin text-[#008afe]" /> Načítám termíny…</span>
                : <>{filtered.length !== allTours.length ? `${filtered.length} / ` : ''}{allTours.length} {allTours.length === 1 ? 'dostupný termín' : allTours.length < 5 ? 'dostupné termíny' : 'dostupných termínů'}</>
              }
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0 flex-wrap">
          {/* Řadit */}
          <div className="inline-flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5">
            {(['date_asc', 'price_asc'] as const).map(opt => (
              <button key={opt} onClick={() => setSortBy(opt)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  sortBy === opt ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {opt === 'date_asc' ? '↑ Datum' : '↑ Cena'}
              </button>
            ))}
          </div>

          {/* Cestujících */}
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setAdults(a => Math.max(1, a - 1))} disabled={adults <= 1}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-[#008afe] transition-colors disabled:opacity-30">
              <PiUserMinus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-semibold text-gray-800 select-none tabular-nums w-10 text-center">{adults} os.</span>
            <button type="button" onClick={() => setAdults(a => Math.min(6, a + 1))} disabled={adults >= 6}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-[#008afe] transition-colors disabled:opacity-30">
              <PiUserPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Odletová města */}
          {availableCities.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {availableCities.map(city => (
                <button key={city} type="button"
                  onClick={() => setCityFilter(p => p.includes(city) ? p.filter(x => x !== city) : [...p, city])}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                    cityFilter.includes(city)
                      ? 'bg-[#008afe] text-white border-[#008afe]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#008afe]/50 hover:text-[#008afe]'
                  }`}>
                  <Plane className="w-3 h-3" />
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable list */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[100px] bg-gray-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Žádné dostupné termíny</p>
              {cityFilter.length > 0 && (
                <button type="button" onClick={() => setCityFilter([])}
                  className="mt-2 text-sm text-[#008afe] hover:underline">Zrušit filtr letiště</button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map(tour => (
                <TourTicket key={tour.id} tour={tour} slug={slug} adults={adults} />
              ))}
              <div ref={sentinelRef} className="h-2" />
              {hasMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 text-[#008afe] animate-spin" />
                </div>
              )}
              {!hasMore && visible.length > PAGE_SIZE && (
                <p className="text-center text-xs text-gray-400 py-2">Zobrazeny všechny termíny</p>
              )}
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-3 pb-1">
            * Ceny jsou orientační. Aktuální cena bude upřesněna na webu cestovní kanceláře.
          </p>
        </div>
      </div>
    </div>
  )
}
