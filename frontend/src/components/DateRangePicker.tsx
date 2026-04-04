'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { PiCaretLeft, PiCaretRight, PiCalendarBlank, PiX } from 'react-icons/pi'
import { Loader2 } from 'lucide-react'
import { fetchCalendarPrices } from '@/lib/api'

interface DayPrice { date: string; min_price: number; tour_count: number }

interface Props {
  dateFrom: string
  dateTo: string
  destination?: string
  onDateFromChange: (v: string) => void
  onDateToChange:   (v: string) => void
  defaultOpen?: boolean
  noLabel?: boolean
  inline?: boolean
  onComplete?: () => void
  flex?: boolean
  onFlexChange?: (v: boolean) => void
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}
function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOffset(year: number, month: number) { const jsDay = new Date(year, month, 1).getDay(); return (jsDay + 6) % 7 }
function cmpYMD(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0 }
function fetchRange(year: number, month: number) {
  const s = addMonths(year, month, -1)
  const e = addMonths(year, month, 2)
  const from = `${s.year}-${String(s.month + 1).padStart(2, '0')}-01`
  const lastDay = getDaysInMonth(e.year, e.month)
  const to = `${e.year}-${String(e.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec']
const DAYS   = ['Po','Út','St','Čt','Pá','So','Ne']

function fmtPrice(p: number) { return `${Math.round(p / 1000)} k` }
function priceColor(price: number, all: number[]) {
  if (!all.length) return 'text-gray-400'
  const s   = [...all].sort((a, b) => a - b)
  const p33 = s[Math.floor(s.length * 0.33)]
  const p66 = s[Math.floor(s.length * 0.66)]
  if (price <= p33) return 'text-emerald-500'
  if (price <= p66) return 'text-amber-500'
  return 'text-red-400'
}
function fmtDisplay(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface MonthGridProps {
  year: number; month: number
  priceMap: Map<string, DayPrice>; allPrices: number[]
  dateFrom: string; dateTo: string; hover: string; picking: 'from' | 'to'; today: string
  onDayClick: (d: string) => void; onDayHover: (d: string) => void
}

function MonthGrid({ year, month, priceMap, allPrices, dateFrom, dateTo, hover, picking, today, onDayClick, onDayHover }: MonthGridProps) {
  const days   = getDaysInMonth(year, month)
  const offset = getFirstDayOffset(year, month)
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  const rangeEnd = (picking === 'to' && hover && dateFrom)
    ? (cmpYMD(hover, dateFrom) >= 0 ? hover : dateFrom)
    : dateTo

  return (
    <div className="min-w-0">
      <p className="text-center text-sm font-semibold text-gray-800 mb-3">{MONTHS[month]} {year}</p>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ymd     = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const info    = priceMap.get(ymd)
          const past    = cmpYMD(ymd, today) < 0
          const isFrom  = ymd === dateFrom
          const isTo    = ymd === dateTo
          const sel     = isFrom || isTo
          const inRange = !!(dateFrom && rangeEnd && cmpYMD(ymd, dateFrom) > 0 && cmpYMD(ymd, rangeEnd) < 0)

          return (
            <div
              key={ymd}
              onClick={() => !past && onDayClick(ymd)}
              onMouseEnter={() => !past && onDayHover(ymd)}
              className={`flex flex-col items-center justify-center h-11 text-xs select-none transition-all duration-100 ${
                past ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'
              } ${
                sel
                  ? 'rounded-xl z-10'
                  : inRange
                  ? ''
                  : !past ? 'hover:rounded-xl' : ''
              }`}
              style={sel
                ? { background: 'linear-gradient(135deg, #0093FF, #0070E0)', boxShadow: '0 2px 8px rgba(0,147,255,0.30)' }
                : inRange
                ? { background: 'rgba(0,147,255,0.09)' }
                : !past
                ? { ['--hover-bg' as string]: 'rgba(0,147,255,0.08)' }
                : {}
              }
            >
              <span className={`font-semibold text-[13px] leading-none ${sel ? 'text-white' : past ? 'text-gray-400' : 'text-gray-800'}`}>
                {day}
              </span>
              {info
                ? <span className={`text-[9px] leading-none mt-0.5 font-medium ${sel ? 'text-white/75' : priceColor(info.min_price, allPrices)}`}>{fmtPrice(info.min_price)}</span>
                : <span className="text-[9px] leading-none mt-0.5">&nbsp;</span>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DateRangePicker({ dateFrom, dateTo, destination, onDateFromChange, onDateToChange, defaultOpen, noLabel, inline, onComplete, flex, onFlexChange }: Props) {
  const today = toYMD(new Date())
  const init  = dateFrom
    ? (() => { const [y, m] = dateFrom.split('-').map(Number); return { year: y, month: m - 1 } })()
    : { year: new Date().getFullYear(), month: new Date().getMonth() }

  const [viewYear,  setViewYear]  = useState(init.year)
  const [viewMonth, setViewMonth] = useState(init.month)
  const [open,      setOpen]      = useState(defaultOpen ?? false)
  const [picking,   setPicking]   = useState<'from' | 'to'>('from')
  const [hover,     setHover]     = useState('')
  const [priceMap,  setPriceMap]  = useState<Map<string, DayPrice>>(new Map())
  const [allPrices, setAllPrices] = useState<number[]>([])
  const [loading,   setLoading]   = useState(false)

  const popRef     = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const month2     = addMonths(viewYear, viewMonth, 1)

  const loadPrices = useCallback(async () => {
    setLoading(true)
    const { from, to } = fetchRange(viewYear, viewMonth)
    const rows = await fetchCalendarPrices(from, to, destination)
    const map = new Map<string, DayPrice>()
    const prices: number[] = []
    rows.forEach(r => { map.set(r.date, r); prices.push(r.min_price) })
    setPriceMap(map); setAllPrices(prices); setLoading(false)
  }, [viewYear, viewMonth, destination])

  useEffect(() => { if (open || inline) loadPrices() }, [open, inline, loadPrices])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return
      setOpen(false); setPicking('from')
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const handleDayClick = (ymd: string) => {
    if (picking === 'from') {
      onDateFromChange(ymd); onDateToChange(''); setPicking('to')
    } else {
      if (cmpYMD(ymd, dateFrom) < 0) { onDateToChange(dateFrom); onDateFromChange(ymd) }
      else { onDateToChange(ymd) }
      setPicking('from'); setHover('')
      if (inline) { onComplete?.() } else { setOpen(false) }
    }
  }

  const prev = () => { const m = addMonths(viewYear, viewMonth, -1); setViewYear(m.year); setViewMonth(m.month) }
  const next = () => { const m = addMonths(viewYear, viewMonth,  1); setViewYear(m.year); setViewMonth(m.month) }

  const triggerLabel = dateFrom && dateTo
    ? `${fmtDisplay(dateFrom)} – ${fmtDisplay(dateTo)}`
    : dateFrom ? `Od ${fmtDisplay(dateFrom)}…` : null

  // Shared step indicator
  const stepPill = (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: 'rgba(0,147,255,0.08)', color: '#0093FF' }}
    >
      {picking === 'from' ? '① Datum odjezdu' : '② Datum návratu'}
      {loading && <Loader2 className="w-3 h-3 animate-spin" />}
    </span>
  )

  const calendarContent = (
    <div className="relative">
      {/* Nav row */}
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={prev}
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
          style={{ background: 'rgba(0,147,255,0.07)', color: '#0093FF' }}
        >
          <PiCaretLeft className="w-4 h-4" />
        </button>
        {stepPill}
        <button
          type="button"
          onClick={next}
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
          style={{ background: 'rgba(0,147,255,0.07)', color: '#0093FF' }}
        >
          <PiCaretRight className="w-4 h-4" />
        </button>
      </div>

      {/* Two-month grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" onMouseLeave={() => setHover('')}>
        <MonthGrid year={viewYear} month={viewMonth} priceMap={priceMap} allPrices={allPrices}
          dateFrom={dateFrom} dateTo={dateTo} hover={hover} picking={picking} today={today}
          onDayClick={handleDayClick} onDayHover={setHover} />
        <MonthGrid year={month2.year} month={month2.month} priceMap={priceMap} allPrices={allPrices}
          dateFrom={dateFrom} dateTo={dateTo} hover={hover} picking={picking} today={today}
          onDayClick={handleDayClick} onDayHover={setHover} />
      </div>

      {/* Footer */}
      <div
        className="mt-5 pt-4 flex flex-wrap items-center gap-4 text-[11px] text-gray-500"
        style={{ borderTop: '1px solid rgba(0,147,255,0.08)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Levné
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Průměrné
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Dražší
        </span>
        <span className="text-gray-300 text-[10px]">Ceny od osoby / 2 os.</span>

        {onFlexChange && (
          <div className="glass-pill rounded-xl p-0.5 ml-auto flex items-center gap-0.5">
            {[{ v: false, l: 'Přesně' }, { v: true, l: '±3 dny' }].map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => onFlexChange(opt.v)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  flex === opt.v
                    ? 'bg-white text-[#0093FF] shadow-[0_1px_4px_rgba(0,147,255,0.15)] border border-[#C8E3FF]'
                    : 'text-gray-500 hover:text-[#0093FF]'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        )}

        {!inline && (
          <button
            type="button"
            onClick={() => { setOpen(false); setPicking('from'); setHover('') }}
            className={`text-xs text-gray-400 hover:text-gray-600 transition-colors ${onFlexChange ? '' : 'ml-auto'}`}
          >
            Zavřít
          </button>
        )}
      </div>
    </div>
  )

  if (inline) return <div className="w-full min-w-0">{calendarContent}</div>

  return (
    <div className="relative" ref={triggerRef}>
      {!noLabel && <label className="block text-xs font-medium text-gray-500 mb-1.5">Termín odjezdu</label>}

      {/* Trigger — same glass style as DestinationAutocomplete */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setPicking('from') }}
        className="w-full px-3 py-2.5 text-sm rounded-xl text-left flex items-center gap-2 cursor-pointer transition-all duration-200"
        style={{
          background: open ? 'rgba(255,255,255,0.95)' : 'rgba(237,246,255,0.72)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: open ? '1px solid rgba(0,147,255,0.40)' : '1px solid rgba(200,227,255,0.65)',
          boxShadow: open
            ? '0 0 0 3px rgba(0,147,255,0.08), 0 2px 12px rgba(0,147,255,0.10)'
            : '0 1px 4px rgba(0,147,255,0.06)',
          color: triggerLabel ? '#111827' : '#9ca3af',
        }}
      >
        <PiCalendarBlank className={`w-4 h-4 flex-shrink-0 transition-colors ${open ? 'text-[#0093FF]' : 'text-gray-400'}`} />
        <span className="truncate flex-1">{triggerLabel ?? 'Vybrat termín'}</span>
        {(dateFrom || dateTo) && (
          <span
            className="text-gray-400 hover:text-red-400 transition-colors leading-none text-sm"
            onClick={e => { e.stopPropagation(); onDateFromChange(''); onDateToChange('') }}
          >
            <PiX className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div
          ref={popRef}
          className="absolute top-full left-0 mt-2 z-50 rounded-2xl p-5 overflow-hidden"
          style={{
            width: 'min(680px, calc(100vw - 2rem))',
            background: 'rgba(248,251,255,0.97)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            border: '1px solid rgba(200,227,255,0.70)',
            boxShadow: '0 12px 48px rgba(0,147,255,0.14), 0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)',
          }}
        >
          {calendarContent}
        </div>
      )}
    </div>
  )
}
