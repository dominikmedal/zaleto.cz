'use client'

import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/ui/Icon'
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

// ─── Car card (lístek) ─────────────────────────────────────────────────────

function CarCard({ offer, fallbackUrl }: { offer: CarOffer; fallbackUrl: string }) {
  const perDay = formatPerDay(offer)
  const total = formatPrice(offer)
  const href = offer.bookUrl ?? fallbackUrl

  return (
    <a href={href} target="_blank" rel="noopener noreferrer sponsored" className="z-tk z-tk--h z-tour z-carcard">
      <div className="z-tk__in">
        <div className="z-tour__media z-carcard__media">
          {offer.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={offer.image} alt={offer.carName} loading="lazy" />
            : <Icon name="auto" size="lg" />}
          <span className="z-chip" style={{ position: 'absolute', left: 10, top: 10, background: 'var(--paper)', borderColor: 'transparent' }}>
            {offer.category || offer.sipp}
          </span>
          {offer.supplier.logo && (
            <span className="z-carcard__logo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={offer.supplier.logo} alt={offer.supplier.name} loading="lazy" />
            </span>
          )}
        </div>
        <div className="z-tour__body">
          <div className="z-kicker">
            {offer.supplier.name}{offer.supplier.rating != null ? ` · ${Number(offer.supplier.rating).toFixed(1)} / 10` : ''}
          </div>
          <h3 className="z-tour__title">{offer.carName}</h3>
          <div className="z-meta">
            {offer.seats != null && <span><Icon name="osoby" />{offer.seats} místa</span>}
            {offer.bags != null && <span><Icon name="kufr" />{offer.bags} {offer.bags === 1 ? 'kufr' : 'kufry'}</span>}
            {offer.transmission && <span>{offer.transmission}</span>}
            {offer.ac && <span>Klima</span>}
            {offer.fuelPolicy && <span><Icon name="fuel" />{offer.fuelPolicy}</span>}
          </div>
        </div>
        <div className="z-tour__stub">
          <div>
            <span className="z-price__note">{perDay ?? 'celkem za pronájem'}</span>
            <span className="z-price">{total}</span>
          </div>
          <span className="z-round" style={{ width: 52, height: 52 }} aria-hidden="true"><Icon name="sipka" /></span>
        </div>
      </div>
    </a>
  )
}

