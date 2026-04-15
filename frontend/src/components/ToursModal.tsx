'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Plane, Moon, Utensils, ExternalLink, X, Loader2 } from 'lucide-react'
import { PiCalendarBlank, PiUserMinus, PiUserPlus, PiArrowsDownUp, PiTag, PiX, PiCalendarStar } from 'react-icons/pi'
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

function formatDateMini(s: string) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
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
    <a
      href={bookingUrl(slug, tour, adults)}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div
        className="rounded-2xl overflow-hidden transition-all duration-200 group-hover:shadow-[0_6px_24px_rgba(0,147,255,0.14)] group-hover:-translate-y-px"
        style={{
          background: 'rgba(255,255,255,0.70)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(200,227,255,0.60)',
          boxShadow: '0 1px 6px rgba(0,147,255,0.06), inset 0 1px 0 rgba(255,255,255,0.90)',
        }}
      >
        {/* Route */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 min-w-[52px]">
              {depIata ? (
                <>
                  <div className="text-[22px] font-black text-gray-900 leading-none tracking-tight">{depIata}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">{depCityName}</div>
                </>
              ) : (
                <div className="text-xs text-gray-400">{depCityName ?? '—'}</div>
              )}
            </div>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div className="flex-1 border-t border-dashed" style={{ borderColor: 'rgba(0,147,255,0.20)' }} />
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,147,255,0.08)' }}>
                <Plane className="w-3 h-3 text-[#0093FF]" />
              </div>
              <div className="flex-1 border-t border-dashed" style={{ borderColor: 'rgba(0,147,255,0.20)' }} />
            </div>
            <div className="flex-shrink-0 min-w-[52px] text-right">
              {arrIata ? (
                <>
                  <div className="text-[22px] font-black text-gray-900 leading-none tracking-tight">{arrIata}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">{arrCity}</div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Tear line */}
        <div className="relative flex items-center mx-1">
          <div className="absolute -left-3 w-4 h-4 rounded-full z-10" style={{ background: 'rgba(236,238,242,0.95)' }} />
          <div className="flex-1 border-t border-dashed mx-2" style={{ borderColor: 'rgba(0,147,255,0.15)' }} />
          <div className="absolute -right-3 w-4 h-4 rounded-full z-10" style={{ background: 'rgba(236,238,242,0.95)' }} />
        </div>

        {/* Date + price */}
        <div className="px-4 pt-3 pb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-800">
              <PiCalendarBlank className="w-3.5 h-3.5 text-[#0093FF] flex-shrink-0" />
              {formatDateShort(tour.departure_date)}
              {tour.return_date && (
                <>
                  <span className="text-gray-300 mx-0.5">→</span>
                  <span className="font-normal text-gray-600">{formatDateShort(tour.return_date)}</span>
                </>
              )}
            </span>
            {tour.duration && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Moon className="w-3 h-3 text-gray-400" />{tour.duration} nocí
              </span>
            )}
            {tour.meal_plan && (
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Utensils className="w-3 h-3 text-gray-400" />{tour.meal_plan}
              </span>
            )}
            {tour.agency && (
              <span className="text-[10px] font-medium text-[#0093FF] px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0,147,255,0.07)' }}>
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
            <span className="hidden sm:flex btn-cta" style={{ padding: '7px 14px', fontSize: 12 }}>
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

const STORAGE_KEY = 'zaleto-filters'

export default function ToursModal({ slug, name, onClose }: Props) {
  const [allTours,      setAllTours]      = useState<Tour[]>([])
  const [loading,       setLoading]       = useState(true)
  const [sortBy,        setSortBy]        = useState<'date_asc' | 'price_asc'>('date_asc')
  const [adults,        setAdults]        = useState(2)
  const [cityFilter,    setCityFilter]    = useState<string[]>([])
  const [page,          setPage]          = useState(1)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrollRef   = useRef<HTMLDivElement>(null)

  // Read date filter from sessionStorage (set by HeaderFilterBar, valid on all pages)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) {
        const p = new URLSearchParams(saved)
        setFilterDateFrom(p.get('date_from') || '')
        setFilterDateTo(p.get('date_to')   || '')
      }
    } catch {}
  }, [])

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

  useEffect(() => {
    setPage(1)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [sortBy, cityFilter])

  const availableCities = Array.from(new Set(allTours.map(t => t.departure_city).filter(Boolean) as string[]))

  const dateActive = !!(filterDateFrom || filterDateTo)

  const filtered = allTours.filter(t => {
    if (cityFilter.length > 0 && !cityFilter.includes(t.departure_city || '')) return false
    if (dateActive && t.departure_date) {
      if (filterDateFrom && t.departure_date < filterDateFrom) return false
      if (filterDateTo   && t.departure_date > filterDateTo)   return false
    }
    return true
  })

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = filtered.length > visible.length

  const loadMore = useCallback(() => {
    if (hasMore) setPage(p => p + 1)
  }, [hasMore])

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

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const tourLabel = (n: number) => n === 1 ? 'dostupný termín' : n < 5 ? 'dostupné termíny' : 'dostupných termínů'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(10,20,40,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl flex flex-col max-h-[90dvh] sm:max-h-[85dvh] overflow-hidden"
        style={{
          background: 'rgba(245,248,255,0.96)',
          backdropFilter: 'blur(32px) saturate(160%)',
          WebkitBackdropFilter: 'blur(32px) saturate(160%)',
          border: '1px solid rgba(200,227,255,0.70)',
          boxShadow: '0 32px 80px rgba(0,80,200,0.18), 0 2px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,147,255,0.08)' }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-[#0093FF] uppercase tracking-[0.14em] mb-1">Termíny zájezdů</p>
            <h2
              className="font-bold text-gray-900 leading-snug truncate"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(16px, 2vw, 20px)' }}
            >
              {name}
            </h2>
            <p className="text-[12px] text-gray-400 mt-1 h-4">
              {loading
                ? <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin text-[#0093FF]" /> Načítám termíny…</span>
                : filtered.length !== allTours.length
                ? <>{filtered.length} z {allTours.length} {tourLabel(allTours.length)}</>
                : <>{allTours.length} {tourLabel(allTours.length)}</>
              }
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: 'rgba(0,147,255,0.06)', color: '#0093FF' }}
          >
            <PiX className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div
          className="flex items-center gap-3 px-5 py-3 flex-shrink-0 flex-wrap"
          style={{ borderBottom: '1px solid rgba(0,147,255,0.08)', background: 'rgba(237,246,255,0.40)' }}
        >
          {/* Sort toggle */}
          <div className="inline-flex items-center glass-pill rounded-xl p-0.5 gap-0.5">
            {(['date_asc', 'price_asc'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  sortBy === opt
                    ? 'bg-white text-[#0093FF] shadow-[0_1px_6px_rgba(0,147,255,0.15)] border border-[#C8E3FF]'
                    : 'text-gray-500 hover:text-[#0093FF] hover:bg-white/60'
                }`}
              >
                <PiArrowsDownUp className="w-3 h-3" />
                {opt === 'date_asc' ? 'Datum' : 'Cena'}
              </button>
            ))}
          </div>

          {/* Adults */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAdults(a => Math.max(1, a - 1))}
              disabled={adults <= 1}
              className="w-6 h-6 flex items-center justify-center rounded-full transition-colors disabled:opacity-30"
              style={{ background: 'rgba(0,147,255,0.08)', color: '#0093FF' }}
            >
              <PiUserMinus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-semibold text-gray-800 select-none tabular-nums w-10 text-center">{adults} os.</span>
            <button
              type="button"
              onClick={() => setAdults(a => Math.min(6, a + 1))}
              disabled={adults >= 6}
              className="w-6 h-6 flex items-center justify-center rounded-full transition-colors disabled:opacity-30"
              style={{ background: 'rgba(0,147,255,0.08)', color: '#0093FF' }}
            >
              <PiUserPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Active date filter badge */}
          {dateActive && !loading && (
            <span
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
                color: '#fff',
                border: '1px solid rgba(0,147,255,0.50)',
                boxShadow: '0 2px 6px rgba(0,147,255,0.22)',
              }}
            >
              <PiCalendarBlank className="w-3 h-3 flex-shrink-0" />
              <span>
                {filterDateFrom && filterDateTo
                  ? `${formatDateMini(filterDateFrom)} – ${formatDateMini(filterDateTo)}`
                  : filterDateFrom ? `od ${formatDateMini(filterDateFrom)}`
                  : `do ${formatDateMini(filterDateTo)}`}
              </span>
              <button
                type="button"
                aria-label="Zrušit filtr datumu"
                onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
                className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-white/25 transition-colors ml-0.5"
              >
                <PiX className="w-2.5 h-2.5" />
              </button>
            </span>
          )}

          {/* City filters */}
          {availableCities.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {availableCities.map(city => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setCityFilter(p => p.includes(city) ? p.filter(x => x !== city) : [...p, city])}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                    cityFilter.includes(city)
                      ? 'text-white border-[#0093FF]'
                      : 'text-gray-600 hover:text-[#0093FF]'
                  }`}
                  style={cityFilter.includes(city)
                    ? { background: 'linear-gradient(135deg, #0093FF, #0070E0)', boxShadow: '0 2px 8px rgba(0,147,255,0.28)' }
                    : { background: 'rgba(237,246,255,0.72)', borderColor: 'rgba(200,227,255,0.65)' }
                  }
                >
                  <Plane className="w-3 h-3" />
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable list */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[110px] rounded-2xl animate-pulse" style={{ background: 'rgba(0,147,255,0.05)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <PiCalendarBlank className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(0,147,255,0.25)' }} />
              <p className="text-gray-500 font-medium">
                {dateActive && allTours.length > 0 ? 'Žádné termíny ve zvoleném období' : 'Žádné dostupné termíny'}
              </p>
              {dateActive && allTours.length > 0 && (
                <button type="button" onClick={() => { setFilterDateFrom(''); setFilterDateTo('') }}
                  className="mt-2 text-sm text-[#0093FF] hover:underline">Zobrazit všechny termíny</button>
              )}
              {cityFilter.length > 0 && (
                <button type="button" onClick={() => setCityFilter([])}
                  className="mt-2 text-sm text-[#0093FF] hover:underline block mx-auto">Zrušit filtr letiště</button>
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
                  <Loader2 className="w-5 h-5 text-[#0093FF] animate-spin" />
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
