'use client'
import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { PiX, PiSpinner, PiCaretDown, PiSliders, PiUserPlus, PiUserMinus, PiTimer, PiCalendarStar } from 'react-icons/pi'
import DateRangePicker from './DateRangePicker'
import DestinationAutocomplete from './DestinationAutocomplete'

interface Destination { country: string; destination: string; resort_town: string | null; hotel_count: number }
interface FilterMeta {
  mealPlans: { meal_plan: string; count: number }[]
  priceRange: { min: number; max: number }
  durations: { duration: number; count: number }[]
  stars: { stars: number; count: number }[]
  transports: { transport: string; count: number }[]
  departureCities: { departure_city: string; count: number }[]
}

const MEAL_LABELS: Record<string, string> = {
  'All inclusive': 'All inclusive',
  'Ultra All inclusive': 'Ultra All incl.',
  'Plná penze': 'Plná penze',
  'Polopenze': 'Polopenze',
  'Snídaně': 'Snídaně',
  'Bez stravy': 'Bez stravy',
}

const SORT_OPTIONS = [
  { value: 'price_asc',  label: 'Cena: nejlevnější' },
  { value: 'price_desc', label: 'Cena: nejdražší' },
  { value: 'stars_desc', label: 'Hvězdičky' },
  { value: 'name_asc',   label: 'Název A–Z' },
]

const microLabel = "text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block"

const advSelectCls = [
  'w-full text-sm text-gray-700 rounded-xl px-3 py-2.5 pr-8',
  'focus:outline-none transition-all appearance-none cursor-pointer',
  'bg-[rgba(237,246,255,0.60)] border border-[rgba(200,227,255,0.65)]',
  'focus:bg-white focus:border-[rgba(0,147,255,0.40)] focus:shadow-[0_0_0_3px_rgba(0,147,255,0.08)]',
].join(' ')

const priceInputCls = [
  'w-28 text-sm rounded-xl px-3 py-2.5',
  'bg-[rgba(237,246,255,0.60)] border border-[rgba(200,227,255,0.65)]',
  'focus:outline-none focus:bg-white focus:border-[rgba(0,147,255,0.40)] focus:shadow-[0_0_0_3px_rgba(0,147,255,0.08)]',
  'transition-all text-gray-700 placeholder-gray-400',
].join(' ')

function PillToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap"
      style={active ? {
        background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
        color: '#fff',
        border: '1px solid #0093FF',
        boxShadow: '0 2px 8px rgba(0,147,255,0.28)',
      } : {
        background: 'rgba(237,246,255,0.70)',
        color: '#4b5563',
        border: '1px solid rgba(200,227,255,0.65)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </button>
  )
}

