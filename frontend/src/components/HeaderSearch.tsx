'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PiMagnifyingGlass, PiMapPin, PiBuildings, PiX, PiArrowRight } from 'react-icons/pi'
import { fetchDestinations, fetchHotelSearch } from '@/lib/api'
import { getCountryFlag } from '@/lib/countryFlags'

interface DestRow { country: string; destination: string; resort_town: string | null; hotel_count: number }
interface HotelResult { slug: string; name: string; country: string; resort_town: string | null; stars: number | null; thumbnail_url?: string | null }
interface DestOption { label: string; href: string; kind: 'country' | 'region' | 'resort'; flag?: string; count?: number }

function buildDestOptions(rows: DestRow[]): DestOption[] {
  const seen    = new Set<string>()
  const out: DestOption[] = []
  const counts  = new Map<string, number>()

  for (const r of rows) {
    counts.set(r.country, (counts.get(r.country) || 0) + r.hotel_count)
  }

  // Sort rows by country hotel count (desc)
  const sorted = [...rows].sort((a, b) => (counts.get(b.country) || 0) - (counts.get(a.country) || 0))

  for (const r of sorted) {
    if (!seen.has(r.country)) {
      seen.add(r.country)
      out.push({
        label: r.country,
        href: `/?destination=${encodeURIComponent(r.country)}`,
        kind: 'country',
        flag: getCountryFlag(r.country) ?? '🌍',
        count: counts.get(r.country),
      })
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

function normStr(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Zvýrazní hledaný výraz, diakritikou-insensitive */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = normStr(text).indexOf(normStr(query))
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#0093FF]/15 text-[#0093FF] font-semibold rounded-sm px-0.5 not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

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

  const q    = query.trim()
  const qNorm = normStr(q)

  // Při psaní: filtruj destinace; prázdný stav: top 8 zemí jako popular chips
  const filteredDest = qNorm.length >= 1
    ? destOptions.filter(d => normStr(d.label).includes(qNorm)).slice(0, 6)
    : []
  const popularCountries = destOptions.filter(d => d.kind === 'country').slice(0, 8)

  const totalItems = filteredDest.length + hotelResults.length
  const hasResults = filteredDest.length > 0 || hotelResults.length > 0
  const isSearching = qNorm.length >= 1

  const navigate = (href: string) => { setOpen(false); setQuery(''); setHighlighted(-1); router.push(href) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, totalItems - 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); return }
    if (e.key === 'Enter') {
      if (highlighted >= 0 && highlighted < filteredDest.length) { e.preventDefault(); navigate(filteredDest[highlighted].href); return }
      const hotel = hotelResults[highlighted - filteredDest.length]
      if (hotel) { e.preventDefault(); navigate(`/hotel/${hotel.slug}`); return }
      if (qNorm.length >= 1) { e.preventDefault(); navigate(`/?destination=${encodeURIComponent(query.trim())}`) }
    }
  }

  const showDropdown = open && (isSearching ? (hasResults || qNorm.length >= 2) : destLoaded)

  return (
    <div ref={containerRef} className="relative flex-1 max-w-lg mx-3 sm:mx-6">
      {/* Input pill — prominent */}
      <div
        className={`flex items-center gap-2.5 h-11 px-4 rounded-full border-2 transition-all duration-200 cursor-text ${
          open
            ? 'bg-white border-[#0093FF]/60 shadow-[0_0_0_4px_rgba(0,147,255,0.10),0_4px_16px_rgba(0,147,255,0.12)]'
            : 'bg-white border-gray-200 shadow-sm hover:border-[#0093FF]/30 hover:shadow-md'
        }`}
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
      >
        <PiMagnifyingGlass className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${open ? 'text-[#0093FF]' : 'text-gray-400'}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Hledat destinaci nebo hotel…"
          onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(-1) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-gray-400 placeholder:font-normal text-gray-800 min-w-0"
        />
        {query ? (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setQuery(''); setHighlighted(-1) }}
            className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
          >
            <PiX className="w-3 h-3 text-gray-500" />
          </button>
        ) : (
          <span className="flex-shrink-0 text-[11px] font-semibold text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded hidden sm:block">
            /
          </span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2.5 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-black/10 overflow-hidden z-50">

          {isSearching ? (
            /* ── Výsledky hledání ── */
            <>
              {filteredDest.length > 0 && (
                <div className="py-1.5">
                  <div className="px-4 pt-2 pb-1.5 flex items-center gap-1.5">
                    <PiMapPin className="w-3 h-3 text-[#0093FF]" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Destinace</span>
                  </div>
                  {filteredDest.map((d, i) => (
                    <button
                      key={d.href}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); navigate(d.href) }}
                      onMouseEnter={() => setHighlighted(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${highlighted === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${d.kind === 'country' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        {d.flag
                          ? <span className="text-base leading-none">{d.flag}</span>
                          : <PiMapPin className="w-3.5 h-3.5 text-gray-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800 font-medium block">
                          <Highlight text={d.label} query={query.trim()} />
                        </span>
                        {d.count && <span className="text-[11px] text-gray-400">{d.count} hotelů</span>}
                      </div>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        {d.kind === 'country' ? 'Země' : d.kind === 'region' ? 'Oblast' : 'Středisko'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {hotelResults.length > 0 && (
                <>
                  {filteredDest.length > 0 && <div className="border-t border-gray-50 mx-3" />}
                  <div className="py-1.5">
                    <div className="px-4 pt-2 pb-1.5 flex items-center gap-1.5">
                      <PiBuildings className="w-3 h-3 text-[#0093FF]" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hotely</span>
                    </div>
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
                          {h.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={h.thumbnail_url} alt={h.name} className="w-11 h-8 rounded-lg object-cover flex-shrink-0 shadow-sm" />
                          ) : (
                            <div className="w-11 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                              <PiBuildings className="w-4 h-4 text-[#0093FF]/60" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-gray-800 block truncate">
                              <Highlight text={h.name} query={query.trim()} />
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {h.stars ? <span className="text-amber-400 mr-1">{'★'.repeat(h.stars)}</span> : null}
                              {h.resort_town ? `${h.resort_town}, ` : ''}{h.country}
                            </span>
                          </div>
                          <span className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#0093FF]">
                            <PiArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {!hasResults && qNorm.length >= 1 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-gray-600">Nic nenalezeno</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Pro „<span className="font-medium text-gray-500">{q}</span>" nebyla nalezena žádná destinace ani hotel.
                  </p>
                </div>
              )}

              {/* Keyboard hint */}
              {hasResults && (
                <div className="px-4 py-2 border-t border-gray-50 flex items-center justify-end">
                  <span className="text-[10px] text-gray-300">↑↓ pohyb · Enter výběr · Esc zavřít</span>
                </div>
              )}
            </>

          ) : (
            /* ── Populární destinace (prázdný stav) ── */
            <div className="p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Populární destinace</p>

              {/* Country chips grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {popularCountries.map(d => (
                  <button
                    key={d.href}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); navigate(d.href) }}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left bg-gray-50 hover:bg-[rgba(0,147,255,0.06)] hover:border-[rgba(0,147,255,0.2)] border border-transparent transition-all"
                  >
                    <span className="text-xl leading-none flex-shrink-0">{d.flag}</span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 truncate leading-tight">{d.label}</p>
                      {d.count && <p className="text-[10px] text-gray-400 mt-0.5">{d.count} hotelů</p>}
                    </div>
                    <PiArrowRight className="w-3.5 h-3.5 text-gray-300 ml-auto flex-shrink-0" />
                  </button>
                ))}
              </div>

              {/* Hint */}
              <p className="text-[11px] text-gray-400 text-center">
                Začněte psát pro vyhledání destinace nebo hotelu
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
