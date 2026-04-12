'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check } from 'lucide-react'
import { PiMagnifyingGlass, PiSpinner, PiMapPin, PiBuildings, PiGlobe, PiArrowRight } from 'react-icons/pi'
import { fetchHotelSearch } from '@/lib/api'

const PLACEHOLDER_CYCLE = [
  'Kam chcete letět?',
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

import { getCountryFlag } from '@/lib/countryFlags'
const getFlag = (c: string) => getCountryFlag(c) ?? '🌍'

/** Normalize string: strip diacritics + lowercase for Czech-insensitive matching */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

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
    if (resort && resort !== region) de.resorts.set(resort, (de.resorts.get(resort) || 0) + r.hotel_count)
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

/** Zvýrazní hledaný výraz v textu */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  // Use normalized comparison so "recko" highlights in "Řecko"
  const normText  = norm(text)
  const normQuery = norm(query)
  const idx = normText.indexOf(normQuery)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#0093FF]/15 text-[#0093FF] font-semibold rounded-sm px-0.5 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function DestinationAutocomplete({ destinations, value, onChange, noLabel, defaultOpen, loading }: Props) {
  const router = useRouter()
  const [query,        setQuery]        = useState('')
  const [open,         setOpen]         = useState(false)
  const [highlighted,  setHighlighted]  = useState(-1)
  const [hotelResults, setHotelResults] = useState<HotelResult[]>([])
  const [phIdx,        setPhIdx]        = useState(0)
  const [phVisible,    setPhVisible]    = useState(true)
  const [showAll,      setShowAll]      = useState(false)
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
      setTimeout(() => { setPhIdx(i => (i + 1) % PLACEHOLDER_CYCLE.length); setPhVisible(true) }, 350)
    }, 2800)
    return () => clearInterval(timer)
  }, [open, query, value.length])

  const hierarchy = useMemo(() => buildHierarchy(destinations), [destinations])
  const allItems  = useMemo(() => buildFlatItems(hierarchy), [hierarchy])

  const filtered = useMemo<Item[]>(() => {
    const q = norm(query.trim())
    if (!q) return []
    return allItems
      .filter(it =>
        norm(it.label).includes(q) ||
        norm(it.country).includes(q) ||
        norm(it.destination).includes(q)
      )
      .slice(0, 12)
  }, [query, allItems])

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

  // Reset showAll when dropdown closes
  useEffect(() => { if (!open) setShowAll(false) }, [open])

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
    const q             = query.trim()

    if (isCountry) {
      return (
        <button
          key={`${item.level}-${item.value}`}
          data-idx={idx}
          type="button"
          onMouseDown={e => { e.preventDefault(); toggle(item.value); setQuery('') }}
          onMouseEnter={() => setHighlighted(idx)}
          className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
            selected ? 'bg-[rgba(0,147,255,0.06)]' : isHighlighted ? 'bg-[rgba(0,147,255,0.04)]' : 'bg-[rgba(0,147,255,0.02)]'
          }`}
        >
          <span className="text-lg leading-none flex-shrink-0">{item.flag}</span>
          <span className={`text-[11px] font-bold uppercase tracking-widest flex-1 ${selected ? 'text-[#0093FF]' : 'text-gray-400'}`}>
            <Highlight text={item.label} query={q} />
          </span>
          {selected && (
            <span className="w-4 h-4 rounded-full bg-[#0093FF] flex items-center justify-center flex-shrink-0">
              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            </span>
          )}
        </button>
      )
    }

    if (isResort) {
      return (
        <button
          key={`${item.level}-${item.value}`}
          data-idx={idx}
          type="button"
          onMouseDown={e => { e.preventDefault(); toggle(item.value); setQuery('') }}
          onMouseEnter={() => setHighlighted(idx)}
          className={`w-full flex items-center justify-between pl-14 pr-4 py-1.5 text-left transition-colors ${
            selected ? 'bg-[rgba(0,147,255,0.06)]' : isHighlighted ? 'bg-[rgba(0,147,255,0.04)]' : 'hover:bg-[rgba(0,147,255,0.02)]'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
            <span className={`text-[12px] truncate ${selected ? 'text-[#0093FF] font-medium' : 'text-gray-500'}`}>
              <Highlight text={item.label} query={q} />
            </span>
            {query && <span className="text-[10px] text-gray-400 flex-shrink-0">{item.destination}</span>}
          </span>
          {selected && (
            <span className="w-3.5 h-3.5 rounded-full bg-[#0093FF] flex items-center justify-center flex-shrink-0 ml-2">
              <Check className="w-2 h-2 text-white" strokeWidth={3} />
            </span>
          )}
        </button>
      )
    }

    // destination level
    return (
      <button
        key={`${item.level}-${item.value}`}
        data-idx={idx}
        type="button"
        onMouseDown={e => { e.preventDefault(); toggle(item.value); setQuery('') }}
        onMouseEnter={() => setHighlighted(idx)}
        className={`w-full flex items-center justify-between pl-9 pr-4 py-2 text-left transition-colors ${
          selected ? 'bg-[rgba(0,147,255,0.07)]' : isHighlighted ? 'bg-[rgba(0,147,255,0.04)]' : 'hover:bg-[rgba(0,147,255,0.02)]'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <PiMapPin className={`w-3.5 h-3.5 flex-shrink-0 ${selected ? 'text-[#0093FF]' : 'text-gray-300'}`} />
          <span className={`text-[13px] font-medium truncate ${selected ? 'text-[#0093FF]' : 'text-gray-700'}`}>
            <Highlight text={item.label} query={q} />
          </span>
          {query && <span className="text-[11px] text-gray-400 flex-shrink-0">{item.country}</span>}
        </span>
        <span className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 ml-3 transition-all border ${
          selected ? 'bg-[#0093FF] border-[#0093FF]' : 'border-gray-200'
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
        <div key={country.label} className={ci > 0 ? 'border-t' : ''} style={{ borderColor: 'rgba(0,147,255,0.06)' }}>
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

  /** Populární destinace — top 8 zemí jako karty */
  const renderPopular = () => {
    const top = hierarchy.slice(0, 8)
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Populární destinace</span>
          </div>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setOpen(false); setQuery(''); router.push('/destinace') }}
            className="text-[11px] font-semibold text-[#0093FF] hover:text-[#0070E0] flex items-center gap-0.5 transition-colors"
          >
            Vše <PiArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Country chips grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {top.map(country => {
            const total = country.destinations.reduce((s, d) => s + d.count, 0)
            const sel   = value.includes(country.label)
            return (
              <button
                key={country.label}
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  toggle(country.label)
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150 ${
                  sel
                    ? 'bg-[#0093FF] text-white shadow-md shadow-[#0093FF]/25'
                    : 'bg-gray-50 hover:bg-[rgba(0,147,255,0.06)] hover:border-[rgba(0,147,255,0.2)] border border-transparent'
                }`}
              >
                <span className="text-xl leading-none flex-shrink-0">{country.flag}</span>
                <div className="min-w-0">
                  <p className={`text-[13px] font-semibold leading-tight truncate ${sel ? 'text-white' : 'text-gray-800'}`}>
                    {country.label}
                  </p>
                  <p className={`text-[10px] leading-tight mt-0.5 ${sel ? 'text-white/75' : 'text-gray-400'}`}>
                    {total} hotelů
                  </p>
                </div>
                {sel && (
                  <span className="ml-auto flex-shrink-0 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Top resorts as small chips */}
        {hierarchy[0]?.destinations?.length > 0 && (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Oblíbená střediska</p>
            <div className="flex flex-wrap gap-1.5">
              {hierarchy.flatMap(c =>
                c.destinations.slice(0, 2).map(d => ({ label: d.label, count: d.count, flag: c.flag, country: c.label }))
              ).sort((a, b) => b.count - a.count).slice(0, 10).map(d => {
                const sel = value.includes(d.label)
                return (
                  <button
                    key={d.label}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); toggle(d.label) }}
                    className={`inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-full transition-all ${
                      sel
                        ? 'bg-[#0093FF] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-[rgba(0,147,255,0.08)] hover:text-[#0093FF]'
                    }`}
                  >
                    <span className="text-sm leading-none">{d.flag}</span>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  const showAnimatedPh = !open && query === '' && value.length === 0
  const totalResults   = filtered.length + hotelResults.length

  return (
    <div ref={containerRef} className="relative">
      {!noLabel && <label className="block text-xs font-semibold text-gray-500 mb-1.5 tracking-wide">Destinace</label>}

      {/* Pulzující kroužek — viditelný pouze v idle stavu */}
      {showAnimatedPh && (
        <span
          className="pointer-events-none absolute inset-0 rounded-2xl z-0"
          style={{
            boxShadow: '0 0 0 0 rgba(0,147,255,0.35)',
            animation: 'dest-pulse 2.4s ease-in-out infinite',
          }}
        />
      )}

      <style>{`
        @keyframes dest-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(0,147,255,0.30); }
          60%  { box-shadow: 0 0 0 8px rgba(0,147,255,0.00); }
          100% { box-shadow: 0 0 0 0   rgba(0,147,255,0.00); }
        }
      `}</style>

      {/* Input trigger — prominent */}
      <div
        className="relative z-10 min-h-[58px] w-full px-4 py-3 flex flex-wrap items-center gap-1.5 rounded-2xl cursor-text transition-all duration-200"
        style={{
          background: open ? 'rgba(255,255,255,0.99)' : 'rgba(237,246,255,0.90)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: open
            ? '2px solid rgba(0,147,255,0.55)'
            : '2px solid rgba(0,147,255,0.22)',
          boxShadow: open
            ? '0 0 0 4px rgba(0,147,255,0.10), 0 6px 24px rgba(0,147,255,0.14)'
            : '0 2px 12px rgba(0,147,255,0.10)',
        }}
        onClick={() => { inputRef.current?.focus(); setOpen(true) }}
      >
        {/* Ikona hledání s tečkou živosti */}
        <div className="relative flex-shrink-0 ml-0.5">
          <PiMagnifyingGlass className={`w-5 h-5 transition-colors ${open ? 'text-[#0093FF]' : 'text-[#0093FF]/60'}`} />
          {showAnimatedPh && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#0093FF] border-2 border-white"
              style={{ animation: 'dot-blink 1.8s ease-in-out infinite' }}
            />
          )}
          <style>{`
            @keyframes dot-blink {
              0%, 100% { opacity: 1; transform: scale(1); }
              50%       { opacity: 0.4; transform: scale(0.7); }
            }
          `}</style>
        </div>

        {value.map(dest => (
          <span
            key={dest}
            className="inline-flex items-center gap-1 text-xs font-semibold text-white px-2.5 py-1 rounded-lg whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #0093FF, #0070E0)', boxShadow: '0 1px 6px rgba(0,147,255,0.28)' }}
          >
            {dest}
            <button type="button" onMouseDown={e => remove(dest, e)} className="opacity-70 hover:opacity-100 transition-opacity ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="relative flex-1 min-w-[120px] h-[30px]">
          {showAnimatedPh && (
            <span
              className="absolute inset-0 flex items-center pointer-events-none select-none transition-all duration-300"
              style={{ opacity: phVisible ? 1 : 0, transform: phVisible ? 'translateY(0)' : 'translateY(-5px)' }}
            >
              <span className="text-[16px] font-semibold text-gray-500">{PLACEHOLDER_CYCLE[phIdx]}</span>
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={open && value.length === 0 && !query ? 'Hledat destinaci nebo hotel…' : ''}
            onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(-1) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 w-full text-[16px] font-semibold outline-none bg-transparent py-0.5 text-gray-800"
          />
        </div>

        {(value.length > 0 || query) && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); if (query) { setQuery('') } else { onChange([]) } }}
            className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-2 rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid rgba(200,227,255,0.70)',
            boxShadow: '0 8px 40px rgba(0,147,255,0.14), 0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)',
            maxHeight: 420,
            overflowY: 'auto',
          }}
        >
          {/* Active filters strip */}
          {value.length > 0 && !query && (
            <div
              className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(0,147,255,0.08)', background: 'rgba(0,147,255,0.03)' }}
            >
              <span className="text-xs text-gray-500 font-medium">Vybráno: <span className="text-[#0093FF] font-semibold">{value.join(', ')}</span></span>
              <button type="button" onMouseDown={e => { e.preventDefault(); onChange([]) }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium ml-3 flex-shrink-0">
                Zrušit vše
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <PiSpinner className="w-5 h-5 text-[#0093FF] animate-spin" />
              <span className="text-xs text-gray-400">Načítám destinace…</span>
            </div>

          ) : query.trim() ? (
            /* ── Výsledky hledání ── */
            <div className="py-1.5">
              {filtered.length === 0 && hotelResults.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <PiGlobe className="w-10 h-10 text-gray-150 mx-auto mb-3" style={{ color: '#d1d5db' }} />
                  <p className="text-[14px] font-semibold text-gray-600 mb-1">Nic nenalezeno</p>
                  <p className="text-[12px] text-gray-400">
                    Pro „<span className="font-medium text-gray-500">{query.trim()}</span>" jsme nenašli žádnou destinaci ani hotel.
                  </p>
                  <p className="text-[11px] text-gray-300 mt-1.5">Zkuste jiný název nebo zkontrolujte překlepy.</p>
                </div>
              ) : (
                <>
                  {/* Destination results */}
                  {filtered.length > 0 && (
                    <>
                      <div className="px-4 py-1.5 flex items-center gap-1.5">
                        <PiMapPin className="w-3 h-3 text-[#0093FF]" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Destinace
                        </span>
                        <span className="ml-auto text-[10px] text-gray-300 font-medium">{filtered.length} shod</span>
                      </div>
                      {filtered.map((item, idx) => renderItem(item, idx))}
                    </>
                  )}

                  {/* Hotel results */}
                  {hotelResults.length > 0 && (
                    <>
                      <div
                        className="px-4 py-1.5 mt-1 flex items-center gap-1.5"
                        style={{ borderTop: filtered.length > 0 ? '1px solid rgba(0,147,255,0.07)' : undefined }}
                      >
                        <PiBuildings className="w-3 h-3 text-[#0093FF]" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hotely</span>
                        <span className="ml-auto text-[10px] text-gray-300 font-medium">{hotelResults.length} hotelů</span>
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
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              isHighlighted ? 'bg-[rgba(0,147,255,0.05)]' : 'hover:bg-[rgba(0,147,255,0.03)]'
                            }`}
                          >
                            {hotel.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={hotel.thumbnail_url} alt={hotel.name} className="w-12 h-9 rounded-xl object-cover flex-shrink-0 shadow-sm" />
                            ) : (
                              <div className="w-12 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(0,147,255,0.08)' }}>
                                <PiBuildings className="w-4.5 h-4.5 text-[#0093FF]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">
                                <Highlight text={hotel.name} query={query.trim()} />
                              </p>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {hotel.stars ? <span className="text-amber-400 mr-1">{'★'.repeat(hotel.stars)}</span> : null}
                                {hotel.resort_town ? `${hotel.resort_town}, ` : ''}{hotel.country}
                              </p>
                            </div>
                            <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#0093FF] bg-[rgba(0,147,255,0.08)] px-2 py-0.5 rounded-full">
                              Detail <PiArrowRight className="w-3 h-3" />
                            </span>
                          </button>
                        )
                      })}
                    </>
                  )}

                  {/* Footer — count + hint */}
                  {totalResults > 0 && (
                    <div className="px-4 py-2 flex items-center justify-between border-t border-gray-50 mt-1">
                      <span className="text-[10px] text-gray-400">{totalResults} výsledků</span>
                      <span className="text-[10px] text-gray-300">↑↓ pohyb · Enter výběr · Esc zavřít</span>
                    </div>
                  )}
                </>
              )}
            </div>

          ) : showAll ? (
            /* ── Plný seznam ── */
            <>
              <div className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-50">
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); setShowAll(false) }}
                  className="text-[11px] font-semibold text-[#0093FF] flex items-center gap-1"
                >
                  ← Populární
                </button>
                <span className="text-[11px] text-gray-400 ml-1">Všechny destinace</span>
              </div>
              <div className="py-1">{renderHierarchy()}</div>
            </>

          ) : (
            /* ── Populární destinace ── */
            renderPopular()
          )}

          <div className="h-1.5" />
        </div>
      )}
    </div>
  )
}