export default function FilterBar({ destinations, meta }: { destinations: Destination[]; meta: FilterMeta }) {
  const router    = useRouter()
  const pathname  = usePathname()
  const sp        = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [destination, setDestination] = useState<string[]>(sp.get('destination')?.split(',').filter(Boolean) ?? [])
  const [dateFrom,    setDateFrom]    = useState(sp.get('date_from')   || '')
  const [dateTo,      setDateTo]      = useState(sp.get('date_to')     || '')
  const [adults,      setAdults]      = useState(parseInt(sp.get('adults') || '2'))
  const [duration,    setDuration]    = useState(sp.get('duration')    || '')
  const [minPrice,    setMinPrice]    = useState(sp.get('min_price')   || '')
  const [maxPrice,    setMaxPrice]    = useState(sp.get('max_price')   || '')
  const [stars,       setStars]       = useState<string[]>(sp.get('stars')?.split(',').filter(Boolean) ?? [])
  const [mealPlan,    setMealPlan]    = useState<string[]>(sp.get('meal_plan')?.split(',').filter(Boolean) ?? [])
  const [transport,   setTransport]   = useState(sp.get('transport') || '')
  const [tourType,    setTourType]    = useState(sp.get('tour_type') || '')
  const [depCity,     setDepCity]     = useState<string[]>(sp.get('departure_city')?.split(',').filter(Boolean) ?? [])
  const [sort,        setSort]        = useState(sp.get('sort') || 'price_asc')

  const hasAdvanced = !!(duration || minPrice || maxPrice || stars.length || mealPlan.length || transport || tourType || depCity.length)
  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced)

  const stateKey = JSON.stringify({ destination, dateFrom, dateTo, adults, duration, minPrice, maxPrice, stars, mealPlan, transport, tourType, depCity, sort })
  const lastPushedKey = useRef<string>(stateKey)

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (destination.length) params.set('destination', destination.join(','))
    if (dateFrom)           params.set('date_from',   dateFrom)
    if (dateTo)             params.set('date_to',     dateTo)
    if (adults !== 2)       params.set('adults',      String(adults))
    if (duration)           params.set('duration',    duration)
    if (minPrice)           params.set('min_price',   minPrice)
    if (maxPrice)           params.set('max_price',   maxPrice)
    if (stars.length)       params.set('stars',       stars.join(','))
    if (mealPlan.length)    params.set('meal_plan',   mealPlan.join(','))
    if (transport)          params.set('transport',     transport)
    if (tourType)           params.set('tour_type',     tourType)
    if (depCity.length)     params.set('departure_city', depCity.join(','))
    if (sort !== 'price_asc') params.set('sort',        sort)
    return params
  }, [destination, dateFrom, dateTo, adults, duration, minPrice, maxPrice, stars, mealPlan, transport, tourType, depCity, sort])

  useEffect(() => {
    const next = {
      destination: sp.get('destination')?.split(',').filter(Boolean) ?? [],
      dateFrom:    sp.get('date_from')  || '',
      dateTo:      sp.get('date_to')    || '',
      adults:      parseInt(sp.get('adults') || '2'),
      duration:    sp.get('duration')   || '',
      minPrice:    sp.get('min_price')  || '',
      maxPrice:    sp.get('max_price')  || '',
      stars:       sp.get('stars')?.split(',').filter(Boolean) ?? [],
      mealPlan:    sp.get('meal_plan')?.split(',').filter(Boolean) ?? [],
      transport:   sp.get('transport')  || '',
      tourType:    sp.get('tour_type')  || '',
      depCity:     sp.get('departure_city')?.split(',').filter(Boolean) ?? [],
      sort:        sp.get('sort')       || 'price_asc',
    }
    setDestination(next.destination)
    setDateFrom(next.dateFrom)
    setDateTo(next.dateTo)
    setAdults(next.adults)
    setDuration(next.duration)
    setMinPrice(next.minPrice)
    setMaxPrice(next.maxPrice)
    setStars(next.stars)
    setMealPlan(next.mealPlan)
    setTransport(next.transport)
    setTourType(next.tourType)
    setDepCity(next.depCity)
    setSort(next.sort)
    lastPushedKey.current = JSON.stringify(next)
  }, [sp]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stateKey === lastPushedKey.current) return
    const timer = setTimeout(() => {
      lastPushedKey.current = stateKey
      window.scrollTo({ top: 0, behavior: 'smooth' })
      startTransition(() => router.push(`${pathname}?${buildParams().toString()}`))
    }, 350)
    return () => clearTimeout(timer)
  }, [stateKey, buildParams, pathname, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStar = (s: string) => setStars(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const toggleMeal = (m: string) => setMealPlan(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])

  const clearAll = () => {
    setDestination([]); setDateFrom(''); setDateTo(''); setAdults(2)
    setDuration(''); setMinPrice(''); setMaxPrice('')
    setStars([]); setMealPlan([]); setTransport(''); setTourType(''); setDepCity([]); setSort('price_asc')
  }

  type Chip = { label: string; clear: () => void }
  const chips: Chip[] = [
    ...destination.map(d => ({ label: d, clear: () => setDestination(prev => prev.filter(v => v !== d)) })),
    ...(dateFrom ? [{ label: `od ${dateFrom}`, clear: () => setDateFrom('') }] : []),
    ...(dateTo   ? [{ label: `do ${dateTo}`,   clear: () => setDateTo('') }]   : []),
    ...(duration ? [{ label: `${duration} nocí`, clear: () => setDuration('') }] : []),
    ...(minPrice ? [{ label: `od ${Number(minPrice).toLocaleString('cs-CZ')} Kč`, clear: () => setMinPrice('') }] : []),
    ...(maxPrice ? [{ label: `do ${Number(maxPrice).toLocaleString('cs-CZ')} Kč`, clear: () => setMaxPrice('') }] : []),
    ...(transport ? [{ label: transport, clear: () => setTransport('') }] : []),
    ...stars.map(s    => ({ label: '★'.repeat(Number(s)), clear: () => toggleStar(s) })),
    ...mealPlan.map(m => ({ label: m, clear: () => toggleMeal(m) })),
    ...(tourType === 'last_minute'  ? [{ label: 'Last minute',  clear: () => setTourType('') }] : []),
    ...(tourType === 'first_minute' ? [{ label: 'First minute', clear: () => setTourType('') }] : []),
    ...depCity.map(c => ({ label: `Odlet: ${c}`, clear: () => setDepCity(p => p.filter(x => x !== c)) })),
  ]

  const advancedCount = [duration, minPrice, maxPrice, transport, tourType].filter(Boolean).length + stars.length + mealPlan.length + depCity.length

  const divider = '1px solid rgba(0,147,255,0.08)'

  return (
    <div
      className="glass-card rounded-2xl overflow-hidden relative mb-6"
      style={{ border: '1px solid rgba(200,227,255,0.65)' }}
    >

      {/* Loading bar */}
      {isPending && (
        <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden z-10">
          <div className="h-full bg-[#0093FF] animate-pulse w-full" />
        </div>
      )}

      {/* ── Main search row ── */}
      <div className="flex flex-col sm:flex-row sm:items-stretch" style={{ borderBottom: showAdvanced || chips.length > 0 ? divider : undefined }}>

        {/* Destinace */}
        <div className="flex-1 min-w-0 px-5 pt-4 pb-4" style={{ borderBottom: 'var(--row-divider, none)' }}>
          <span className={microLabel}>Destinace</span>
          <DestinationAutocomplete
            destinations={destinations}
            value={destination}
            onChange={setDestination}
          />
        </div>

        {/* Termín odjezdu */}
        <div
          className="sm:w-60 flex-shrink-0 px-5 pt-4 pb-4"
          style={{ borderLeft: divider }}
        >
          <span className={microLabel}>Termín odjezdu</span>
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            destination={destination.length ? destination[0] : undefined}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />
        </div>

        {/* Cestující */}
        <div
          className="flex-shrink-0 px-5 pt-4 pb-4"
          style={{ borderLeft: divider }}
        >
          <span className={microLabel}>Cestující</span>
          <div className="flex items-center gap-2.5 h-[42px]">
            <button
              type="button"
              onClick={() => setAdults(a => Math.max(1, a - 1))}
              disabled={adults <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all disabled:opacity-30"
              style={{ background: 'rgba(0,147,255,0.07)', color: '#0093FF' }}
            >
              <PiUserMinus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-semibold text-gray-800 tabular-nums w-10 text-center select-none">
              {adults} os.
            </span>
            <button
              type="button"
              onClick={() => setAdults(a => Math.min(6, a + 1))}
              disabled={adults >= 6}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all disabled:opacity-30"
              style={{ background: 'rgba(0,147,255,0.07)', color: '#0093FF' }}
            >
              <PiUserPlus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Řadit podle */}
        <div
          className="flex-shrink-0 px-5 pt-4 pb-4"
          style={{ borderLeft: divider }}
        >
          <span className={microLabel}>Řadit podle</span>
          <div className="relative flex items-center h-[42px]">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none appearance-none pr-6 cursor-pointer max-w-[148px]"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <PiCaretDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Filtry */}
        <div
          className="flex-shrink-0 px-5 pt-4 pb-4 flex flex-col justify-end"
          style={{ borderLeft: divider }}
        >
          <span className={microLabel}>&nbsp;</span>
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
            style={showAdvanced || advancedCount > 0 ? {
              background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
              color: '#fff',
              border: '1px solid #0093FF',
              boxShadow: '0 4px 14px rgba(0,147,255,0.30)',
            } : {
              background: 'rgba(237,246,255,0.70)',
              color: '#374151',
              border: '1px solid rgba(200,227,255,0.65)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <PiSliders className="w-4 h-4" />
            Filtry
            {advancedCount > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                style={showAdvanced || advancedCount > 0 ? {
                  background: 'rgba(255,255,255,0.25)',
                  color: '#fff',
                } : {
                  background: 'rgba(0,147,255,0.10)',
                  color: '#0093FF',
                }}
              >
                {advancedCount}
              </span>
            )}
          </button>
        </div>

      </div>

      {/* ── Rozšířené filtry ── */}
      {showAdvanced && (
        <div
          className="px-5 py-5 space-y-5"
          style={{
            background: 'rgba(237,246,255,0.40)',
            backdropFilter: 'blur(12px)',
            borderBottom: chips.length > 0 ? divider : undefined,
          }}
        >
          <div className="flex flex-wrap gap-x-8 gap-y-5 items-start">

            {/* Typ nabídky */}
            <div>
              <p className={microLabel}>Typ nabídky</p>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTourType(t => t === 'last_minute' ? '' : 'last_minute')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={tourType === 'last_minute' ? {
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff',
                    border: '1px solid #ef4444',
                    boxShadow: '0 2px 8px rgba(239,68,68,0.28)',
                  } : {
                    background: 'rgba(237,246,255,0.70)',
                    color: '#4b5563',
                    border: '1px solid rgba(200,227,255,0.65)',
                  }}
                >
                  <PiTimer className="w-3.5 h-3.5 flex-shrink-0" />
                  Last minute
                </button>
                <button
                  type="button"
                  onClick={() => setTourType(t => t === 'first_minute' ? '' : 'first_minute')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={tourType === 'first_minute' ? {
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    border: '1px solid #10b981',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.28)',
                  } : {
                    background: 'rgba(237,246,255,0.70)',
                    color: '#4b5563',
                    border: '1px solid rgba(200,227,255,0.65)',
                  }}
                >
                  <PiCalendarStar className="w-3.5 h-3.5 flex-shrink-0" />
                  First minute
                </button>
              </div>
            </div>

            {/* Hvězdičky */}
            {meta.stars.length > 0 && (
              <div>
                <p className={microLabel}>Hvězdičky</p>
                <div className="flex gap-1.5 flex-wrap">
                  {meta.stars.map(s => (
                    <PillToggle key={s.stars} active={stars.includes(String(s.stars))} onClick={() => toggleStar(String(s.stars))}>
                      <span style={{ color: stars.includes(String(s.stars)) ? '#fff' : '#f59e0b' }}>{'★'.repeat(s.stars)}</span>
                    </PillToggle>
                  ))}
                </div>
              </div>
            )}

            {/* Stravování */}
            {meta.mealPlans.length > 0 && (
              <div>
                <p className={microLabel}>Stravování</p>
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
              <div className="min-w-[130px]">
                <label className={microLabel}>Délka pobytu</label>
                <div className="relative">
                  <select value={duration} onChange={e => setDuration(e.target.value)} className={`${advSelectCls} pr-8`}>
                    <option value="">Libovolná</option>
                    {meta.durations.map(d => (
                      <option key={d.duration} value={d.duration}>{d.duration} nocí</option>
                    ))}
                  </select>
                  <PiCaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Doprava */}
            {(meta.transports ?? []).length > 1 && (
              <div className="min-w-[140px]">
                <label className={microLabel}>Doprava</label>
                <div className="relative">
                  <select value={transport} onChange={e => setTransport(e.target.value)} className={`${advSelectCls} pr-8`}>
                    <option value="">Libovolná</option>
                    {(meta.transports ?? []).map(t => (
                      <option key={t.transport} value={t.transport}>{t.transport}</option>
                    ))}
                  </select>
                  <PiCaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Místo odletu */}
            {(meta.departureCities ?? []).length > 1 && (
              <div>
                <p className={microLabel}>Místo odletu</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(meta.departureCities ?? []).map(c => (
                    <PillToggle
                      key={c.departure_city}
                      active={depCity.includes(c.departure_city)}
                      onClick={() => setDepCity(p => p.includes(c.departure_city) ? p.filter(x => x !== c.departure_city) : [...p, c.departure_city])}
                    >
                      {c.departure_city}
                    </PillToggle>
                  ))}
                </div>
              </div>
            )}

            {/* Cena */}
            <div>
              <p className={microLabel}>Cena (Kč / os.)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Od"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  className={priceInputCls}
                  min={0}
                  step={1000}
                />
                <span className="text-gray-300 text-sm">–</span>
                <input
                  type="number"
                  placeholder="Do"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  className={priceInputCls}
                  min={0}
                  step={1000}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Aktivní filtry ── */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 py-3">
          {chips.map((chip, i) => (
            <button
              key={i}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: 'rgba(0,147,255,0.08)',
                color: '#0093FF',
                border: '1px solid rgba(0,147,255,0.15)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.background = 'rgba(239,68,68,0.08)'
                el.style.color = '#ef4444'
                el.style.borderColor = 'rgba(239,68,68,0.20)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.background = 'rgba(0,147,255,0.08)'
                el.style.color = '#0093FF'
                el.style.borderColor = 'rgba(0,147,255,0.15)'
              }}
            >
              {chip.label}
              <PiX className="w-3 h-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1 underline underline-offset-2"
          >
            Smazat vše
          </button>
          {isPending && <PiSpinner className="w-3.5 h-3.5 text-[#0093FF] animate-spin ml-auto" />}
        </div>
      )}

    </div>
  )
}
