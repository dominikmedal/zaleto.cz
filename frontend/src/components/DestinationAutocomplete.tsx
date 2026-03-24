'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check, Globe, Hotel } from 'lucide-react'
import { PiMagnifyingGlass, PiSpinner } from 'react-icons/pi'
import { fetchHotelSearch } from '@/lib/api'

const PLACEHOLDER_CYCLE = [
  'Vyhledat destinaci…',
  'Zkuste Egypt…',
  'Zkuste Řecko…',
  'Zkuste Turecko…',
  'Zkuste Španělsko…',
  'Zkuste Thajsko…',
  'Zkuste Maledivy…',
  'Zkuste Dubaj…',
  'Zkuste Chorvatsko…',
]

interface DestRow {
  country: string
  destination: string
  resort_town: string | null
  hotel_count: number
}

interface Props {
  destinations: DestRow[]
  value: string[]
  onChange: (value: string[]) => void
  noLabel?: boolean
  defaultOpen?: boolean
  loading?: boolean
}

const COUNTRY_FLAGS: Record<string, string> = {
  'Španělsko': '🇪🇸', 'Řecko': '🇬🇷', 'Turecko': '🇹🇷', 'Egypt': '🇪🇬',
  'Tunisko': '🇹🇳', 'Chorvatsko': '🇭🇷', 'Itálie': '🇮🇹', 'Kypr': '🇨🇾',
  'Portugalsko': '🇵🇹', 'Bulharsko': '🇧🇬', 'Maroko': '🇲🇦', 'Thajsko': '🇹🇭',
  'Maldivky': '🇲🇻', 'Dubaj': '🇦🇪', 'Mexiko': '🇲🇽', 'Malta': '🇲🇹',
  'Dominikánská republika': '🇩🇴', 'Francie': '🇫🇷',
}
const getFlag = (c: string) => COUNTRY_FLAGS[c] ?? '🌍'

interface Resort { label: string; count: number }
interface Dest   { label: string; count: number; resorts: Resort[] }
interface Country{ label: string; flag: string; destinations: Dest[] }

interface Item {
  value: string
  label: string
  level: 'country' | 'destination' | 'resort'
  country: string
  destination: string
  count: number
  flag?: string
}

function parseRegion(destination: string): string {
  const parts = destination.split('/').map(s => s.trim())
  return parts.length >= 2 ? parts[1] : parts[0]
}

