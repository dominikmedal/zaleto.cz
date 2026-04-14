'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { PiTimer, PiCalendarStar, PiSun, PiMapPin } from 'react-icons/pi'

interface Props {
  resortTowns: string[]
}

const MONTHS = [
  { label: 'Červen',    from: '2026-06-01', to: '2026-06-30' },
  { label: 'Červenec', from: '2026-07-01', to: '2026-07-31' },
  { label: 'Srpen',    from: '2026-08-01', to: '2026-08-31' },
  { label: 'Září',     from: '2026-09-01', to: '2026-09-30' },
]

export default function DestinationQuickFilter({ resortTowns }: Props) {
  const spBase = useSearchParams()
  const [sp, setSp] = useState(() => new URLSearchParams(spBase.toString()))

  useEffect(() => {
    setSp(new URLSearchParams(spBase.toString()))
  }, [spBase])

  const dispatch = useCallback((params: URLSearchParams) => {
    setSp(params)
    window.dispatchEvent(new CustomEvent('filterchange', { detail: params.toString() }))
  }, [])

  const activeLM    = sp.get('last_minute') === '1'
  const activeFM    = sp.get('first_minute') === '1'
  const dateFrom    = sp.get('date_from') ?? ''
  const dateTo      = sp.get('date_to') ?? ''
  const activeTown  = sp.get('resort_town') ?? ''
  const activeMonth = MONTHS.find(m => m.from === dateFrom && m.to === dateTo) ?? null

  const toggleLM = () => {
    const p = new URLSearchParams(sp.toString())
    if (activeLM) { p.delete('last_minute') } else { p.set('last_minute', '1'); p.delete('first_minute') }
    dispatch(p)
  }

  const toggleFM = () => {
    const p = new URLSearchParams(sp.toString())
    if (activeFM) { p.delete('first_minute') } else { p.set('first_minute', '1'); p.delete('last_minute') }
    dispatch(p)
  }

  const toggleMonth = (m: typeof MONTHS[number]) => {
    const p = new URLSearchParams(sp.toString())
    if (activeMonth?.from === m.from) { p.delete('date_from'); p.delete('date_to') }
    else { p.set('date_from', m.from); p.set('date_to', m.to) }
    dispatch(p)
  }

  const toggleTown = (town: string) => {
    const p = new URLSearchParams(sp.toString())
    if (activeTown === town) { p.delete('resort_town') } else { p.set('resort_town', town) }
    dispatch(p)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-0.5">
      {/* Kdy jet label */}
      <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mr-0.5">Kdy jet</span>

      {/* LM / FM */}
      <button
        onClick={toggleLM}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
          activeLM
            ? 'bg-red-500 border-red-500 text-white shadow-sm'
            : 'bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500'
        }`}
      >
        <PiTimer className="w-3.5 h-3.5" /> Last minute
      </button>
      <button
        onClick={toggleFM}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-all ${
          activeFM
            ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
            : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-500'
        }`}
      >
        <PiCalendarStar className="w-3.5 h-3.5" /> First minute
      </button>

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      {/* Month chips */}
      {MONTHS.map(m => (
        <button
          key={m.from}
          onClick={() => toggleMonth(m)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
            activeMonth?.from === m.from
              ? 'bg-[#0093FF] border-[#0093FF] text-white shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:border-[#0093FF]/40 hover:text-[#0093FF]'
          }`}
        >
          <PiSun className="w-3 h-3" /> {m.label}
        </button>
      ))}

      {/* Resort towns */}
      {resortTowns.length > 0 && (
        <>
          <div className="w-px h-4 bg-gray-200 mx-0.5" />
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-semibold uppercase tracking-wide mr-0.5">
            <PiMapPin className="w-3 h-3" /> Místa
          </span>
          {resortTowns.slice(0, 10).map(town => (
            <button
              key={town}
              onClick={() => toggleTown(town)}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                activeTown === town
                  ? 'bg-[#0093FF] border-[#0093FF] text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-[#0093FF]/40 hover:text-[#0093FF]'
              }`}
            >
              {town}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
