'use client'
import { useState, useEffect, useCallback } from 'react'
import Icon from '@/components/ui/Icon'
import DateRangePicker from '@/components/DateRangePicker'
import type { Tour } from '@/lib/types'
import { API } from '@/lib/api'

function TourSkeleton() {
  return (
    <div className="z-tk z-tk--v z-dateticket" aria-hidden="true">
      <div className="z-tk__in z-dateticket__in">
        <div className="z-dateticket__main">
          <div className="z-skel" style={{ height: 26, width: '55%' }} />
          <div className="z-skel" style={{ height: 14, width: '70%', marginTop: 12 }} />
        </div>
        <div className="z-dateticket__stub"><div className="z-skel" style={{ height: 30, width: 110 }} /></div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 40

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
  if (tour.url)    params.set('tour_url', tour.url)
  if (tour.agency) params.set('agency',   tour.agency)
  return `${API}/api/redirect/${slug}?${params}`
}

function isFlying(transport: string | null): boolean {
  if (!transport) return false
  const t = transport.toLowerCase()
  return t.includes('leteck') || /[A-Z]{3}[→>-][A-Z]{3}/.test(transport)
}

function transportLabel(transport: string | null): string {
  if (!transport) return 'Doprava nespecifikována'
  const t = transport.toLowerCase()
  if (t.includes('autobus')) return 'Autobusem'
  if (t.includes('vlak'))    return 'Vlakem'
  if (t.includes('vlastní') || t.includes('vlastni')) return 'Vlastní dopravou'
  if (t.includes('leteck'))  return 'Letecky'
  return transport
}

function TransportIcon({ transport }: { transport: string | null }) {
  const t = (transport ?? '').toLowerCase()
  if (t.includes('autobus') || t.includes('vlak')) return <Icon name="bus" />
  if (t.includes('vlastní') || t.includes('vlastni')) return <Icon name="auto" />
  return <Icon name="letadlo" />
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
    <a href={bookingUrl(slug, tour, adults)} target="_blank" rel="noopener noreferrer sponsored" className="z-tk z-tk--v z-dateticket">
      <div className="z-tk__in z-dateticket__in">
        <div className="z-dateticket__main">
          {isFlying(tour.transport) && depIata ? (
            <div className="z-route">
              <span>{depIata}<small>{depCityName}</small></span>
              <span className="z-route__line"><Icon name="letadlo" /></span>
              <span style={{ textAlign: 'right' }}>{arrIata ?? '—'}<small>{arrCity}</small></span>
            </div>
          ) : (
            <div className="z-meta" style={{ fontSize: 15, color: 'var(--ink)' }}>
              <span><TransportIcon transport={tour.transport} />{transportLabel(tour.transport)}</span>
              {tour.departure_city && <span>z {tour.departure_city}</span>}
            </div>
          )}
          <div className="z-meta" style={{ marginTop: 'var(--space-3)' }}>
            <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
              <Icon name="kalendar" />
              {formatDateShort(tour.departure_date)}
              {tour.return_date && <> → {formatDateShort(tour.return_date)}</>}
            </span>
            {tour.duration ? <span><Icon name="moon" />{tour.duration} nocí</span> : null}
            {tour.meal_plan ? <span><Icon name="jidlo" />{tour.meal_plan}</span> : null}
            {tour.agency ? <span className="z-chip" style={{ height: 24 }}>{tour.agency}</span> : null}
          </div>
        </div>

        <div className="z-dateticket__stub">
          <div>
            <span className="z-price__note">za osobu</span>
            <span className="z-price">{formatPrice(tour.price)}</span>
            {adults > 1 && <span className="z-price__note">celkem {formatPrice(tour.price * adults)}</span>}
          </div>
          <span className="z-btn z-btn--primary z-btn--sm z-dateticket__cta">Rezervovat<span className="z-btn__go"><Icon name="sipka" /></span></span>
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

export default function TourDatesList({ slug }: { slug: string }) {
  const [tours,      setTours]      = useState<Tour[]>([])
  const [loading,    setLoading]    = useState(true)
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

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    setLoading(true)
    fetch(`${API}/api/hotels/${slug}/tours?limit=300&sort=date_asc`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : { tours: [] })
      .then(data => setTours(data.tours ?? []))
      .catch(() => setTours([]))
      .finally(() => { clearTimeout(timer); setLoading(false) })
    return () => { controller.abort(); clearTimeout(timer) }
  }, [slug])

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

  const hasActiveFilters = cityFilter.length > 0 || dateFrom || dateTo

  if (loading) {
    return (
      <div className="z-datelist">
        {Array.from({ length: 4 }).map((_, i) => <TourSkeleton key={i} />)}
      </div>
    )
  }

  if (tours.length === 0) {
    return (
      <div className="z-info">
        <h3 className="z-info__title">žádné dostupné termíny<span className="z-dot">.</span></h3>
        <p style={{ margin: 'var(--space-3) 0 0' }}>Zkus se podívat později, termíny se pravidelně aktualizují.</p>
      </div>
    )
  }

  const resetFilters = () => { setCityFilter([]); setDateFrom(''); setDateTo('') }

  return (
    <div>
      <div className="z-datefilters">
        <div className="z-seg" role="group" aria-label="Řazení">
          {(['date_asc', 'price_asc'] as const).map(opt => (
            <button key={opt} type="button" onClick={() => setSortBy(opt)} aria-pressed={sortBy === opt}>
              {opt === 'date_asc' ? 'Podle data' : 'Podle ceny'}
            </button>
          ))}
        </div>

        <div className="z-stepper" role="group" aria-label="Počet cestujících">
          <button type="button" onClick={() => setAdults(a => Math.max(1, a - 1))} disabled={adults <= 1} aria-label="Méně osob"><Icon name="minus" size="sm" /></button>
          <span><Icon name="osoby" size="sm" />{adults}&nbsp;os.</span>
          <button type="button" onClick={() => setAdults(a => Math.min(6, a + 1))} disabled={adults >= 6} aria-label="Více osob"><Icon name="plus" size="sm" /></button>
        </div>

        <div className="z-datepair">
          <Icon name="kalendar" size="sm" />
          <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onDateFromChange={setDateFrom} onDateToChange={setDateTo} noPrices placeholder="Všechny termíny" />
        </div>

        {availableCities.length > 1 && availableCities.map(city => (
          <button key={city} type="button" className="z-chip" aria-pressed={cityFilter.includes(city)}
            onClick={() => setCityFilter(p => p.includes(city) ? p.filter(x => x !== city) : [...p, city])}
            style={cityFilter.includes(city) ? { background: 'var(--ink)', color: 'var(--paper)', cursor: 'pointer' } : { cursor: 'pointer' }}>
            <Icon name="letadlo" size="sm" />{city}
          </button>
        ))}

        {hasActiveFilters && <button type="button" onClick={resetFilters} className="z-more" style={{ background: 'none', border: 0, cursor: 'pointer' }}>Zrušit filtry</button>}

        {filtered.length !== tours.length && (
          <span className="z-data" style={{ marginLeft: 'auto' }}>{filtered.length} / {tours.length}</span>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="z-info">
          <h3 className="z-info__title">žádný termín neodpovídá<span className="z-dot">.</span></h3>
          <p style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>Zkus rozšířit data nebo zrušit filtr města.</p>
          <button type="button" className="z-btn z-btn--line z-btn--sm" onClick={resetFilters}>Zrušit filtry</button>
        </div>
      )}

      <div className="z-datelist">
        {visible.map(tour => <TourTicket key={tour.id} tour={tour} slug={slug} adults={adults} />)}
      </div>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-5) 0' }}>
          <button type="button" className="z-btn z-btn--line" onClick={loadMore}>
            Načíst dalších {Math.min(PAGE_SIZE, filtered.length - visible.length)} termínů · zbývá {filtered.length - visible.length}
          </button>
        </div>
      )}
      {!hasMore && visible.length > PAGE_SIZE && <p className="z-data" style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>ZOBRAZENY VŠECHNY TERMÍNY</p>}

      <p className="z-data" style={{ marginTop: 'var(--space-3)', textTransform: 'none' }}>
        Ceny jsou orientační a pochází z pravidelného stahování dat. Aktuální cena se upřesní na webu cestovní kanceláře.
      </p>
    </div>
  )
}
