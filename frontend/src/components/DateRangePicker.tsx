'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/ui/Icon'
import { fetchCalendarPrices } from '@/lib/api'

interface DayPrice { date: string; min_price: number; tour_count: number }

interface Props {
  dateFrom: string
  dateTo: string
  destination?: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  defaultOpen?: boolean
  noLabel?: boolean
  inline?: boolean
  onComplete?: () => void
  flex?: boolean
  onFlexChange?: (v: boolean) => void
  noPrices?: boolean
  placeholder?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addMonths = (year: number, month: number, delta: number) => { const d = new Date(year, month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() } }
const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
const firstOffset = (year: number, month: number) => (new Date(year, month, 1).getDay() + 6) % 7
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function priceRange(year: number, month: number) {
  const s = addMonths(year, month, -1)
  const e = addMonths(year, month, 2)
  return { from: `${s.year}-${pad(s.month + 1)}-01`, to: `${e.year}-${pad(e.month + 1)}-${pad(daysIn(e.year, e.month))}` }
}

const MONTHS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const DAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

const fmtShort = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return `${d}. ${m}. ${y}` }
const fmtDay = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }

function tier(price: number, all: number[]): 'low' | 'mid' | 'high' {
  if (!all.length) return 'mid'
  const s = [...all].sort((a, b) => a - b)
  if (price <= s[Math.floor(s.length * 0.33)]) return 'low'
  if (price <= s[Math.floor(s.length * 0.66)]) return 'mid'
  return 'high'
}

interface GridProps {
  year: number; month: number
  priceMap: Map<string, DayPrice>; allPrices: number[]
  dateFrom: string; dateTo: string; hover: string; picking: 'from' | 'to'; today: string
  onDayClick: (d: string) => void; onDayHover: (d: string) => void
  noPrices?: boolean
}