function buildHierarchy(rows: DestRow[]): Country[] {
  const cm = new Map<string, Map<string, { count: number; resorts: Map<string, number> }>>()

  for (const r of rows) {
    const region = parseRegion(r.destination)
    if (!cm.has(r.country)) cm.set(r.country, new Map())
    const dm = cm.get(r.country)!
    if (!dm.has(region)) dm.set(region, { count: 0, resorts: new Map() })
    const de = dm.get(region)!
    de.count += r.hotel_count
    const resort = r.resort_town ?? (r.destination.split('/').length >= 3 ? r.destination.split('/')[2].trim() : null)
    if (resort && resort !== region) {
      de.resorts.set(resort, (de.resorts.get(resort) || 0) + r.hotel_count)
    }
  }

  return Array.from(cm.entries())
    .map(([country, dm]) => ({
      label: country,
      flag: getFlag(country),
      destinations: Array.from(dm.entries())
        .map(([region, { count, resorts }]) => ({
          label: region,
          count,
          resorts: Array.from(resorts.entries())
            .map(([l, c]) => ({ label: l, count: c }))
            .sort((a, b) => b.count - a.count),
        }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => {
      const aCount = a.destinations.reduce((s, d) => s + d.count, 0)
      const bCount = b.destinations.reduce((s, d) => s + d.count, 0)
      return bCount - aCount
    })
}

function buildFlatItems(hierarchy: Country[]): Item[] {
  const out: Item[] = []
  for (const c of hierarchy) {
    const countryTotal = c.destinations.reduce((s, d) => s + d.count, 0)
    out.push({ value: c.label, label: c.label, level: 'country', country: c.label, destination: '', count: countryTotal, flag: c.flag })
    for (const d of c.destinations) {
      out.push({ value: d.label, label: d.label, level: 'destination', country: c.label, destination: d.label, count: d.count })
      for (const r of d.resorts) {
        out.push({ value: r.label, label: r.label, level: 'resort', country: c.label, destination: d.label, count: r.count })
      }
    }
  }
  return out
}

interface HotelResult {
  slug: string; name: string; country: string; resort_town: string | null; stars: number | null; thumbnail_url: string | null
}

export default function DestinationAutocomplete({ destinations, value, onChange, noLabel, defaultOpen, loading }: Props) {
  const router = useRouter()
  const [query,        setQuery]        = useState('')
  const [open,         setOpen]         = useState(false)
  const [highlighted,  setHighlighted]  = useState(-1)
  const [hotelResults, setHotelResults] = useState<HotelResult[]>([])
  const [phIdx,        setPhIdx]        = useState(0)
  const [phVisible,    setPhVisible]    = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)
  const listRef      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (defaultOpen) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open || query || value.length > 0) return
    const timer = setInterval(() => {
      setPhVisible(false)
      setTimeout(() => {
        setPhIdx(i => (i + 1) % PLACEHOLDER_CYCLE.length)
        setPhVisible(true)
      }, 350)
    }, 2800)
    return () => clearInterval(timer)
  }, [open, query, value.length])

  const hierarchy = useMemo(() => buildHierarchy(destinations), [destinations])
  const allItems  = useMemo(() => buildFlatItems(hierarchy), [hierarchy])

  const filtered = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allItems
    return allItems.filter(it =>
      it.label.toLowerCase().includes(q) ||
      it.country.toLowerCase().includes(q) ||
      it.destination.toLowerCase().includes(q)
    )
  }, [query, allItems])

  // Debounced hotel search
  useEffect(() => {
    if (query.trim().length < 2) { setHotelResults([]); return }
    const t = setTimeout(async () => {
      const results = await fetchHotelSearch(query)
      setHotelResults(results)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery(''); setHighlighted(-1)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-idx="${highlighted}"]`) as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlighted])

  const toggle = useCallback((val: string) => {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val])
  }, [value, onChange])

  const remove = (val: string, e: React.MouseEvent) => {
    e.stopPropagation(); onChange(value.filter(v => v !== val))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape')    { setOpen(false); setQuery(''); setHighlighted(-1) }
    if (e.key === 'Backspace' && query === '' && value.length > 0) onChange(value.slice(0, -1))
    const totalItems = filtered.length + hotelResults.length
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, totalItems - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      if (highlighted < filtered.length && filtered[highlighted]) {
        toggle(filtered[highlighted].value)
      } else {
        const hotel = hotelResults[highlighted - filtered.length]
        if (hotel) { setOpen(false); setQuery(''); router.push(`/hotel/${hotel.slug}`) }
      }
    }
  }

  const handleHotelClick = (slug: string) => {
    setOpen(false); setQuery(''); router.push(`/hotel/${slug}`)
  }

  const renderItem = (item: Item, idx: number) => {
    const selected      = value.includes(item.value)
    const isHighlighted = highlighted === idx
    const isResort      = item.level === 'resort'
    const isCountry     = item.level === 'country'

    return (
      <button
        key={`${item.level}-${item.value}`}
        data-idx={idx}
        type="button"
        onMouseDown={e => { e.preventDefault(); toggle(item.value); setQuery('') }}
        onMouseEnter={() => setHighlighted(idx)}
        className={`w-full flex items-center justify-between pr-4 transition-colors text-left ${
          isCountry ? 'py-2 pl-3' : isResort ? 'py-1.5 pl-11' : 'py-2 pl-7'
        } ${
          selected
            ? 'bg-[#008afe]/[0.06]'
            : isHighlighted
            ? 'bg-[#008afe]/[0.04]'
            : isCountry
            ? 'bg-gray-50/80 hover:bg-gray-100/60'
            : 'hover:bg-gray-50'
        }`}
      >
        <span className={`flex items-center gap-2.5 min-w-0 ${
          isCountry
            ? 'text-[10px] font-bold text-gray-400 uppercase tracking-widest'
            : isResort
            ? 'text-[13px] text-gray-500'
            : 'text-sm font-medium text-gray-700'
        }`}>
          {isCountry && <span className="text-base leading-none flex-shrink-0">{item.flag}</span>}
          {isResort && <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />}
          <span className={`truncate ${selected ? 'text-[#008afe]' : ''}`}>{item.label}</span>
          {query && isResort && (
            <span className="text-[11px] text-gray-400 font-normal flex-shrink-0">{item.destination}</span>
          )}
          {query && !isResort && !isCountry && (
            <span className="text-[11px] text-gray-400 font-normal flex-shrink-0">{item.country}</span>
          )}
        </span>
        <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ml-3 transition-all ${
          selected ? 'bg-[#008afe]' : 'border-2 border-gray-200'
        }`}>
          {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </span>
      </button>
    )
  }

  const renderHierarchy = () => {
    let idx = 0
    return hierarchy.map((country, ci) => {
      const countryTotal = country.destinations.reduce((s, d) => s + d.count, 0)
      const countryIdx = idx++
      const countryEl = renderItem(
        { value: country.label, label: country.label, level: 'country', country: country.label, destination: '', count: countryTotal, flag: country.flag },
        countryIdx
      )
      return (
        <div key={country.label} className={ci > 0 ? 'border-t border-gray-100' : ''}>
          {countryEl}
          {country.destinations.map(dest => {
            const destIdx = idx++
            const destEl = renderItem(
              { value: dest.label, label: dest.label, level: 'destination', country: country.label, destination: dest.label, count: dest.count },
              destIdx
            )
            return (
              <div key={dest.label}>
                {destEl}
                {dest.resorts.map(resort => {
                  const resortIdx = idx++
                  return renderItem(
                    { value: resort.label, label: resort.label, level: 'resort', country: country.label, destination: dest.label, count: resort.count },
                    resortIdx
                  )
                })}
              </div>
            )
          })}
        </div>
      )
    })
  }

  const showAnimatedPh = !open && query === '' && value.length === 0

  return (
    <div ref={containerRef} className="relative">
      {!noLabel && <label className="block text-xs font-medium text-gray-500 mb-1.5">Destinace</label>}

      {/* Input trigger */}
      <div
        className={`relative min-h-[42px] w-full px-2.5 py-1.5 flex flex-wrap items-center gap-1.5 border rounded-xl bg-white cursor-text transition-all duration-150 ${
          open
            ? 'border-[#008afe] ring-2 ring-[#008afe]/12 shadow-[0_0_0_4px_rgba(0,138,254,0.06)]'
            : 'border-gray-200 hover:border-[#008afe]/40'
        }`}
        onClick={() => { inputRef.current?.focus(); setOpen(true) }}
      >
        <PiMagnifyingGlass className={`w-4 h-4 flex-shrink-0 ml-0.5 transition-colors ${open ? 'text-[#008afe]' : 'text-gray-400'}`} />

        {value.map(dest => (
          <span key={dest} className="inline-flex items-center gap-1 text-xs font-medium bg-[#008afe] text-white px-2.5 py-1 rounded-lg whitespace-nowrap">
            {dest}
            <button type="button" onMouseDown={e => remove(dest, e)} className="opacity-70 hover:opacity-100 transition-opacity ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="relative flex-1 min-w-[80px] h-[22px]">
          {showAnimatedPh && (
            <span
              className="absolute inset-0 flex items-center text-sm text-gray-400 pointer-events-none select-none transition-all duration-300"
              style={{ opacity: phVisible ? 1 : 0, transform: phVisible ? 'translateY(0)' : 'translateY(-4px)' }}
            >
              {PLACEHOLDER_CYCLE[phIdx]}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder=""
            onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(-1) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 w-full text-sm outline-none bg-transparent py-0.5"
          />
        </div>

        {value.length > 0 && (
          <button type="button" onMouseDown={e => { e.preventDefault(); onChange([]) }}
            className="flex-shrink-0 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden"
          style={{ maxHeight: 360, overflowY: 'auto' }}>

          {value.length > 0 && (
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <span className="text-xs text-gray-500 font-medium">Vybráno: {value.join(', ')}</span>
              <button type="button" onMouseDown={e => { e.preventDefault(); onChange([]) }}
                className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium">
                Zrušit vše
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <PiSpinner className="w-5 h-5 text-[#008afe] animate-spin" />
              <span className="text-xs text-gray-400">Načítám destinace…</span>
            </div>
          ) : filtered.length === 0 && hotelResults.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Globe className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Žádné výsledky pro „{query}"</p>
            </div>
          ) : query ? (
            <div className="py-1.5">
              {filtered.length > 0 && filtered.map((item, idx) => renderItem(item, idx))}
              {hotelResults.length > 0 && (
                <>
                  {filtered.length > 0 && <div className="border-t border-gray-100 my-1" />}
                  <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Hotel className="w-3 h-3" />
                    Hotely
                  </div>
                  {hotelResults.map((hotel, i) => {
                    const idx = filtered.length + i
                    const isHighlighted = highlighted === idx
                    return (
                      <button
                        key={hotel.slug}
                        data-idx={idx}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); handleHotelClick(hotel.slug) }}
                        onMouseEnter={() => setHighlighted(idx)}
                        className={`w-full flex items-center justify-between px-5 py-2.5 transition-colors text-left ${isHighlighted ? 'bg-[#008afe]/[0.06]' : 'hover:bg-gray-50'}`}
                      >
                        <span className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-gray-700 truncate">{hotel.name}</span>
                          <span className="text-[11px] text-gray-400 mt-0.5">{hotel.resort_town ? `${hotel.resort_town}, ` : ''}{hotel.country}</span>
                        </span>
                        <span className="flex items-center gap-2 flex-shrink-0 ml-3">
                          {hotel.stars ? <span className="text-xs text-amber-400">{'★'.repeat(hotel.stars)}</span> : null}
                          <span className="text-[10px] text-[#008afe] font-semibold">→ detail</span>
                        </span>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          ) : (
            <div className="py-1.5">
              {renderHierarchy()}
            </div>
          )}

          <div className="h-2" />
        </div>
      )}
    </div>
  )
}
