'use client'
import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { PiX, PiSpinner, PiCaretDown, PiArrowsDownUp, PiSliders, PiUserPlus, PiUserMinus, PiTimer, PiCalendarStar } from 'react-icons/pi'
import DateRangePicker from './DateRangePicker'
import DestinationAutocomplete from './DestinationAutocomplete'

interface Destination { country: string; destination: string; resort_town: string | null; hotel_count: number }
interface FilterMeta {
  mealPlans: { meal_plan: string; count: number }[]
  priceRange: { min: number; max: number }
  durations: { duration: number; count: number }[]
  stars: { stars: number; count: number }[]
  transports: { transport: string; count: number }[]
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

const select = "w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
const label  = "block text-xs font-medium text-gray-500 mb-1.5"

function PillToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
        active
          ? 'bg-[#008afe] text-white border-[#008afe] shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:border-[#008afe]'
      }`}>
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
  const [sort,        setSort]        = useState(sp.get('sort') || 'price_asc')

  // Open advanced panel if any advanced filter is active on mount
  const hasAdvanced = !!(duration || minPrice || maxPrice || stars.length || mealPlan.length || transport || tourType)
  const [showAdvanced, setShowAdvanced] = useState(hasAdvanced)

  const stateKey = JSON.stringify({ destination, dateFrom, dateTo, adults, duration, minPrice, maxPrice, stars, mealPlan, transport, tourType, sort })
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
    if (transport)          params.set('transport',   transport)
    if (tourType)           params.set('tour_type',   tourType)
    if (sort !== 'price_asc') params.set('sort',      sort)
    return params
  }, [destination, dateFrom, dateTo, adults, duration, minPrice, maxPrice, stars, mealPlan, transport, tourType, sort])

  // Sync state when URL changes externally (e.g. breadcrumb clicks)
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
    setSort(next.sort)
    // Mark URL's current state as already synced to avoid re-pushing it
    lastPushedKey.current = JSON.stringify(next)
  }, [sp]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stateKey === lastPushedKey.current) return
    const timer = setTimeout(() => {
      lastPushedKey.current = stateKey
      startTransition(() => router.push(`${pathname}?${buildParams().toString()}`))
    }, 350)
    return () => clearTimeout(timer)
  }, [stateKey, buildParams, pathname, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStar = (s: string) => setStars(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const toggleMeal = (m: string) => setMealPlan(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m])

  const clearAll = () => {
    setDestination([]); setDateFrom(''); setDateTo(''); setAdults(2)
    setDuration(''); setMinPrice(''); setMaxPrice('')
    setStars([]); setMealPlan([]); setTransport(''); setTourType(''); setSort('price_asc')
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
  ]

  // Count active advanced filters for badge
  const advancedCount = [duration, minPrice, maxPrice, transport, tourType].filter(Boolean).length + stars.length + mealPlan.length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_4px_24px_-2px_rgba(0,100,255,0.08),0_1px_4px_rgba(0,0,0,0.04)] mb-6 relative">
      {isPending && (
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl overflow-hidden">
          <div className="h-full bg-blue-500 animate-pulse w-full" />
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Main row: Destinace | Termín | Cestující | Řadit podle | Filtry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-end">
          <DestinationAutocomplete
            destinations={destinations}
            value={destination}
            onChange={setDestination}
          />

          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            destination={destination.length ? destination[0] : undefined}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
          />

          {/* Adults stepper */}
          <div>
            <label className={label}>Cestující</label>
            <div className="flex items-center gap-1 h-[42px] px-2 border border-gray-200 rounded-xl bg-white">
              <button type="button" onClick={() => setAdults(a => Math.max(1, a - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#008afe] hover:bg-[#008afe]/8 transition-all disabled:opacity-30"
                disabled={adults <= 1}>
                <PiUserMinus className="w-4 h-4" />
              </button>
              <span className="w-6 text-center text-sm font-semibold text-gray-800 select-none">{adults}</span>
              <button type="button" onClick={() => setAdults(a => Math.min(6, a + 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#008afe] hover:bg-[#008afe]/8 transition-all disabled:opacity-30"
                disabled={adults >= 6}>
                <PiUserPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="relative">
            <label className={label}>Řadit podle</label>
            <div className="relative">
              <select value={sort} onChange={e => setSort(e.target.value)} className={`${select} pr-8`}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <PiArrowsDownUp className="absolute right-3 top-[calc(50%+6px)] -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <div className="h-[18px] mb-1.5" /> {/* spacer to align with labeled inputs */}
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
                showAdvanced || advancedCount > 0
                  ? 'bg-[#008afe] text-white border-[#008afe] shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#008afe]'
              }`}>
              <PiSliders className="w-4 h-4" />
              Filtry
              {advancedCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  showAdvanced ? 'bg-white/25 text-white' : 'bg-[#008afe]/10 text-[#008afe]'
                }`}>
                  {advancedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Advanced panel */}
        {showAdvanced && (
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex flex-wrap gap-x-8 gap-y-4 items-start">

              {/* Tour type */}
              <div>
                <p className={label}>Typ nabídky</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={() => setTourType(t => t === 'last_minute' ? '' : 'last_minute')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
                      tourType === 'last_minute'
                        ? 'bg-red-500 text-white border-red-500 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-red-400 hover:text-red-500'
                    }`}>
                    <PiTimer className="w-3.5 h-3.5 flex-shrink-0" />
                    Last minute
                  </button>
                  <button type="button" onClick={() => setTourType(t => t === 'first_minute' ? '' : 'first_minute')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
                      tourType === 'first_minute'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400 hover:text-emerald-600'
                    }`}>
                    <PiCalendarStar className="w-3.5 h-3.5 flex-shrink-0" />
                    First minute
                  </button>
                </div>
              </div>

              {/* Stars */}
              {meta.stars.length > 0 && (
                <div>
                  <p className={label}>Hvězdičky</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {meta.stars.map(s => (
                      <PillToggle key={s.stars} active={stars.includes(String(s.stars))} onClick={() => toggleStar(String(s.stars))}>
                        <span className="text-amber-400">{'★'.repeat(s.stars)}</span>
                      </PillToggle>
                    ))}
                  </div>
                </div>
              )}

              {/* Meal plan */}
              {meta.mealPlans.length > 0 && (
                <div>
                  <p className={label}>Stravování</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {meta.mealPlans.map(m => (
                      <PillToggle key={m.meal_plan} active={mealPlan.includes(m.meal_plan)} onClick={() => toggleMeal(m.meal_plan)}>
                        {MEAL_LABELS[m.meal_plan] ?? m.meal_plan}
                      </PillToggle>
                    ))}
                  </div>
                </div>
              )}

              {/* Duration */}
              {meta.durations.length > 0 && (
                <div className="min-w-[130px]">
                  <label className={label}>Délka pobytu</label>
                  <div className="relative">
                    <select value={duration} onChange={e => setDuration(e.target.value)} className={`${select} pr-8`}>
                      <option value="">Libovolná</option>
                      {meta.durations.map(d => (
                        <option key={d.duration} value={d.duration}>{d.duration} nocí</option>
                      ))}
                    </select>
                    <PiCaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Transport */}
              {(meta.transports ?? []).length > 1 && (
                <div className="min-w-[140px]">
                  <label className={label}>Doprava</label>
                  <div className="relative">
                    <select value={transport} onChange={e => setTransport(e.target.value)} className={`${select} pr-8`}>
                      <option value="">Libovolná</option>
                      {(meta.transports ?? []).map(t => (
                        <option key={t.transport} value={t.transport}>{t.transport}</option>
                      ))}
                    </select>
                    <PiCaretDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Price */}
              <div>
                <p className={label}>Cena (Kč / os.)</p>
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Od" value={minPrice}
                    onChange={e => setMinPrice(e.target.value)}
                    className="w-28 px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    min={0} step={1000} />
                  <span className="text-gray-400 text-sm">–</span>
                  <input type="number" placeholder="Do" value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    className="w-28 px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    min={0} step={1000} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-50">
            <span className="text-xs text-gray-400 font-medium">Aktivní filtry:</span>
            {chips.map((chip, i) => (
              <button key={i} type="button" onClick={chip.clear}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                {chip.label}
                <PiX className="w-3 h-3" />
              </button>
            ))}
            <button type="button" onClick={clearAll}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1 underline underline-offset-2">
              Smazat vše
            </button>
            {isPending && <PiSpinner className="w-3.5 h-3.5 text-blue-500 animate-spin ml-auto" />}
          </div>
        )}
      </div>
    </div>
  )
}
