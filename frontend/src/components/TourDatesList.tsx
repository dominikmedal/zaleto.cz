'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Calendar, Plane, Moon, Utensils, ExternalLink, Loader2, SlidersHorizontal } from 'lucide-react'
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

// Parsuje "letecky BRQ→AYT" → { dep: 'BRQ', arr: 'AYT' }
function parseRoute(transport: string | null): { dep: string; arr: string } | null {
  if (!transport) return null
  const m = transport.match(/([A-Z]{3})[→>-]([A-Z]{3})/)
  if (!m) return null
  return { dep: m[1], arr: m[2] }
}

// Jméno města podle IATA kódu (jen nejčastější)
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

// Zpětný lookup: název města → IATA kód
const CITY_TO_IATA: Record<string, string> = Object.fromEntries(
  Object.entries(IATA_CITIES).map(([code, city]) => [city, code])
)

function TourTicket({ tour, slug, adults }: { tour: Tour; slug: string; adults: number }) {
  const route = parseRoute(tour.transport)
  // departure_city je authoritative pro odletové letiště — transport může mít špatný kód z API
  const depIata = CITY_TO_IATA[tour.departure_city ?? ''] ?? route?.dep ?? null
  const arrIata = route?.arr ?? null
  const depCityName = depIata ? (IATA_CITIES[depIata] ?? tour.departure_city) : (tour.departure_city ?? null)
  const arrCity = arrIata ? (IATA_CITIES[arrIata] ?? arrIata) : null

  return (
    <a
      href={bookingUrl(slug, tour, adults)}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all group-hover:border-[#008afe]/30 group-hover:shadow-md">

        {/* ── Horní část: trasa ── */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">

            {/* Odlet */}
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

            {/* Šipka s letadlem */}
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <div className="flex-1 border-t border-dashed border-gray-200" />
              <Plane className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              <div className="flex-1 border-t border-dashed border-gray-200" />
            </div>

            {/* Přilet */}
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

        {/* ── Oddělovač (tear line) ── */}
        <div className="relative flex items-center mx-0">
          {/* Levý výřez */}
          <div className="absolute -left-2.5 w-5 h-5 rounded-full bg-gray-50 border border-gray-100 flex-shrink-0 z-10" />
          <div className="flex-1 border-t border-dashed border-gray-200 mx-2.5" />
          {/* Pravý výřez */}
          <div className="absolute -right-2.5 w-5 h-5 rounded-full bg-gray-50 border border-gray-100 flex-shrink-0 z-10" />
        </div>

        {/* ── Dolní část: datum, detaily, cena ── */}
        <div className="px-5 pt-3 pb-4 flex items-center justify-between gap-3 flex-wrap">

          {/* Levá strana: datum + detaily */}
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
            {tour.agency && (
              <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">
                {tour.agency}
              </span>
            )}
          </div>

          {/* Pravá strana: cena + CTA */}
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

function getStoredFilter(key: string, fallback = '') {
  try {
    const saved = sessionStorage.getItem('zaleto-filters')
    if (saved) return new URLSearchParams(saved).get(key) || fallback
  } catch {}
  return fallback
}

export default function TourDatesList({ tours, slug }: { tours: Tour[]; slug: string }) {
  const [sortBy,     setSortBy]     = useState<'date_asc' | 'price_asc'>('date_asc')
  const [adults,     setAdults]     = useState(() => parseInt(getStoredFilter('adults', '2')))
  const [cityFilter, setCityFilter] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('zaleto-filters')
      if (saved) return new URLSearchParams(saved).get('departure_city')?.split(',').filter(Boolean) ?? []
    } catch {}
    return []
  })
  const [dateFrom,   setDateFrom]   = useState(() => getStoredFilter('date_from'))
  const [dateTo,     setDateTo]     = useState(() => getStoredFilter('date_to'))
  const [page,       setPage]       = useState(1)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const availableCities = Array.from(new Set(tours.map(t => t.departure_city).filter(Boolean) as string[]))

  const filtered = [...tours]
    .sort((a, b) =>
      sortBy === 'price_asc'
        ? a.price - b.price
        : (a.departure_date || '').localeCompare(b.departure_date || '')
    )
    .filter(t => {
      if (cityFilter.length > 0 && !cityFilter.includes(t.departure_city || '')) return false
      if (dateFrom && (t.departure_date || '') < dateFrom) return false
      if (dateTo   && (t.departure_date || '') > dateTo)   return false
      return true
    })

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [sortBy, cityFilter, dateFrom, dateTo])

  const visible  = filtered.slice(0, page * PAGE_SIZE)
  const hasMore  = filtered.length > visible.length

  const loadMore = useCallback(() => {
    if (hasMore) setPage(p => p + 1)
  }, [hasMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '300px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  const hasActiveFilters = cityFilter.length > 0 || dateFrom || dateTo

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
      {/* ── Filtry — floating pills, žádný kontejner ── */}
      <div className="flex flex-wrap items-center gap-2 mb-6">

        {/* Seřadit — segmented pill */}
        <div className="inline-flex items-center bg-white border border-gray-100 shadow-sm rounded-full p-0.5 gap-0.5">
          {(['date_asc', 'price_asc'] as const).map(opt => (
            <button key={opt} onClick={() => setSortBy(opt)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                sortBy === opt
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}>
              {opt === 'date_asc' ? '↑ Datum' : '↑ Cena'}
            </button>
          ))}
        </div>

        {/* Cestujících — stepper pill */}
        <div className="inline-flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-full px-3 py-1.5">
          <button type="button" onClick={() => setAdults(a => Math.max(1, a - 1))}
            disabled={adults <= 1}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-[#008afe] transition-colors disabled:opacity-25">
            <PiUserMinus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-semibold text-gray-800 select-none tabular-nums">{adults}&nbsp;os.</span>
          <button type="button" onClick={() => setAdults(a => Math.min(6, a + 1))}
            disabled={adults >= 6}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-[#008afe] transition-colors disabled:opacity-25">
            <PiUserPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Datum odletu — pill s date inputy */}
        <div className="inline-flex items-center gap-1.5 bg-white border border-gray-100 shadow-sm rounded-full px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-xs text-gray-700 bg-transparent focus:outline-none w-[6.8rem]"
          />
          <span className="text-gray-300 text-xs select-none">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-xs text-gray-700 bg-transparent focus:outline-none w-[6.8rem]"
          />
        </div>

        {/* Odletové město — pills (jen pokud > 1 město) */}
        {availableCities.length > 1 && availableCities.map(city => (
          <button key={city} type="button"
            onClick={() => setCityFilter(p => p.includes(city) ? p.filter(x => x !== city) : [...p, city])}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full border shadow-sm transition-all ${
              cityFilter.includes(city)
                ? 'bg-[#008afe] text-white border-[#008afe] shadow-[#008afe]/20'
                : 'bg-white text-gray-600 border-gray-100 hover:border-[#008afe]/40 hover:text-[#008afe]'
            }`}>
            <Plane className="w-3 h-3" />
            {city}
          </button>
        ))}

        {/* Zrušit filtry */}
        {hasActiveFilters && (
          <button type="button"
            onClick={() => { setCityFilter([]); setDateFrom(''); setDateTo('') }}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors underline underline-offset-2 px-1">
            Zrušit
          </button>
        )}

        {/* Počet termínů */}
        <span className="ml-auto text-xs text-gray-400 flex-shrink-0 tabular-nums">
          {filtered.length === tours.length
            ? <>{tours.length} termínů</>
            : <><span className="font-semibold text-gray-700">{filtered.length}</span>/{tours.length}</>
          }
        </span>
      </div>

      {/* Prázdný stav po filtraci */}
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <SlidersHorizontal className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-gray-600 font-medium text-sm">Žádné termíny neodpovídají filtrům</p>
          <button type="button" onClick={() => { setCityFilter([]); setDateFrom(''); setDateTo('') }}
            className="mt-2 text-sm text-[#008afe] hover:underline">
            Zrušit filtry
          </button>
        </div>
      )}

      {/* Tickety */}
      <div className="space-y-3">
        {visible.map(tour => (
          <TourTicket key={tour.id} tour={tour} slug={slug} adults={adults} />
        ))}
      </div>

      {/* Scroll sentinel + loader */}
      <div ref={sentinelRef} className="h-4 mt-4" />
      {hasMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-[#008afe] animate-spin" />
        </div>
      )}
      {!hasMore && visible.length > PAGE_SIZE && (
        <p className="text-center text-xs text-gray-400 py-4">Zobrazeny všechny termíny</p>
      )}

      <p className="text-[11px] text-gray-400 mt-2">
        * Ceny jsou orientační a pochází z pravidelného stahování dat. Aktuální cena bude upřesněna na webu cestovní kanceláře.
      </p>
    </div>
  )
}
