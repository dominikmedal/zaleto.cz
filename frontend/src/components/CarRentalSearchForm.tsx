'use client'

import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { Car, User, Search, Loader2, AlertCircle, Star, Users, Briefcase, Fuel, Info, ExternalLink, MapPin, X, Clock } from 'lucide-react'
import { buildDCUrlById, buildDCHubUrl, type CarDestination } from '@/lib/carRental'
import { fetchCarSearch, fetchCarAutocomplete, type CarOffer } from '@/lib/api'
import DateRangePicker from '@/components/DateRangePicker'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function formatPrice(offer: CarOffer): string {
  if (offer.price.formatted) return offer.price.formatted
  if (offer.price.total != null) return `${offer.price.total.toLocaleString('cs-CZ')} ${offer.price.currency}`
  return '—'
}

function formatPerDay(offer: CarOffer): string | null {
  if (offer.price.perDay != null) return `${Math.round(offer.price.perDay)} ${offer.price.currency}/den`
  return null
}

// ─── Car card ─────────────────────────────────────────────────────────────────

function CarCard({ offer, fallbackUrl }: { offer: CarOffer; fallbackUrl: string }) {
  const perDay  = formatPerDay(offer)
  const total   = formatPrice(offer)
  const href    = offer.bookUrl ?? fallbackUrl

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
      <div className="relative h-36 bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center overflow-hidden">
        {offer.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.image} alt={offer.carName} className="object-contain w-full h-full p-3" loading="lazy" />
        ) : (
          <Car className="w-16 h-16 text-blue-200" />
        )}
        <span className="absolute top-2 left-2 glass-pill text-[10px] font-bold uppercase tracking-wide text-[#0068CC] px-2 py-0.5 rounded-full">
          {offer.category || offer.sipp}
        </span>
        {offer.supplier.logo && (
          <div className="absolute top-2 right-2 h-6 bg-white/90 rounded px-1.5 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={offer.supplier.logo} alt={offer.supplier.name} style={{ height: '18px', width: 'auto', maxWidth: '60px' }} loading="lazy" />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-3">
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">{offer.carName}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
            {offer.supplier.name}
            {offer.supplier.rating != null && (
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <Star className="w-3 h-3 fill-current" />
                {Number(offer.supplier.rating).toFixed(1)}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
          {offer.seats != null && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{offer.seats} místa</span>}
          {offer.bags  != null && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{offer.bags} kufr{offer.bags > 1 ? 'y' : ''}</span>}
          {offer.transmission && <span className="capitalize">{offer.transmission}</span>}
          {offer.ac && <span>Klima</span>}
          {offer.fuelPolicy && <span className="flex items-center gap-1"><Fuel className="w-3 h-3" />{offer.fuelPolicy}</span>}
        </div>

        <div className="mt-auto pt-3 border-t border-[#0093FF]/08 flex items-end justify-between gap-2">
          <div>
            {perDay && <p className="text-[11px] text-gray-400">{perDay}</p>}
            <p className="text-base font-bold text-[#049669] leading-tight">{total}</p>
            <p className="text-[10px] text-gray-400">celkem za pronájem</p>
          </div>
          <a href={href} target="_blank" rel="noopener noreferrer sponsored" className="btn-cta text-xs px-4 py-2 flex-shrink-0">
            Rezervovat
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden animate-pulse">
      <div className="h-36 bg-blue-50/60" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-3 bg-gray-100 rounded w-16" />
          <div className="h-3 bg-gray-100 rounded w-14" />
        </div>
        <div className="pt-3 border-t border-gray-100 flex justify-between items-end">
          <div className="space-y-1">
            <div className="h-3 bg-gray-100 rounded w-20" />
            <div className="h-5 bg-gray-200 rounded w-24" />
          </div>
          <div className="h-8 bg-blue-100 rounded-xl w-24" />
        </div>
      </div>
    </div>
  )
}

// ─── Location autocomplete ─────────────────────────────────────────────────────

interface LocSuggestion {
  location: string; place: string; city: string; country: string
  countryID: number; cityID: number; placeID: number; type: string
}

function LocationInput({
  value, onChange, onSelect,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (s: LocSuggestion) => void
}) {
  const [suggestions, setSuggestions] = useState<LocSuggestion[]>([])
  const [open, setOpen]               = useState(false)
  const [loading, setLoading]         = useState(false)
  const [dropPos, setDropPos]         = useState<{ top: number; left: number; width: number } | null>(null)
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef   = useRef<HTMLDivElement>(null)

  const calcDropPos = useCallback(() => {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', calcDropPos, true)
    window.addEventListener('resize', calcDropPos)
    return () => {
      window.removeEventListener('scroll', calcDropPos, true)
      window.removeEventListener('resize', calcDropPos)
    }
  }, [open, calcDropPos])

  const handleChange = (v: string) => {
    onChange(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (v.trim().length < 2) { setSuggestions([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      const res = await fetchCarAutocomplete(v)
      setSuggestions(res)
      if (res.length > 0) { calcDropPos(); setOpen(true) } else { setOpen(false) }
      setLoading(false)
    }, 300)
  }

  const handleSelect = (s: LocSuggestion) => {
    onChange(s.place || s.location)
    onSelect(s)
    setSuggestions([])
    setOpen(false)
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0093FF]" />
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="Letiště nebo město…"
          className="location-input-prominent w-full rounded-xl pl-9 pr-8 py-2.5 text-sm text-gray-800 placeholder-gray-500 outline-none transition-all"
          autoComplete="off"
        />
        {loading
          ? <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
          : value && (
            <button onClick={() => { onChange(''); setSuggestions([]); setOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )
        }
      </div>

      {open && suggestions.length > 0 && dropPos && typeof document !== 'undefined' && createPortal(
        <div
          className="glass-card rounded-xl overflow-hidden shadow-xl"
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
        >
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-4 py-3 hover:bg-[#0093FF]/06 transition-colors border-b border-[#0093FF]/06 last:border-0"
            >
              <p className="text-sm font-semibold text-gray-900 leading-tight">{s.place || s.location}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{s.city}{s.city !== s.country ? ` · ${s.country}` : ''}</p>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CarRentalCtxValue {
  destination?: CarDestination
  pickupDate: string;  setPickupDate: (v: string) => void
  dropoffDate: string; setDropoffDate: (v: string) => void
  pickupTime: string;  setPickupTime: (v: string) => void
  dropoffTime: string; setDropoffTime: (v: string) => void
  driverAge: number;   setDriverAge: (v: number) => void
  locText: string;     setLocText: (v: string) => void
  locSel: { placeID: number; searchTerm: string; label: string } | null
  setLocSel: (v: { placeID: number; searchTerm: string; label: string } | null) => void
  status: 'idle' | 'loading' | 'done' | 'error'
  cars: CarOffer[]
  locInfo: string | null
  placeID: number | null
  activecat: string | null; setActivecat: (v: string | null) => void
  categories: string[]
  visibleCars: CarOffer[]
  fallbackUrl: string
  allUrl: string
  canSearch: boolean
  inputBase: string
  handleSearch: () => void
}

const CarRentalCtx = createContext<CarRentalCtxValue>(null!)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CarRentalProvider({ destination, children }: { destination?: CarDestination; children: React.ReactNode }) {
  const [pickupDate,  setPickupDate]  = useState(todayPlus(30))
  const [dropoffDate, setDropoffDate] = useState(todayPlus(37))
  const [pickupTime,  setPickupTime]  = useState('12:00')
  const [dropoffTime, setDropoffTime] = useState('12:00')
  const [driverAge,   setDriverAge]   = useState(30)
  const [locText,     setLocText]     = useState('')
  const [locSel,      setLocSel]      = useState<{ placeID: number; searchTerm: string; label: string } | null>(null)
  const [status,      setStatus]      = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [cars,        setCars]        = useState<CarOffer[]>([])
  const [locInfo,     setLocInfo]     = useState<string | null>(null)
  const [placeID,     setPlaceID]     = useState<number | null>(null)
  const [activecat,   setActivecat]   = useState<string | null>(null)
  const searchedRef = useRef(false)

  const doSearch = useCallback(async (pickup: string, dropoff: string, age: number) => {
    const searchTerm = destination?.dcSearchTerm ?? locSel?.searchTerm
    if (!searchTerm) return
    setStatus('loading'); setCars([]); setActivecat(null)

    const result = await fetchCarSearch({
      location: searchTerm, pickupDate: pickup, dropoffDate: dropoff,
      pickupTime, dropoffTime, driverAge: age, residence: 'CZ',
    })

    if (result.error === 'location_not_found') { setStatus('error'); return }

    const sorted = [...result.cars].sort((a, b) => (a.price.total ?? Infinity) - (b.price.total ?? Infinity))
    setCars(sorted)
    setLocInfo(result.location?.place ?? result.location?.name ?? null)
    setPlaceID(result.location?.placeID ?? null)
    setStatus('done')
  }, [destination, locSel, pickupTime, dropoffTime])

  useEffect(() => {
    if (!destination || searchedRef.current) return
    searchedRef.current = true
    doSearch(pickupDate, dropoffDate, driverAge)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination])

  const handleSearch = () => {
    if (!destination && !locSel) return
    searchedRef.current = true
    doSearch(pickupDate, dropoffDate, driverAge)
  }

  const categories  = Array.from(new Set(cars.map(c => c.category).filter(Boolean))) as string[]
  const visibleCars = activecat ? cars.filter(c => c.category === activecat) : cars
  const fallbackUrl = placeID ? buildDCUrlById({ placeID, pickupDate, dropoffDate, pickupTime, dropoffTime, driverAge }) : buildDCHubUrl()
  const allUrl      = fallbackUrl
  const canSearch   = !!(destination || locSel)
  const inputBase   = 'w-full bg-white/70 border border-white/80 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#0093FF]/50 focus:ring-2 focus:ring-[#0093FF]/10 transition-all'

  return (
    <CarRentalCtx.Provider value={{
      destination, pickupDate, setPickupDate, dropoffDate, setDropoffDate,
      pickupTime, setPickupTime, dropoffTime, setDropoffTime,
      driverAge, setDriverAge, locText, setLocText, locSel, setLocSel,
      status, cars, locInfo, placeID, activecat, setActivecat,
      categories, visibleCars, fallbackUrl, allUrl, canSearch, inputBase, handleSearch,
    }}>
      {children}
    </CarRentalCtx.Provider>
  )
}

// ─── Form (search inputs only) ────────────────────────────────────────────────

export function CarRentalForm({ className = '' }: { className?: string }) {
  const {
    destination, pickupDate, setPickupDate, dropoffDate, setDropoffDate,
    pickupTime, setPickupTime, dropoffTime, setDropoffTime,
    driverAge, setDriverAge, locText, setLocText, setLocSel,
    status, canSearch, inputBase, handleSearch,
  } = useContext(CarRentalCtx)

  return (
    <div
      className={`section-island ${className}`}
      style={{
        borderTop: '3px solid rgba(0,147,255,0.35)',
        boxShadow: '0 8px 48px rgba(0,147,255,0.13), 0 2px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)', boxShadow: '0 4px 14px rgba(0,147,255,0.30)' }}
        >
          <Car className="w-5 h-5 text-white" />
        </div>
        <div>
          {destination ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0093FF]">Půjčovna aut · {destination.country}</p>
              <p className="font-bold text-gray-900 text-base leading-tight">{destination.name}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0093FF]">Srovnávač půjčoven aut</p>
              <p className="font-bold text-gray-900 text-base leading-tight">Najděte nejlepší cenu</p>
            </>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-col lg:flex-row gap-3 items-end">
        {!destination && (
          <div className="w-full lg:flex-[2] min-w-0">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1 block">
              <MapPin className="w-3 h-3" /> Místo vyzvednutí
            </label>
            <LocationInput
              value={locText}
              onChange={setLocText}
              onSelect={s => setLocSel({ placeID: s.placeID, searchTerm: s.place || s.location, label: s.place || s.location })}
            />
          </div>
        )}

        <div className={`w-full min-w-0 ${destination ? 'lg:flex-[2]' : 'lg:flex-[1.5]'}`}>
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">Termín</label>
          <DateRangePicker
            dateFrom={pickupDate} dateTo={dropoffDate}
            onDateFromChange={setPickupDate} onDateToChange={setDropoffDate}
            noLabel noPrices
          />
        </div>

        <div className="w-full lg:w-44 flex-shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1 block">
            <Clock className="w-3 h-3" /> Čas
          </label>
          <div className="flex items-center gap-1.5">
            <select value={pickupTime} onChange={e => setPickupTime(e.target.value)} title="Čas vyzvednutí"
              className="flex-1 bg-white/70 border border-white/80 rounded-xl px-2 py-2.5 text-sm text-gray-700 outline-none focus:border-[#0093FF]/50 focus:ring-2 focus:ring-[#0093FF]/10 transition-all cursor-pointer">
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-gray-300 text-xs font-medium flex-shrink-0">→</span>
            <select value={dropoffTime} onChange={e => setDropoffTime(e.target.value)} title="Čas vrácení"
              className="flex-1 bg-white/70 border border-white/80 rounded-xl px-2 py-2.5 text-sm text-gray-700 outline-none focus:border-[#0093FF]/50 focus:ring-2 focus:ring-[#0093FF]/10 transition-all cursor-pointer">
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="w-full lg:w-24 flex-shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1 block">
            <User className="w-3 h-3" /> Věk
          </label>
          <div className="relative">
            <input type="number" value={driverAge} min={18} max={99}
              onChange={e => setDriverAge(Number(e.target.value))} className={inputBase} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">let</span>
          </div>
        </div>

        <div className="w-full lg:w-auto flex-shrink-0">
          <button onClick={handleSearch} disabled={status === 'loading' || !canSearch}
            className="btn-cta w-full lg:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed px-7"
            style={{ paddingTop: '11px', paddingBottom: '11px' }}>
            {status === 'loading'
              ? <><Loader2 className="w-4 h-4 animate-spin" />Hledám…</>
              : <><Search className="w-4 h-4" />Hledat auta</>}
          </button>
        </div>
      </div>


    </div>
  )
}

// ─── Results ─────────────────────────────────────────────────────────────────

export function CarRentalResults({ className = '' }: { className?: string }) {
  const { status, cars, visibleCars, categories, activecat, setActivecat, locInfo, pickupDate, dropoffDate, driverAge, allUrl, fallbackUrl } = useContext(CarRentalCtx)

  if (status === 'idle') return null

  return (
    <div className={className}>
      {status === 'loading' && (
        <div>
          {/* Car driving animation */}
          <div className="flex flex-col items-center py-10 mb-6">
            <div className="relative w-72 h-16 mb-4">
              {/* Road surface */}
              <div
                className="absolute inset-x-0 bottom-0 h-9 rounded-2xl"
                style={{ background: 'rgba(0,147,255,0.04)', border: '1px solid rgba(0,147,255,0.09)' }}
              />
              {/* Scrolling road markings */}
              <div className="absolute bottom-3.5 inset-x-0 overflow-hidden h-1.5">
                <div className="flex gap-3 animate-road-scroll w-[200%]">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="flex-none w-8 h-px bg-[#0093FF]/18 rounded-full" />
                  ))}
                </div>
              </div>
              {/* Car — bouncing */}
              <div className="absolute bottom-4 left-1/2 animate-car-bounce">
                <svg viewBox="0 0 56 28" className="w-14 h-7" fill="none">
                  {/* Body */}
                  <rect x="4" y="10" width="48" height="13" rx="4" fill="#0093FF" opacity="0.9" />
                  {/* Roof */}
                  <path d="M14 10 L18 2 L38 2 L42 10Z" fill="#0070E0" opacity="0.9" />
                  {/* Windows */}
                  <path d="M19.5 3.5 L17 9h8V3.5Z" fill="rgba(255,255,255,0.55)" rx="1" />
                  <rect x="27" y="3.5" width="10" height="5.5" rx="1" fill="rgba(255,255,255,0.55)" />
                  {/* Wheels */}
                  <circle cx="15" cy="23" r="4.5" fill="#1a2a4a" />
                  <circle cx="15" cy="23" r="2" fill="#6b8fc4" />
                  <circle cx="41" cy="23" r="4.5" fill="#1a2a4a" />
                  <circle cx="41" cy="23" r="2" fill="#6b8fc4" />
                  {/* Headlight */}
                  <rect x="50" y="14" width="3" height="4" rx="1" fill="rgba(255,220,100,0.85)" />
                  {/* Taillight */}
                  <rect x="3" y="14" width="3" height="4" rx="1" fill="rgba(255,80,80,0.7)" />
                </svg>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-700">Hledám nejlepší nabídky…</p>
            <p className="text-xs text-gray-400 mt-1">může trvat až 10 vteřin</p>
          </div>
          {/* Skeleton cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="section-island flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Lokaci se nepodařilo najít</p>
            <p className="text-sm text-gray-500 mt-1">
              Zkuste zadat jiný název nebo hledejte přímo na{' '}
              <a href={buildDCHubUrl()} target="_blank" rel="noopener noreferrer sponsored" className="text-[#0093FF] hover:underline">DiscoverCars.com</a>.
            </p>
          </div>
        </div>
      )}

      {status === 'done' && cars.length === 0 && (
        <div className="section-island flex items-start gap-3">
          <Info className="w-5 h-5 text-[#0093FF] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Pro tyto termíny nejsou k dispozici žádné nabídky</p>
            <p className="text-sm text-gray-500 mt-1">
              Zkuste jiné datum nebo hledejte na{' '}
              <a href={allUrl} target="_blank" rel="noopener noreferrer sponsored" className="text-[#0093FF] hover:underline">DiscoverCars.com</a>.
            </p>
          </div>
        </div>
      )}

      {status === 'done' && cars.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {visibleCars.length} nabídek{locInfo ? ` — ${locInfo}` : ''}
                {activecat && <span className="text-gray-400 font-normal"> · {activecat}</span>}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pickupDate} → {dropoffDate} · řidič {driverAge} let · seřazeno od nejlevnějšího
              </p>
            </div>
          </div>

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5">
              <button onClick={() => setActivecat(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  activecat === null ? 'bg-[#0093FF] text-white border-[#0093FF]' : 'bg-white/70 text-gray-600 border-white/80 hover:border-[#0093FF]/40 hover:text-[#0093FF]'
                }`}>
                Vše ({cars.length})
              </button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setActivecat(activecat === cat ? null : cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activecat === cat ? 'bg-[#0093FF] text-white border-[#0093FF]' : 'bg-white/70 text-gray-600 border-white/80 hover:border-[#0093FF]/40 hover:text-[#0093FF]'
                  }`}>
                  {cat} ({cars.filter(c => c.category === cat).length})
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleCars.map((car, i) => (
              <CarCard key={car.offerHash ?? i} offer={car} fallbackUrl={fallbackUrl} />
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            Ceny zahrnují základní pojištění (CDW). Finální cena potvrzena při rezervaci na DiscoverCars.com.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Default export — destination pages (form + results together) ─────────────

interface Props {
  destination?: CarDestination
  className?: string
}

export default function CarRentalSearchForm({ destination, className = '' }: Props) {
  return (
    <CarRentalProvider destination={destination}>
      <div className={className}>
        <CarRentalForm />
        <CarRentalResults className="mt-6" />
      </div>
    </CarRentalProvider>
  )
}
