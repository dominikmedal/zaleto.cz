'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { PiCaretLeft, PiCaretRight, PiCalendarBlank } from 'react-icons/pi'
import { fetchCalendarPrices } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayPrice { date: string; min_price: number; tour_count: number }

interface Props {
  dateFrom: string
  dateTo: string
  destination?: string
  onDateFromChange: (v: string) => void
  onDateToChange:   (v: string) => void
}

// ─── Date utilities (no external libs) ───────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOffset(year: number, month: number) {
  const jsDay = new Date(year, month, 1).getDay() // 0=Sun
  return (jsDay + 6) % 7 // 0=Mon…6=Sun
}

function cmpYMD(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0 }

function fetchRange(year: number, month: number) {
  const s = addMonths(year, month, -1)
  const e = addMonths(year, month, 2)
  const from = `${s.year}-${String(s.month + 1).padStart(2, '0')}-01`
  const lastDay = getDaysInMonth(e.year, e.month)
  const to = `${e.year}-${String(e.month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

// ─── Czech locale ─────────────────────────────────────────────────────────────

const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec']
const DAYS   = ['Po','Út','St','Čt','Pá','So','Ne']

// ─── Price helpers ────────────────────────────────────────────────────────────

function fmtPrice(p: number) {
  return `${Math.round(p / 1000)} k`
}

function priceColor(price: number, all: number[]) {
  if (!all.length) return 'text-gray-400'
  const s  = [...all].sort((a, b) => a - b)
  const p33 = s[Math.floor(s.length * 0.33)]
  const p66 = s[Math.floor(s.length * 0.66)]
  if (price <= p33) return 'text-emerald-600'
  if (price <= p66) return 'text-amber-500'
  return 'text-red-500'
}

function fmtDisplay(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── MonthGrid ────────────────────────────────────────────────────────────────

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

  // Effective range end for highlight (use hover when picking second date)
  const rangeEnd = (picking === 'to' && hover && dateFrom)
    ? (cmpYMD(hover, dateFrom) >= 0 ? hover : dateFrom)
    : dateTo

  return (
    <div className="min-w-0">
      <p className="text-center text-sm font-semibold text-gray-800 mb-3">{MONTHS[month]} {year}</p>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ymd  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const info = priceMap.get(ymd)
          const past = cmpYMD(ymd, today) < 0
          const isFrom = ymd === dateFrom
          const isTo   = ymd === dateTo
          const sel    = isFrom || isTo
          const inRange = dateFrom && rangeEnd && cmpYMD(ymd, dateFrom) > 0 && cmpYMD(ymd, rangeEnd) < 0
          const clickable = !past && !!info

          let bg = ''
          if (sel) bg = 'bg-[#008afe] text-white rounded-xl z-10'
          else if (inRange) {
            bg = 'bg-[#008afe]/8'
            if (ymd === dateFrom) bg += ' rounded-l-xl'
            if (ymd === rangeEnd) bg += ' rounded-r-xl'
          }

          return (
            <div
              key={ymd}
              className={`flex flex-col items-center justify-center h-12 text-xs select-none transition-colors ${bg}
                ${past ? 'opacity-25 cursor-not-allowed' : clickable ? 'cursor-pointer' : 'cursor-default opacity-35'}
                ${!sel && !inRange && clickable ? 'hover:bg-[#008afe]/10 hover:rounded-xl' : ''}
              `}
              onClick={() => clickable && onDayClick(ymd)}
              onMouseEnter={() => !past && onDayHover(ymd)}
            >
              <span className={`font-medium text-[13px] leading-none ${sel ? 'text-white' : 'text-gray-800'}`}>{day}</span>
              {info
                ? <span className={`text-[9px] leading-none mt-0.5 font-medium ${sel ? 'text-white/70' : priceColor(info.min_price, allPrices)}`}>{fmtPrice(info.min_price)}</span>
                : <span className="text-[9px] leading-none mt-0.5 text-gray-200">–</span>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

export default function DateRangePicker({ dateFrom, dateTo, destination, onDateFromChange, onDateToChange }: Props) {
  const today = toYMD(new Date())
  const init  = dateFrom ? (() => { const [y, m] = dateFrom.split('-').map(Number); return { year: y, month: m - 1 } })() : { year: new Date().getFullYear(), month: new Date().getMonth() }

  const [viewYear,  setViewYear]  = useState(init.year)
  const [viewMonth, setViewMonth] = useState(init.month)
  const [open,      setOpen]      = useState(false)
  const [picking,   setPicking]   = useState<'from' | 'to'>('from')
  const [hover,     setHover]     = useState('')
  const [priceMap,  setPriceMap]  = useState<Map<string, DayPrice>>(new Map())
  const [allPrices, setAllPrices] = useState<number[]>([])
  const [loading,   setLoading]   = useState(false)

  const popRef     = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const month2     = addMonths(viewYear, viewMonth, 1)

  // Fetch prices
  const loadPrices = useCallback(async () => {
    setLoading(true)
    const { from, to } = fetchRange(viewYear, viewMonth)
    const rows = await fetchCalendarPrices(from, to, destination)
    const map = new Map<string, DayPrice>()
    const prices: number[] = []
    rows.forEach(r => { map.set(r.date, r); prices.push(r.min_price) })
    setPriceMap(map)
    setAllPrices(prices)
    setLoading(false)
  }, [viewYear, viewMonth, destination])

  useEffect(() => { if (open) loadPrices() }, [open, loadPrices])

  // Outside click
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
      setOpen(false); setPicking('from'); setHover('')
    }
  }

  const prev = () => { const m = addMonths(viewYear, viewMonth, -1); setViewYear(m.year); setViewMonth(m.month) }
  const next = () => { const m = addMonths(viewYear, viewMonth, 1);  setViewYear(m.year); setViewMonth(m.month) }

  // Label shown inside the single trigger button
  const triggerLabel = dateFrom && dateTo
    ? `${fmtDisplay(dateFrom)} – ${fmtDisplay(dateTo)}`
    : dateFrom
    ? `Od ${fmtDisplay(dateFrom)}…`
    : null

  return (
    <div className="relative" ref={triggerRef}>
      {/* Single trigger */}
      <label className="block text-xs font-medium text-gray-500 mb-1.5">Termín odjezdu</label>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setPicking('from') }}
        className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-white text-left flex items-center gap-2 cursor-pointer transition-all duration-150 focus:outline-none
          ${open
            ? 'border-[#008afe] ring-2 ring-[#008afe]/12 shadow-[0_0_0_4px_rgba(0,138,254,0.06)]'
            : 'border-gray-200 hover:border-[#008afe]/40'}
          ${triggerLabel ? 'text-gray-800' : 'text-gray-400'}`}
      >
        <PiCalendarBlank className={`w-4 h-4 flex-shrink-0 transition-colors ${open ? 'text-[#008afe]' : 'text-gray-400'}`} />
        <span className="truncate flex-1">{triggerLabel ?? 'Vybrat termín'}</span>
        {(dateFrom || dateTo) && (
          <span
            className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none"
            onClick={e => { e.stopPropagation(); onDateFromChange(''); onDateToChange('') }}
          >✕</span>
        )}
      </button>

      {/* Calendar popover */}
      {open && (
        <div ref={popRef}
          className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl border border-gray-200 shadow-2xl p-5"
          style={{ width: 'min(680px, calc(100vw - 2rem))' }}>

          {/* Navigation header */}
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <PiCaretLeft className="w-4 h-4 text-gray-600" />
            </button>
            <span className="text-xs text-gray-500 font-medium">
              {picking === 'from' ? '① Vyberte datum odjezdu' : '② Vyberte datum návratu'}
              {loading && <span className="ml-2 text-blue-400 animate-pulse">načítám ceny…</span>}
            </span>
            <button type="button" onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <PiCaretRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Two months */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" onMouseLeave={() => setHover('')}>
            <MonthGrid year={viewYear} month={viewMonth} priceMap={priceMap} allPrices={allPrices}
              dateFrom={dateFrom} dateTo={dateTo} hover={hover} picking={picking} today={today}
              onDayClick={handleDayClick} onDayHover={setHover} />
            <MonthGrid year={month2.year} month={month2.month} priceMap={priceMap} allPrices={allPrices}
              dateFrom={dateFrom} dateTo={dateTo} hover={hover} picking={picking} today={today}
              onDayClick={handleDayClick} onDayHover={setHover} />
          </div>

          {/* Legend + close */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Levné</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />Průměrné</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />Dražší</span>
            <span className="text-gray-300 text-xs ml-1">Ceny od osoby / 2 os.</span>
            <button type="button" onClick={() => { setOpen(false); setPicking('from'); setHover('') }}
              className="ml-auto text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600 transition-colors">
              Zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
