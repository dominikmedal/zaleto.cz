'use client'
import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { PiCaretDown, PiSliders, PiUserMinus, PiUserPlus, PiTimer, PiCalendarStar, PiSpinner, PiX, PiMagnifyingGlass } from 'react-icons/pi'
import { API } from '@/lib/api'
import DestinationAutocomplete from './DestinationAutocomplete'
import DateRangePicker from './DateRangePicker'

interface DestRow { country: string; destination: string; resort_town: string | null; hotel_count: number }
interface FilterMeta {
  mealPlans: { meal_plan: string; count: number }[]
  durations: { duration: number; count: number }[]
  stars: { stars: number; count: number }[]
  transports: { transport: string; count: number }[]
  departureCities: { departure_city: string; count: number }[]
  priceRange: { min: number; max: number }
}

const PLACEHOLDER_CYCLE = [
  'Kam chcete letět?',
  'Zkuste Egypt…',
  'Zkuste Řecko…',
  'Zadejte název hotelu…',
  'Zkuste Turecko…',
  'Zkuste Španělsko…',
  'Zkuste Chorvatsko…',
  'Zkuste Thajsko…',
  'Zkuste Maledivy…',
  'Zkuste Dubaj…',
  'Zkuste Tunisko…',
]

const SORT_OPTIONS = [
  { value: 'price_asc',  label: 'Cena: nejlevnější' },
  { value: 'price_desc', label: 'Cena: nejdražší' },
  { value: 'stars_desc', label: 'Hvězdičky' },
  { value: 'name_asc',   label: 'Název A–Z' },
]

const MEAL_LABELS: Record<string, string> = {
  'All inclusive': 'All inclusive', 'Ultra All inclusive': 'Ultra All incl.',
  'Plná penze': 'Plná penze', 'Polopenze': 'Polopenze',
  'Snídaně': 'Snídaně', 'Bez stravy': 'Bez stravy',
}

const STORAGE_KEY = 'zaleto-filters'

function formatDateShort(s: string): string {
  if (!s) return ''
  const d = new Date(s + 'T00:00:00')
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}

function PillToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
        active ? 'bg-[#008afe] text-white border-[#008afe]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#008afe]/50 hover:text-[#008afe]'
      }`}>
      {children}
    </button>
  )
}

function parseParams(raw: string) {
  const p = new URLSearchParams(raw)
  return {
    destination: p.get('destination')?.split(',').filter(Boolean) ?? [],
    dateFrom:    p.get('date_from')  || '',
    dateTo:      p.get('date_to')    || '',
    adults:      parseInt(p.get('adults') || '2'),
    sort:        p.get('sort')       || 'price_asc',
    duration:    p.get('duration')   || '',
    minPrice:    p.get('min_price')  || '',
    maxPrice:    p.get('max_price')  || '',
    stars:       p.get('stars')?.split(',').filter(Boolean) ?? [],
    mealPlan:    p.get('meal_plan')?.split(',').filter(Boolean) ?? [],
    transport:   p.get('transport')  || '',
    tourType:    p.get('tour_type')  || '',
    depCity:     p.get('departure_city')?.split(',').filter(Boolean) ?? [],
  }
}

const microLabel = 'text-[10px] font-bold text-gray-900 leading-none'
const subLabel   = 'text-xs leading-none mt-0.5'

export default function HeaderFilterBar() {
  const sp       = useSearchParams()
  const pathname = usePathname()
  const router   = useRouter()
  const [isPending, startTransition] = useTransition()

  const isHome = pathname === '/'

  // ── Initial state: from URL (home page) or sessionStorage (hotel pages) ───
  const getInitialState = () => {
    if (isHome) return parseParams(sp.toString())
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) return parseParams(saved)
    } catch {}
    return parseParams('')
  }

  const init = getInitialState()

  const [destination, setDestination] = useState<string[]>(init.destination)
  const [dateFrom,    setDateFrom]    = useState(init.dateFrom)
  const [dateTo,      setDateTo]      = useState(init.dateTo)
  const [adults,      setAdults]      = useState(init.adults)
  const [sort,        setSort]        = useState(init.sort)
  const [duration,    setDuration]    = useState(init.duration)
  const [minPrice,    setMinPrice]    = useState(init.minPrice)
  const [maxPrice,    setMaxPrice]    = useState(init.maxPrice)
  const [stars,       setStars]       = useState<string[]>(init.stars)
  const [mealPlan,    setMealPlan]    = useState<string[]>(init.mealPlan)
  const [transport,   setTransport]   = useState(init.transport)
  const [tourType,    setTourType]    = useState(init.tourType)
  const [depCity,     setDepCity]     = useState<string[]>(init.depCity)

  const initialStateKey = JSON.stringify(init)

  // UI state
  const [activePanel,     setActivePanel]     = useState<'dest' | 'date' | 'adv' | null>(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [destRows,        setDestRows]        = useState<DestRow[]>([])
  const [destLoaded,      setDestLoaded]      = useState(false)
  const [meta,            setMeta]            = useState<FilterMeta | null>(null)
  const [metaError,       setMetaError]       = useState(false)

  // Animated cycling placeholder for empty destination field
  const [phIdx,     setPhIdx]     = useState(0)
  const [phVisible, setPhVisible] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)

  // ── Cycling placeholder when destination is empty ─────────────────────────
  useEffect(() => {
    if (destination.length > 0 || activePanel === 'dest') return
    const id = setInterval(() => {
      setPhVisible(false)
      setTimeout(() => {
        setPhIdx(i => (i + 1) % PLACEHOLDER_CYCLE.length)
        setPhVisible(true)
      }, 280)
    }, 2600)
    return () => clearInterval(id)
  }, [destination.length, activePanel])

  // ── Build params helper ────────────────────────────────────────────────────
  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (destination.length)   params.set('destination',    destination.join(','))
    if (dateFrom)             params.set('date_from',       dateFrom)
    if (dateTo)               params.set('date_to',         dateTo)
    if (adults !== 2)         params.set('adults',          String(adults))
    if (sort !== 'price_asc') params.set('sort',            sort)
    if (duration)             params.set('duration',        duration)
    if (minPrice)             params.set('min_price',       minPrice)
    if (maxPrice)             params.set('max_price',       maxPrice)
    if (stars.length)         params.set('stars',           stars.join(','))
    if (mealPlan.length)      params.set('meal_plan',       mealPlan.join(','))
    if (transport)            params.set('transport',       transport)
    if (tourType)             params.set('tour_type',       tourType)
    if (depCity.length)       params.set('departure_city',  depCity.join(','))
    return params
  }, [destination, dateFrom, dateTo, adults, sort, duration, minPrice, maxPrice, stars, mealPlan, transport, tourType, depCity])

  // ── Sync from URL when on home page ───────────────────────────────────────
  const lastPushedKey = useRef<string>(initialStateKey)

  useEffect(() => {
    if (!isHome) return
    const next = parseParams(sp.toString())
    setDestination(next.destination)
    setDateFrom(next.dateFrom)
    setDateTo(next.dateTo)
    setAdults(next.adults)
    setSort(next.sort)
    setDuration(next.duration)
    setMinPrice(next.minPrice)
    setMaxPrice(next.maxPrice)
    setStars(next.stars)
    setMealPlan(next.mealPlan)
    setTransport(next.transport)
    setTourType(next.tourType)
    setDepCity(next.depCity)
    lastPushedKey.current = JSON.stringify(next)
    // Save to sessionStorage so hotel pages can display them
    try { sessionStorage.setItem(STORAGE_KEY, sp.toString()) } catch {}
  }, [sp, isHome]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restore from sessionStorage when arriving on a non-home page ──────────
  useEffect(() => {
    if (isHome) return
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const s = parseParams(saved)
      setDestination(s.destination)
      setDateFrom(s.dateFrom)
      setDateTo(s.dateTo)
      setAdults(s.adults)
      setSort(s.sort)
      setDuration(s.duration)
      setMinPrice(s.minPrice)
      setMaxPrice(s.maxPrice)
      setStars(s.stars)
      setMealPlan(s.mealPlan)
      setTransport(s.transport)
      setTourType(s.tourType)
      setDepCity(s.depCity)
    } catch {}
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-navigate on any filter change (debounced 350ms) ─────────────────
  const stateKey = JSON.stringify({ destination, dateFrom, dateTo, adults, sort, duration, minPrice, maxPrice, stars, mealPlan, transport, tourType, depCity })

  useEffect(() => {
    if (stateKey === lastPushedKey.current) return
    lastPushedKey.current = stateKey
    const params = buildParams()
    const qs = params.toString()
    // Save to sessionStorage immediately
    try { sessionStorage.setItem(STORAGE_KEY, qs) } catch {}
    const timer = setTimeout(() => {
      startTransition(() => router.push(`/?${qs}`))
    }, 350)
    return () => clearTimeout(timer)
  }, [stateKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDest = useCallback(async () => {
    if (destLoaded) return
    try {
      const res = await fetch(`${API}/api/destinations`)
      if (res.ok) { setDestRows(await res.json()); setDestLoaded(true) }
    } catch {}
  }, [destLoaded])

  const loadMeta = useCallback(async () => {
    if (meta) return
    setMetaError(false)
    try {
      const res = await fetch(`${API}/api/filters`)   // ← correct endpoint
      if (res.ok) {
        setMeta(await res.json())
      } else {
        setMetaError(true)
      }
    } catch {
      setMetaError(true)
    }
  }, [meta])

  // Pre-fetch destinations on mount so they're ready when user clicks
  useEffect(() => { loadDest() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openPanel = useCallback((panel: 'dest' | 'date' | 'adv') => {
    setActivePanel(p => p === panel ? null : panel)
    if (panel === 'dest') loadDest()
    if (panel === 'adv')  loadMeta()
  }, [loadDest, loadMeta])

  const openMobileSheet = useCallback(() => {
    setActivePanel(null)
    setMobileSheetOpen(true)
    loadDest()
    loadMeta()
  }, [loadDest, loadMeta])

  // Body scroll lock when mobile sheet is open
  useEffect(() => {
    if (mobileSheetOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileSheetOpen])

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setActivePanel(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const advancedCount = [duration, minPrice, maxPrice, transport, tourType].filter(Boolean).length
    + stars.length + mealPlan.length + depCity.length

  const mobileFilterCount = (dateFrom || dateTo ? 1 : 0) + (adults !== 2 ? 1 : 0) + advancedCount

  const dateSummary = dateFrom && dateTo
    ? `${formatDateShort(dateFrom)} – ${formatDateShort(dateTo)}`
    : dateFrom ? `od ${formatDateShort(dateFrom)}`
    : dateTo   ? `do ${formatDateShort(dateTo)}`
    : ''

  const destSummary = destination.length > 0
    ? destination.slice(0, 2).join(', ') + (destination.length > 2 ? ` +${destination.length - 2}` : '')
    : null

  const toggleStar = (s: string) => setStars(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const toggleMeal = (m: string) => setMealPlan(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])

  return (
    <>
    <div ref={containerRef} className="relative flex-1 flex items-center gap-0 min-w-0">

      {/* ── Compact pill bar ── */}
      <div className="flex-1 flex items-stretch bg-white border border-gray-100 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.06)] divide-x divide-gray-100 min-w-0 h-11 overflow-hidden">

        {/* Destinace */}
        <div
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 640) {
              openMobileSheet()
            } else {
              openPanel('dest')
            }
          }}
          className={`flex-1 min-w-0 flex flex-col justify-center px-5 cursor-text transition-colors rounded-l-full ${
            activePanel === 'dest'
              ? 'bg-blue-50/60'
              : destination.length > 0
              ? 'hover:bg-gray-50/80'
              : 'bg-[#008afe]/[0.03] hover:bg-[#008afe]/[0.06]'
          }`}
        >
          {/* On mobile, show combined label when date is set */}
          <span className={microLabel}>
            <span className="sm:hidden">
              {destSummary ? 'Destinace' : dateSummary ? 'Termín' : 'Destinace'}
            </span>
            <span className="hidden sm:inline">Destinace</span>
          </span>
          {/* Mobile: show date summary if no dest selected */}
          {!destSummary && dateSummary && (
            <span className={`sm:hidden ${subLabel} text-gray-700 font-medium truncate`}>{dateSummary}</span>
          )}
          {destSummary ? (
            <span className={`${subLabel} text-gray-700 font-medium truncate`}>{destSummary}</span>
          ) : !dateSummary ? (
            <span className="relative h-[14px] overflow-hidden block mt-0.5">
              <span
                className="absolute inset-0 text-xs leading-none text-[#008afe]/65 whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-[280ms] ease-in-out"
                style={{
                  opacity:   phVisible ? 1 : 0,
                  transform: phVisible ? 'translateY(0)' : 'translateY(-5px)',
                }}
              >
                {PLACEHOLDER_CYCLE[phIdx]}
              </span>
            </span>
          ) : null}
        </div>

        {/* Termín — hidden on xs */}
        <div
          onClick={() => openPanel('date')}
          className={`hidden sm:flex flex-col justify-center px-5 w-44 flex-shrink-0 cursor-pointer transition-colors ${
            activePanel === 'date' ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'
          }`}
        >
          <span className={microLabel}>Termín odjezdu</span>
          <span className={`${subLabel} ${dateSummary ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {dateSummary || 'Vybrat termín'}
          </span>
        </div>

        {/* Cestující — hidden on sm */}
        <div className="hidden md:flex flex-col justify-center px-4 flex-shrink-0 gap-1">
          <span className={microLabel}>Cestující</span>
          <div className="flex items-center gap-1.5">
            <button type="button"
              onClick={e => { e.stopPropagation(); setAdults(a => Math.max(1, a - 1)) }}
              disabled={adults <= 1}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-[#008afe] transition-colors disabled:opacity-30">
              <PiUserMinus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-gray-700 tabular-nums select-none">{adults} os.</span>
            <button type="button"
              onClick={e => { e.stopPropagation(); setAdults(a => Math.min(6, a + 1)) }}
              disabled={adults >= 6}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-[#008afe] transition-colors disabled:opacity-30">
              <PiUserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Řadit — hidden on md */}
        <div className="hidden lg:flex flex-col justify-center px-4 flex-shrink-0 gap-1">
          <span className={microLabel}>Řadit podle</span>
          <div className="relative flex items-center">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="text-xs font-medium text-gray-600 bg-transparent focus:outline-none appearance-none pr-4 cursor-pointer max-w-[130px]"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <PiCaretDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Filtry + loading indicator — desktop */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); openPanel('adv') }}
          className={`hidden sm:flex items-center gap-1.5 px-4 flex-shrink-0 transition-colors rounded-r-full ${
            activePanel === 'adv' || advancedCount > 0
              ? 'bg-[#008afe]/8 text-[#008afe]'
              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
          }`}
        >
          {isPending
            ? <PiSpinner className="w-4 h-4 animate-spin" />
            : <PiSliders className="w-4 h-4" />
          }
          <span className="text-xs font-medium hidden xl:block">Filtry</span>
          {advancedCount > 0 && (
            <span className="w-4 h-4 flex items-center justify-center bg-[#008afe] text-white text-[9px] font-bold rounded-full flex-shrink-0">
              {advancedCount}
            </span>
          )}
        </button>

        {/* Filtry — mobile only */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); openMobileSheet() }}
          className={`sm:hidden flex items-center gap-1.5 px-4 flex-shrink-0 transition-colors rounded-r-full ${
            mobileFilterCount > 0
              ? 'bg-[#008afe]/8 text-[#008afe]'
              : 'text-gray-400'
          }`}
        >
          {isPending
            ? <PiSpinner className="w-4 h-4 animate-spin" />
            : <PiSliders className="w-4 h-4" />
          }
          {mobileFilterCount > 0 && (
            <span className="w-4 h-4 flex items-center justify-center bg-[#008afe] text-white text-[9px] font-bold rounded-full flex-shrink-0">
              {mobileFilterCount}
            </span>
          )}
        </button>

      </div>

      {/* ══ Destination dropdown ══ */}
      {activePanel === 'dest' && (
        <div className="absolute top-full left-0 right-0 mt-2.5 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-black/8 z-50 p-3">
          <DestinationAutocomplete
            destinations={destRows}
            value={destination}
            onChange={setDestination}
            noLabel
            defaultOpen
            loading={!destLoaded}
          />
        </div>
      )}

      {/* ══ Date dropdown — calendar shown directly (inline) ══ */}
      {activePanel === 'date' && (
        <div className="absolute top-full sm:left-[calc(37%-0.5rem)] mt-2.5 bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 p-5">
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            destination={destination[0]}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            inline
            onComplete={() => setActivePanel(null)}
          />
        </div>
      )}

      {/* ══ Advanced filters dropdown ══ */}
      {activePanel === 'adv' && (
        <div className="absolute top-full left-0 right-0 mt-2.5 bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 p-5">
          {metaError ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <p className="text-sm text-gray-500">Nepodařilo se načíst filtry.</p>
              <button type="button" onClick={() => { setMetaError(false); setMeta(null); loadMeta() }}
                className="text-xs text-[#008afe] underline underline-offset-2 hover:text-[#0079e5] transition-colors">
                Zkusit znovu
              </button>
            </div>
          ) : !meta ? (
            <div className="flex justify-center py-8">
              <PiSpinner className="w-5 h-5 text-[#008afe] animate-spin" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-8 gap-y-5 items-start">

              {/* Typ nabídky */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Typ nabídky</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button"
                    onClick={() => setTourType(t => t === 'last_minute' ? '' : 'last_minute')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      tourType === 'last_minute'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-500'
                    }`}>
                    <PiTimer className="w-3.5 h-3.5" /> Last minute
                  </button>
                  <button type="button"
                    onClick={() => setTourType(t => t === 'first_minute' ? '' : 'first_minute')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      tourType === 'first_minute'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-600'
                    }`}>
                    <PiCalendarStar className="w-3.5 h-3.5" /> First minute
                  </button>
                </div>
              </div>

              {/* Hvězdičky */}
              {meta.stars.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Hvězdičky</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {meta.stars.map(s => (
                      <PillToggle key={s.stars} active={stars.includes(String(s.stars))} onClick={() => toggleStar(String(s.stars))}>
                        <span className="text-amber-400">{'★'.repeat(s.stars)}</span>
                      </PillToggle>
                    ))}
                  </div>
                </div>
              )}

              {/* Stravování */}
              {meta.mealPlans.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Stravování</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {meta.mealPlans.map(m => (
                      <PillToggle key={m.meal_plan} active={mealPlan.includes(m.meal_plan)} onClick={() => toggleMeal(m.meal_plan)}>
                        {MEAL_LABELS[m.meal_plan] ?? m.meal_plan}
                      </PillToggle>
                    ))}
                  </div>
                </div>
              )}

              {/* Délka pobytu */}
              {meta.durations.length > 0 && (
                <div className="min-w-[120px]">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Délka pobytu</label>
                  <div className="relative">
                    <select value={duration} onChange={e => setDuration(e.target.value)}
                      className="w-full text-sm border border-gray-100 rounded-xl px-3 py-2 bg-white focus:outline-none shadow-sm appearance-none pr-8 cursor-pointer">
                      <option value="">Libovolná</option>
                      {meta.durations.map(d => <option key={d.duration} value={d.duration}>{d.duration} nocí</option>)}
                    </select>
                    <PiCaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Místo odletu */}
              {(meta.departureCities ?? []).length > 1 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Místo odletu</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {meta.departureCities.map(c => (
                      <PillToggle key={c.departure_city} active={depCity.includes(c.departure_city)}
                        onClick={() => setDepCity(p => p.includes(c.departure_city) ? p.filter(x => x !== c.departure_city) : [...p, c.departure_city])}>
                        {c.departure_city}
                      </PillToggle>
                    ))}
                  </div>
                </div>
              )}

              {/* Cena */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cena (Kč / os.)</p>
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Od" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                    className="w-24 px-3 py-2 text-sm border border-gray-100 rounded-xl bg-white focus:outline-none shadow-sm" min={0} step={1000} />
                  <span className="text-gray-300">–</span>
                  <input type="number" placeholder="Do" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                    className="w-24 px-3 py-2 text-sm border border-gray-100 rounded-xl bg-white focus:outline-none shadow-sm" min={0} step={1000} />
                </div>
              </div>

            </div>
          )}

          {/* Clear advanced */}
          {advancedCount > 0 && !metaError && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <button type="button"
                onClick={() => { setDuration(''); setMinPrice(''); setMaxPrice(''); setStars([]); setMealPlan([]); setTransport(''); setTourType(''); setDepCity([]) }}
                className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors">
                Zrušit filtry ({advancedCount})
              </button>
            </div>
          )}
        </div>
      )}

    </div>

    {/* ══ Mobile bottom sheet (portal) ══ */}
    {mobileSheetOpen && typeof document !== 'undefined' && createPortal(
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
          onClick={() => setMobileSheetOpen(false)}
        />

        {/* Sheet */}
        <div className="fixed bottom-0 inset-x-0 z-[201] bg-white rounded-t-3xl max-h-[92dvh] flex flex-col shadow-2xl">

          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-base font-bold text-gray-900">Hledat zájezd</h2>
            <button
              type="button"
              onClick={() => setMobileSheetOpen(false)}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <PiX className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 overscroll-contain">
            <div className="px-5 py-5 space-y-7">

              {/* Destinace */}
              <section>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Destinace</p>
                {!destLoaded ? (
                  <div className="flex justify-center py-6">
                    <PiSpinner className="w-5 h-5 text-[#008afe] animate-spin" />
                  </div>
                ) : (
                  <DestinationAutocomplete
                    destinations={destRows}
                    value={destination}
                    onChange={setDestination}
                    noLabel
                  />
                )}
              </section>

              {/* Termín odjezdu */}
              <section>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Termín odjezdu</p>
                <DateRangePicker
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  destination={destination[0]}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  inline
                />
              </section>

              {/* Cestující */}
              <section>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Cestující</p>
                <div className="flex items-center gap-4">
                  <button type="button"
                    onClick={() => setAdults(a => Math.max(1, a - 1))}
                    disabled={adults <= 1}
                    className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-[#008afe] hover:text-[#008afe] disabled:opacity-30 transition-colors">
                    <PiUserMinus className="w-5 h-5" />
                  </button>
                  <span className="text-lg font-semibold text-gray-900 tabular-nums min-w-[5rem] text-center">{adults} {adults === 1 ? 'osoba' : adults < 5 ? 'osoby' : 'osob'}</span>
                  <button type="button"
                    onClick={() => setAdults(a => Math.min(6, a + 1))}
                    disabled={adults >= 6}
                    className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-[#008afe] hover:text-[#008afe] disabled:opacity-30 transition-colors">
                    <PiUserPlus className="w-5 h-5" />
                  </button>
                </div>
              </section>

              {/* Řadit podle */}
              <section>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Řadit podle</p>
                <div className="grid grid-cols-2 gap-2">
                  {SORT_OPTIONS.map(o => (
                    <button key={o.value} type="button"
                      onClick={() => setSort(o.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${
                        sort === o.value
                          ? 'bg-[#008afe] text-white border-[#008afe]'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Typ nabídky */}
              <section>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Typ nabídky</p>
                <div className="flex gap-2 flex-wrap">
                  <button type="button"
                    onClick={() => setTourType(t => t === 'last_minute' ? '' : 'last_minute')}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                      tourType === 'last_minute'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    <PiTimer className="w-4 h-4" /> Last minute
                  </button>
                  <button type="button"
                    onClick={() => setTourType(t => t === 'first_minute' ? '' : 'first_minute')}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium border transition-all ${
                      tourType === 'first_minute'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    <PiCalendarStar className="w-4 h-4" /> First minute
                  </button>
                </div>
              </section>

              {/* Advanced filters — only after meta loaded */}
              {metaError && (
                <div className="flex flex-col items-center py-4 gap-3">
                  <p className="text-sm text-gray-500">Nepodařilo se načíst filtry.</p>
                  <button type="button" onClick={() => { setMetaError(false); setMeta(null); loadMeta() }}
                    className="text-sm text-[#008afe] underline underline-offset-2">
                    Zkusit znovu
                  </button>
                </div>
              )}

              {!meta && !metaError && (
                <div className="flex justify-center py-2">
                  <PiSpinner className="w-5 h-5 text-[#008afe] animate-spin" />
                </div>
              )}

              {meta && (
                <>
                  {/* Hvězdičky */}
                  {meta.stars.length > 0 && (
                    <section>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Hvězdičky</p>
                      <div className="flex gap-2 flex-wrap">
                        {meta.stars.map(s => (
                          <PillToggle key={s.stars} active={stars.includes(String(s.stars))} onClick={() => toggleStar(String(s.stars))}>
                            <span className="text-amber-400">{'★'.repeat(s.stars)}</span>
                          </PillToggle>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Stravování */}
                  {meta.mealPlans.length > 0 && (
                    <section>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Stravování</p>
                      <div className="flex gap-2 flex-wrap">
                        {meta.mealPlans.map(m => (
                          <PillToggle key={m.meal_plan} active={mealPlan.includes(m.meal_plan)} onClick={() => toggleMeal(m.meal_plan)}>
                            {MEAL_LABELS[m.meal_plan] ?? m.meal_plan}
                          </PillToggle>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Délka pobytu */}
                  {meta.durations.length > 0 && (
                    <section>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Délka pobytu</label>
                      <div className="relative">
                        <select value={duration} onChange={e => setDuration(e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 bg-white focus:outline-none appearance-none pr-8 cursor-pointer">
                          <option value="">Libovolná</option>
                          {meta.durations.map(d => <option key={d.duration} value={d.duration}>{d.duration} nocí</option>)}
                        </select>
                        <PiCaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      </div>
                    </section>
                  )}

                  {/* Místo odletu */}
                  {(meta.departureCities ?? []).length > 1 && (
                    <section>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Místo odletu</p>
                      <div className="flex gap-2 flex-wrap">
                        {meta.departureCities.map(c => (
                          <PillToggle key={c.departure_city} active={depCity.includes(c.departure_city)}
                            onClick={() => setDepCity(p => p.includes(c.departure_city) ? p.filter(x => x !== c.departure_city) : [...p, c.departure_city])}>
                            {c.departure_city}
                          </PillToggle>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Cena */}
                  <section>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Cena (Kč / os.)</p>
                    <div className="flex items-center gap-3">
                      <input type="number" placeholder="Od" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                        className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none" min={0} step={1000} />
                      <span className="text-gray-300">–</span>
                      <input type="number" placeholder="Do" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                        className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none" min={0} step={1000} />
                    </div>
                  </section>
                </>
              )}

              {/* Clear all */}
              {(destination.length > 0 || dateFrom || dateTo || adults !== 2 || sort !== 'price_asc' || advancedCount > 0) && (
                <div className="pt-2 border-t border-gray-100">
                  <button type="button"
                    onClick={() => {
                      setDestination([])
                      setDateFrom('')
                      setDateTo('')
                      setAdults(2)
                      setSort('price_asc')
                      setDuration('')
                      setMinPrice('')
                      setMaxPrice('')
                      setStars([])
                      setMealPlan([])
                      setTransport('')
                      setTourType('')
                      setDepCity([])
                    }}
                    className="text-sm text-gray-400 hover:text-red-500 underline underline-offset-2 transition-colors">
                    Zrušit všechny filtry
                  </button>
                </div>
              )}

              {/* Safe area bottom */}
              <div className="h-2" />
            </div>
          </div>

          {/* Footer CTA */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setMobileSheetOpen(false)}
              className="w-full bg-[#008afe] hover:bg-[#0079e5] active:bg-[#006fd4] text-white font-semibold py-4 rounded-2xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {isPending
                ? <PiSpinner className="w-4 h-4 animate-spin" />
                : <PiMagnifyingGlass className="w-4 h-4" />
              }
              Zobrazit výsledky
            </button>
          </div>
        </div>
      </>,
      document.body
    )}
    </>
  )
}