function SkeletonCard() {
  return (
    <div className="z-tk z-tk--h z-tour" aria-hidden="true">
      <div className="z-tk__in">
        <div className="z-tour__media z-skel" />
        <div className="z-tour__body">
          <div className="z-skel" style={{ height: 12, width: '40%' }} />
          <div className="z-skel" style={{ height: 22, width: '75%' }} />
          <div className="z-skel" style={{ height: 14, width: '60%' }} />
        </div>
        <div className="z-tour__stub"><div className="z-skel" style={{ height: 30, width: 120 }} /></div>
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
      <div className="z-clear">
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="Letiště nebo město"
          autoComplete="off"
          aria-label="Místo"
        />
        {loading
          ? <Icon name="spinner" size="sm" className="animate-spin" />
          : value && (
            <button type="button" aria-label="Smazat" onClick={() => { onChange(''); setSuggestions([]); setOpen(false) }}>
              <Icon name="zavrit" size="sm" />
            </button>
          )}
      </div>

      {open && suggestions.length > 0 && dropPos && typeof document !== 'undefined' && createPortal(
        <div className="z-suggest" style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: Math.max(dropPos.width, 280), zIndex: 9999 }}>
          {suggestions.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => handleSelect(s)}>
              <b>{s.place || s.location}</b>
              <small>{s.city}{s.city !== s.country ? ` · ${s.country}` : ''}</small>
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
  sameLocation: boolean; setSameLocation: (v: boolean) => void
  dropoffLocText: string; setDropoffLocText: (v: string) => void
  dropoffLocSel: { placeID: number; searchTerm: string; label: string } | null
  setDropoffLocSel: (v: { placeID: number; searchTerm: string; label: string } | null) => void
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
  const [locText,          setLocText]          = useState('')
  const [locSel,           setLocSel]           = useState<{ placeID: number; searchTerm: string; label: string } | null>(null)
  const [sameLocation,     setSameLocation]     = useState(true)
  const [dropoffLocText,   setDropoffLocText]   = useState('')
  const [dropoffLocSel,    setDropoffLocSel]    = useState<{ placeID: number; searchTerm: string; label: string } | null>(null)
  const [status,           setStatus]           = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [cars,        setCars]        = useState<CarOffer[]>([])
  const [locInfo,     setLocInfo]     = useState<string | null>(null)
  const [placeID,     setPlaceID]     = useState<number | null>(null)
  const [activecat,   setActivecat]   = useState<string | null>(null)
  const searchedRef = useRef(false)

  const doSearch = useCallback(async (pickup: string, dropoff: string, age: number) => {
    const searchTerm = destination?.dcSearchTerm ?? locSel?.searchTerm
    if (!searchTerm) return
    setStatus('loading'); setCars([]); setActivecat(null)

    const dropoffSearchTerm = !sameLocation ? (dropoffLocSel?.searchTerm || undefined) : undefined
    const result = await fetchCarSearch({
      location: searchTerm, dropoffLocation: dropoffSearchTerm,
      pickupDate: pickup, dropoffDate: dropoff,
      pickupTime, dropoffTime, driverAge: age, residence: 'CZ',
    })

    if (result.error === 'location_not_found') { setStatus('error'); return }

    const sorted = [...result.cars].sort((a, b) => (a.price.total ?? Infinity) - (b.price.total ?? Infinity))
    setCars(sorted)
    setLocInfo(result.location?.place ?? result.location?.name ?? null)
    setPlaceID(result.location?.placeID ?? null)
    setStatus('done')
  }, [destination, locSel, sameLocation, dropoffLocSel, pickupTime, dropoffTime])

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
  const inputBase   = 'w-full bg-[#f0f7ff] border border-[#deeeff] rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-[#0093FF]/50 focus:ring-2 focus:ring-[#0093FF]/10 transition-all'

  return (
    <CarRentalCtx.Provider value={{
      destination, pickupDate, setPickupDate, dropoffDate, setDropoffDate,
      pickupTime, setPickupTime, dropoffTime, setDropoffTime,
      driverAge, setDriverAge, locText, setLocText, locSel, setLocSel,
      sameLocation, setSameLocation, dropoffLocText, setDropoffLocText, dropoffLocSel, setDropoffLocSel,
      status, cars, locInfo, placeID, activecat, setActivecat,
      categories, visibleCars, fallbackUrl, allUrl, canSearch, inputBase, handleSearch,
    }}>
      {children}
    </CarRentalCtx.Provider>
  )
}

// ─── Form (vyhledávací lístek) ───────────────────────────────────────────────

export function CarRentalForm({ className = '' }: { className?: string }) {
  const {
    destination, pickupDate, setPickupDate, dropoffDate, setDropoffDate,
    pickupTime, setPickupTime, dropoffTime, setDropoffTime,
    driverAge, setDriverAge, locText, setLocText, setLocSel,
    sameLocation, setSameLocation, dropoffLocText, setDropoffLocText, setDropoffLocSel,
    status, canSearch, handleSearch,
  } = useContext(CarRentalCtx)

  return (
    <div className={`z-carsearch ${className}`}>
      <div className="z-carsearch__head">
        <div className="z-kicker">{destination ? `Půjčovna aut · ${destination.country}` : 'Srovnávač půjčoven aut'}</div>
        <h2 className="h3">{destination ? destination.name : 'najdi nejlepší cenu'}<span className="z-dot">.</span></h2>
      </div>

      <div className="z-tk z-tk--v z-search" style={{ ['--stub' as string]: '112px' }}>
        <div className="z-tk__in z-carform">
          {!destination && (
            <div className="z-sfield z-sfield--wide">
              <span className="z-sfield__label"><Icon name="poloha" />Místo vyzvednutí</span>
              <LocationInput
                value={locText}
                onChange={setLocText}
                onSelect={s => setLocSel({ placeID: s.placeID, searchTerm: s.place || s.location, label: s.place || s.location })}
              />
              <span className="z-sfield__sub">letiště, město</span>
            </div>
          )}

          <div className="z-sfield z-sfield--wide z-picker">
            <span className="z-sfield__label"><Icon name="kalendar" />Termín</span>
            <DateRangePicker
              dateFrom={pickupDate} dateTo={dropoffDate}
              onDateFromChange={setPickupDate} onDateToChange={setDropoffDate}
              noLabel noPrices
            />
            <span className="z-sfield__sub">vyzvednutí → vrácení</span>
          </div>

          <div className="z-sfield">
            <span className="z-sfield__label"><Icon name="cas" />Čas</span>
            <div className="z-timepair">
              <select value={pickupTime} onChange={e => setPickupTime(e.target.value)} aria-label="Čas vyzvednutí">
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span aria-hidden="true">→</span>
              <select value={dropoffTime} onChange={e => setDropoffTime(e.target.value)} aria-label="Čas vrácení">
                {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <label className="z-sfield" style={{ maxWidth: 130 }}>
            <span className="z-sfield__label"><Icon name="ucet" />Věk</span>
            <input type="number" value={driverAge} min={18} max={99} onChange={e => setDriverAge(Number(e.target.value))} />
            <span className="z-sfield__sub">let</span>
          </label>

          <div className="z-search__go">
            <button type="button" className="z-round" onClick={handleSearch} disabled={status === 'loading' || !canSearch} aria-label="Hledat auta">
              {status === 'loading' ? <Icon name="spinner" className="animate-spin" /> : <Icon name="hledat" />}
            </button>
          </div>
        </div>
      </div>

      <div className="z-return">
        <label className="z-switch">
          <input
            type="checkbox"
            role="switch"
            checked={sameLocation}
            onChange={e => {
              setSameLocation(e.target.checked)
              if (e.target.checked) { setDropoffLocText(''); setDropoffLocSel(null) }
            }}
          />
          <span className="z-switch__track" aria-hidden="true"><span className="z-switch__thumb" /></span>
          <span className="z-switch__text">
            <b>Vrátit auto na stejném místě</b>
            <small>{sameLocation ? 'VYZVEDNUTÍ A VRÁCENÍ NA JEDNOM MÍSTĚ' : 'VRÁTÍM JINDE – VYPLŇ MÍSTO VRÁCENÍ'}</small>
          </span>
        </label>
        {!sameLocation && (
          <div className="z-sfield z-return__field">
            <span className="z-sfield__label"><Icon name="poloha" />Místo vrácení</span>
            <LocationInput
              value={dropoffLocText}
              onChange={setDropoffLocText}
              onSelect={s => setDropoffLocSel({ placeID: s.placeID, searchTerm: s.place || s.location, label: s.place || s.location })}
            />
            <span className="z-sfield__sub">letiště, město</span>
          </div>
        )}
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
          <div className="z-roadload" role="status">
            <div className="z-roadload__track">
              <span className="z-roadload__car"><Icon name="auto" size="lg" /></span>
            </div>
            <p className="h4" style={{ margin: 0 }}>hledám nejlepší nabídky<span className="z-dot">.</span></p>
            <p className="z-data" style={{ margin: 0 }}>MŮŽE TRVAT AŽ 10 VTEŘIN</p>
          </div>
          <div className="z-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="z-info"><h3 className="z-info__title">lokaci jsme nenašli<span className="z-dot">.</span></h3>
          <p style={{ margin: 'var(--space-3) 0 0' }}>Zkus zadat jiný název letiště nebo města.</p></div>
      )}

      {status === 'done' && cars.length === 0 && (
        <div className="z-info"><h3 className="z-info__title">pro tyto termíny nic není<span className="z-dot">.</span></h3>
          <p style={{ margin: 'var(--space-3) 0 0' }}>
            Zkus jiné datum, nebo hledej přímo na{' '}
            <a href={allUrl} target="_blank" rel="noopener noreferrer sponsored">DiscoverCars.com</a>.
          </p></div>
      )}

      {status === 'done' && cars.length > 0 && (
        <div>
          <div className="z-shead" style={{ marginBottom: 'var(--space-5)' }}>
            <div>
              <div className="z-kicker">{visibleCars.length} nabídek{locInfo ? ` — ${locInfo}` : ''}{activecat ? ` · ${activecat}` : ''}</div>
              <div className="z-data" style={{ marginTop: 6 }}>{pickupDate} → {dropoffDate} · ŘIDIČ {driverAge} LET · OD NEJLEVNĚJŠÍHO</div>
            </div>
          </div>

          {categories.length > 1 && (
            <div className="z-chips" style={{ marginBottom: 'var(--space-5)' }}>
              <button type="button" onClick={() => setActivecat(null)} className="z-chip" aria-pressed={activecat === null}
                style={activecat === null ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                Vše ({cars.length})
              </button>
              {categories.map(cat => (
                <button key={cat} type="button" onClick={() => setActivecat(activecat === cat ? null : cat)} className="z-chip" aria-pressed={activecat === cat}
                  style={activecat === cat ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}>
                  {cat} ({cars.filter(c => c.category === cat).length})
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-5)', alignItems: 'stretch' }}>
            {visibleCars.map((car, i) => <CarCard key={car.offerHash ?? i} offer={car} fallbackUrl={fallbackUrl} />)}
          </div>

          <p className="z-data" style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icon name="info" size="sm" />
            Ceny zahrnují základní pojištění (CDW). Finální cena se potvrdí při rezervaci na DiscoverCars.com.
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
        <CarRentalResults className="z-carresults" />
      </div>
    </CarRentalProvider>
  )
}
