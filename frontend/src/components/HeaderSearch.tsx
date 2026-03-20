'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PiMagnifyingGlass, PiMapPin, PiBuildings, PiX } from 'react-icons/pi'
import { fetchDestinations, fetchHotelSearch } from '@/lib/api'

interface DestRow { country: string; destination: string; resort_town: string | null; hotel_count: number }
interface HotelResult { slug: string; name: string; country: string; resort_town: string | null; stars: number | null }
interface DestOption { label: string; href: string; kind: 'country' | 'region' | 'resort' }

function buildDestOptions(rows: DestRow[]): DestOption[] {
  const seen = new Set<string>()
  const out: DestOption[] = []
  for (const r of rows) {
    if (!seen.has(r.country)) {
      seen.add(r.country)
      out.push({ label: r.country, href: `/?destination=${encodeURIComponent(r.country)}`, kind: 'country' })
    }
    const parts  = r.destination.split('/').map(s => s.trim())
    const region = parts[1] ?? parts[0]
    if (region && !seen.has(region)) {
      seen.add(region)
      out.push({ label: region, href: `/?destination=${encodeURIComponent(region)}`, kind: 'region' })
    }
    if (r.resort_town && !seen.has(r.resort_town)) {
      seen.add(r.resort_town)
      out.push({ label: r.resort_town, href: `/?destination=${encodeURIComponent(r.resort_town)}`, kind: 'resort' })
    }
  }
  return out
}

const KIND_LABEL = { country: 'Země', region: 'Oblast', resort: 'Středisko' } as const

export default function HeaderSearch() {
  const router = useRouter()
  const [query,        setQuery]        = useState('')
  const [open,         setOpen]         = useState(false)
  const [destOptions,  setDestOptions]  = useState<DestOption[]>([])
  const [hotelResults, setHotelResults] = useState<HotelResult[]>([])
  const [destLoaded,   setDestLoaded]   = useState(false)
  const [highlighted,  setHighlighted]  = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  const loadDest = useCallback(async () => {
    if (destLoaded) return
    const rows = await fetchDestinations()
    setDestOptions(buildDestOptions(rows))
    setDestLoaded(true)
  }, [destLoaded])

  useEffect(() => { if (open) loadDest() }, [open, loadDest])

  useEffect(() => {
    if (query.trim().length < 2) { setHotelResults([]); return }
    const t = setTimeout(async () => setHotelResults(await fetchHotelSearch(query)), 250)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) { setOpen(false); setHighlighted(-1) }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const q = query.trim().toLowerCase()
  const filteredDest = q.length >= 1
    ? destOptions.filter(d => d.label.toLowerCase().includes(q)).slice(0, 5)
    : destOptions.filter(d => d.kind === 'country').slice(0, 6)
  const totalItems = filteredDest.length + hotelResults.length
  const hasResults = filteredDest.length > 0 || hotelResults.length > 0

  const navigate = (href: string) => { setOpen(false); setQuery(''); setHighlighted(-1); router.push(href) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, totalItems - 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); return }
    if (e.key === 'Enter') {
      if (highlighted >= 0 && highlighted < filteredDest.length) { e.preventDefault(); navigate(filteredDest[highlighted].href); return }
      const hotel = hotelResults[highlighted - filteredDest.length]
      if (hotel) { e.preventDefault(); navigate(`/hotel/${hotel.slug}`); return }
      // Enter with no highlight → search by query
      if (q.length >= 1) { e.preventDefault(); navigate(`/?destination=${encodeURIComponent(query.trim())}`) }
    }
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-lg mx-3 sm:mx-6">
      {/* Input pill */}
      <div
        className={`flex items-center gap-2.5 h-10 px-4 rounded-full border transition-all cursor-text ${
          open
            ? 'bg-white border-blue-400 ring-4 ring-blue-500/10 shadow-md'
            : 'bg-white border-gray-200 shadow-sm hover:border-gray-300 hover:shadow'
        }`}
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
      >
        <PiMagnifyingGlass className={`w-4 h-4 flex-shrink-0 transition-colors ${open ? 'text-blue-500' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Hledat destinaci nebo hotel…"
          onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 text-gray-800 min-w-0"
        />
        {query && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setQuery(''); setHighlighted(-1) }}
            className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
          >
            <PiX className="w-3 h-3 text-gray-500" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (hasResults || q.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-black/8 overflow-hidden z-50">

          {/* Destinations */}
          {filteredDest.length > 0 && (
            <div className="py-1.5">
              {!q && (
                <p className="px-4 pt-1 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Populární destinace
                </p>
              )}
              {filteredDest.map((d, i) => (
                <button
                  key={d.href}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); navigate(d.href) }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${highlighted === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${d.kind === 'country' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <PiMapPin className={`w-3.5 h-3.5 ${d.kind === 'country' ? 'text-blue-400' : 'text-gray-400'}`} />
                  </div>
                  <span className="flex-1 text-sm text-gray-800 font-medium">{d.label}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                    {KIND_LABEL[d.kind]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Hotels */}
          {hotelResults.length > 0 && (
            <>
              {filteredDest.length > 0 && <div className="border-t border-gray-50 mx-3" />}
              <div className="py-1.5">
                <p className="px-4 pt-1 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Hotely
                </p>
                {hotelResults.map((h, i) => {
                  const idx = filteredDest.length + i
                  return (
                    <button
                      key={h.slug}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); navigate(`/hotel/${h.slug}`) }}
                      onMouseEnter={() => setHighlighted(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${highlighted === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <PiBuildings className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800 block truncate">{h.name}</span>
                        <span className="text-[11px] text-gray-400">
                          {h.stars ? '★'.repeat(h.stars) + ' · ' : ''}{h.resort_town ? `${h.resort_town}, ` : ''}{h.country}
                        </span>
                      </div>
                      <span className="text-[10px] text-blue-400 font-semibold flex-shrink-0">detail →</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* No results */}
          {!hasResults && q.length >= 2 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-gray-500">Žádné výsledky pro „{query}"</p>
              <p className="text-xs text-gray-400 mt-1">Zkuste jiný výraz nebo procházejte destinace níže</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