function MonthGrid({ year, month, priceMap, allPrices, dateFrom, dateTo, hover, picking, today, onDayClick, onDayHover, noPrices }: GridProps) {
  const cells: (number | null)[] = [...Array(firstOffset(year, month)).fill(null), ...Array.from({ length: daysIn(year, month) }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const rangeEnd = picking === 'to' && hover && dateFrom ? (cmp(hover, dateFrom) >= 0 ? hover : dateFrom) : dateTo

  return (
    <div className="z-cal__month">
      <div className="z-cal__title">{MONTHS[month]} {year}</div>
      <div className="z-cal__dow">{DAYS.map(d => <span key={d}>{d}</span>)}</div>
      <div className="z-cal__grid">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />
          const ymd = `${year}-${pad(month + 1)}-${pad(day)}`
          const info = priceMap.get(ymd)
          const past = cmp(ymd, today) < 0
          const isFrom = ymd === dateFrom
          const isTo = ymd === dateTo || (picking === 'to' && dateFrom && hover === ymd && cmp(hover, dateFrom) > 0)
          const inRange = !!(dateFrom && rangeEnd && cmp(ymd, dateFrom) > 0 && cmp(ymd, rangeEnd) < 0)
          const edge = isFrom ? 'start' : isTo ? 'end' : undefined
          return (
            <button
              key={ymd}
              type="button"
              disabled={past}
              aria-label={`${fmtDay(ymd)}${info && !noPrices ? `, od ${Math.round(info.min_price)} Kč` : ''}`}
              aria-pressed={!!edge}
              data-edge={edge}
              data-range={inRange || undefined}
              data-today={ymd === today || undefined}
              onClick={() => onDayClick(ymd)}
              onMouseEnter={() => !past && onDayHover(ymd)}
              onFocus={() => !past && onDayHover(ymd)}
              className="z-cal__day"
            >
              <span className="z-cal__num">{day}</span>
              {!noPrices && (info
                ? <span className="z-cal__price" data-tier={tier(info.min_price, allPrices)}>{Math.round(info.min_price / 1000)} k</span>
                : <span className="z-cal__price">&nbsp;</span>)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Výběr termínu odletu a návratu: kalendář se dvěma měsíci, cenami po dnech a přehledem vybraných dat. */
export default function DateRangePicker({
  dateFrom, dateTo, destination, onDateFromChange, onDateToChange, defaultOpen, inline, onComplete,
  flex, onFlexChange, noPrices, placeholder = 'Vybrat termín',
}: Props) {
  const today = toYMD(new Date())
  const init = dateFrom
    ? (() => { const [y, m] = dateFrom.split('-').map(Number); return { year: y, month: m - 1 } })()
    : { year: new Date().getFullYear(), month: new Date().getMonth() }

  const [viewYear, setViewYear] = useState(init.year)
  const [viewMonth, setViewMonth] = useState(init.month)
  const [open, setOpen] = useState(defaultOpen ?? false)
  const [picking, setPicking] = useState<'from' | 'to'>('from')
  const [hover, setHover] = useState('')
  const [priceMap, setPriceMap] = useState<Map<string, DayPrice>>(new Map())
  const [allPrices, setAllPrices] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const popRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const calcPos = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const width = Math.min(720, window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left - 20, window.innerWidth - width - 12))
    const below = r.bottom + 14
    const top = below + 520 > window.innerHeight && r.top > 540 ? Math.max(12, r.top - 534) : below
    setPos({ top, left, width })
  }, [])

  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', calcPos, true)
    window.addEventListener('resize', calcPos)
    return () => { window.removeEventListener('scroll', calcPos, true); window.removeEventListener('resize', calcPos) }
  }, [open, calcPos])

  const month2 = addMonths(viewYear, viewMonth, 1)

  const loadPrices = useCallback(async () => {
    setLoading(true)
    const { from, to } = priceRange(viewYear, viewMonth)
    const rows = await fetchCalendarPrices(from, to, destination)
    const map = new Map<string, DayPrice>()
    const prices: number[] = []
    rows.forEach(r => { map.set(r.date, r); prices.push(r.min_price) })
    setPriceMap(map); setAllPrices(prices); setLoading(false)
  }, [viewYear, viewMonth, destination])

  useEffect(() => { if ((open || inline) && !noPrices) loadPrices() }, [open, inline, noPrices, loadPrices])

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return
      setOpen(false); setPicking('from')
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setPicking('from') } }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])

  const handleDayClick = (ymd: string) => {
    if (picking === 'from') {
      onDateFromChange(ymd); onDateToChange(''); setPicking('to')
    } else {
      if (cmp(ymd, dateFrom) < 0) { onDateToChange(dateFrom); onDateFromChange(ymd) } else { onDateToChange(ymd) }
      setPicking('from'); setHover('')
      if (inline) onComplete?.(); else setOpen(false)
    }
  }

  const clear = () => { onDateFromChange(''); onDateToChange(''); setPicking('from'); setHover('') }
  const prev = () => { const m = addMonths(viewYear, viewMonth, -1); setViewYear(m.year); setViewMonth(m.month) }
  const next = () => { const m = addMonths(viewYear, viewMonth, 1); setViewYear(m.year); setViewMonth(m.month) }
  const nights = dateFrom && dateTo ? Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) : null

  const triggerLabel = dateFrom && dateTo ? `${fmtShort(dateFrom)} – ${fmtShort(dateTo)}` : dateFrom ? `Od ${fmtShort(dateFrom)}…` : null

  const calendar = (
    <div className="z-cal">
      <div className="z-cal__top">
        <button type="button" className="z-cal__step" data-active={picking === 'from'} onClick={() => setPicking('from')}>
          <span className="z-kicker">Odlet</span>
          <b>{dateFrom ? fmtShort(dateFrom) : 'Vyber den'}</b>
        </button>
        <span className="z-cal__arrow" aria-hidden="true"><Icon name="letadlo" /></span>
        <button type="button" className="z-cal__step" data-active={picking === 'to'} onClick={() => dateFrom && setPicking('to')} disabled={!dateFrom}>
          <span className="z-kicker">Návrat</span>
          <b>{dateTo ? fmtShort(dateTo) : 'Vyber den'}</b>
        </button>
        {nights != null && <span className="z-chip z-chip--sky">{nights} {nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí'}</span>}
      </div>

      <div className="z-cal__nav">
        <button type="button" className="z-iconbtn" onClick={prev} aria-label="Předchozí měsíce"><Icon name="caretLeft" /></button>
        <span className="z-data">{loading ? 'NAČÍTÁM CENY…' : picking === 'from' ? 'KLIKNI NA DEN ODLETU' : 'KLIKNI NA DEN NÁVRATU'}</span>
        <button type="button" className="z-iconbtn" onClick={next} aria-label="Další měsíce"><Icon name="caretRight" /></button>
      </div>

      <div className="z-cal__months" onMouseLeave={() => setHover('')}>
        <MonthGrid year={viewYear} month={viewMonth} priceMap={priceMap} allPrices={allPrices} dateFrom={dateFrom} dateTo={dateTo} hover={hover} picking={picking} today={today} onDayClick={handleDayClick} onDayHover={setHover} noPrices={noPrices} />
        <MonthGrid year={month2.year} month={month2.month} priceMap={priceMap} allPrices={allPrices} dateFrom={dateFrom} dateTo={dateTo} hover={hover} picking={picking} today={today} onDayClick={handleDayClick} onDayHover={setHover} noPrices={noPrices} />
      </div>

      <div className="z-cal__foot">
        {!noPrices && (
          <div className="z-cal__legend">
            <span><i data-tier="low" />Levné</span><span><i data-tier="mid" />Průměrné</span><span><i data-tier="high" />Dražší</span>
            <span className="z-data">CENY OD OSOBY</span>
          </div>
        )}
        {onFlexChange && (
          <div className="z-seg" role="group" aria-label="Pružnost termínu">
            {[{ v: false, l: 'Přesně' }, { v: true, l: '±3 dny' }].map(o => (
              <button key={String(o.v)} type="button" aria-pressed={flex === o.v} onClick={() => onFlexChange(o.v)}>{o.l}</button>
            ))}
          </div>
        )}
        <div className="z-cal__actions">
          {(dateFrom || dateTo) && <button type="button" className="z-more" onClick={clear}>Smazat termín</button>}
          {!inline && <button type="button" className="z-btn z-btn--primary z-btn--sm" onClick={() => { setOpen(false); setPicking('from'); setHover('') }}>Hotovo<span className="z-btn__go"><Icon name="ok" /></span></button>}
        </div>
      </div>
    </div>
  )

  if (inline) return <div className="w-full min-w-0">{calendar}</div>

  return (
    <div ref={triggerRef} className="z-datetrigger">
      <button
        type="button"
        className="z-datetrigger__btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-empty={!triggerLabel || undefined}
        onClick={() => { const n = !open; if (n) calcPos(); setOpen(n); setPicking(dateFrom && !dateTo ? 'to' : 'from') }}
      >
        <span>{triggerLabel ?? placeholder}</span>
      </button>
      {(dateFrom || dateTo) && (
        <button type="button" className="z-datetrigger__clear" aria-label="Smazat termín" onClick={clear}><Icon name="zavrit" size="sm" /></button>
      )}

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div ref={popRef} className="z-calpop" role="dialog" aria-label="Výběr termínu" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
          {calendar}
        </div>,
        document.body,
      )}
    </div>
  )
}

/**
 * Pole termínu pro běžné GET formuláře (stránka /zajezdy, hledání na homepage):
 * uvnitř je kalendář, ven se posílají skryté inputy date_from / date_to (a date_flex).
 */
export function DateRangeField({
  fromName = 'date_from', toName = 'date_to', flexName = 'date_flex',
  defaultFrom = '', defaultTo = '', defaultFlex = true, withFlex = true, destination, disabled,
}: {
  fromName?: string; toName?: string; flexName?: string
  defaultFrom?: string; defaultTo?: string; defaultFlex?: boolean; withFlex?: boolean
  destination?: string; disabled?: boolean
}) {
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [flex, setFlex] = useState(defaultFlex)
  return (
    <>
      <input type="hidden" name={fromName} value={from} disabled={disabled} />
      <input type="hidden" name={toName} value={to} disabled={disabled} />
      {withFlex && from && <input type="hidden" name={flexName} value={flex ? '1' : '0'} disabled={disabled} />}
      <DateRangePicker
        dateFrom={from} dateTo={to} destination={destination}
        onDateFromChange={setFrom} onDateToChange={setTo}
        flex={flex} onFlexChange={withFlex ? setFlex : undefined}
        placeholder="Kdykoli"
      />
    </>
  )
}
