'use client'
import React, { useState, useEffect } from 'react'
import { PiMagnifyingGlass, PiArrowsDownUp, PiCheckCircle, PiAirplane, PiBuildings, PiGlobe, PiTag } from 'react-icons/pi'

interface Props {
  totalHotels: number
  totalTours:  number
  countryCount: number
  minPrice: number | null
}

const STEPS = [
  { num: '1', bg: 'bg-blue-50',    Icon: PiMagnifyingGlass, color: 'text-[#0093FF]', badgeBg: 'bg-[#0093FF]', title: 'Zadej destinaci',   sub: 'nebo jen termín odjezdu'     },
  { num: '2', bg: 'bg-[#f0fcfa]',  Icon: PiArrowsDownUp,    color: 'text-teal-600',  badgeBg: 'bg-teal-500',  title: 'Srovnáme za tebe',  sub: '15+ cestovních kanceláří'    },
  { num: '3', bg: 'bg-emerald-50', Icon: PiCheckCircle,      color: 'text-emerald-600', badgeBg: 'bg-emerald-500', title: 'Vyber a rezervuj', sub: 'přímo u CK · bez poplatků' },
] as const

// [activeStep, isFlying, connectorIndex, durationMs]
const PHASES: [number, boolean, number, number][] = [
  [0, false, -1, 2400],
  [0, true,   0,  950],
  [1, false, -1, 2400],
  [1, true,   1,  950],
  [2, false, -1, 2400],
]

function fmt(n: number | null): string {
  if (n == null) return '0'
  if (n >= 10_000) return `${Math.round(n / 1000)} tis.`
  if (n >= 1_000)  return `${(n / 1000).toFixed(1).replace('.', ',')} tis.`
  return n.toLocaleString('cs-CZ')
}

export default function HomeStepper({ totalHotels, totalTours, countryCount, minPrice }: Props) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setPhase(p => (p + 1) % PHASES.length), PHASES[phase][3])
    return () => clearTimeout(t)
  }, [phase])

  const [activeStep, isFlying, flyConn] = PHASES[phase]

  const stats = [
    { Icon: PiBuildings, value: fmt(totalHotels), label: 'hotelů'   },
    { Icon: PiAirplane,  value: fmt(totalTours),  label: 'termínů'  },
    { Icon: PiGlobe,     value: String(countryCount), label: 'zemí' },
    { Icon: PiTag,       value: `od ${fmt(minPrice)} Kč`, label: 'cena / os.' },
  ]

  return (
    <>
      <style>{`
        @keyframes home-fly {
          0%   { left: -2px;               opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { left: calc(100% - 14px);  opacity: 0; }
        }
        .home-plane { animation: home-fly 950ms ease-in-out forwards; }
      `}</style>

      <div className="hidden sm:flex items-center gap-0 py-1">

        {/* ── Stepper ── */}
        <div className="flex items-center flex-1 min-w-0">
          {STEPS.map((step, i) => {
            const active = i === activeStep
            return (
              <React.Fragment key={step.num}>
                <div className={`flex items-center gap-2.5 flex-shrink-0 transition-all duration-500 ${active ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="relative flex-shrink-0">
                    <div className={`w-9 h-9 rounded-xl ${step.bg} flex items-center justify-center transition-shadow duration-500 ${active ? 'shadow-md' : ''}`}>
                      <step.Icon className={`w-5 h-5 ${step.color} transition-transform duration-500 ${active ? 'scale-110' : 'scale-100'}`} />
                    </div>
                    <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full ${step.badgeBg} text-white text-[8px] font-extrabold flex items-center justify-center leading-none select-none`}>
                      {step.num}
                    </span>
                  </div>
                  <div>
                    <p className={`text-xs font-bold leading-tight transition-colors duration-500 ${active ? 'text-gray-900' : 'text-gray-600'}`}>
                      {step.title}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{step.sub}</p>
                  </div>
                </div>

                {/* Connector with flying plane */}
                {i < 2 && (
                  <div className="flex-1 mx-4 relative h-5 flex items-center min-w-[32px]">
                    <div
                      className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
                      style={{ backgroundImage: 'repeating-linear-gradient(to right, #d1d5db 0, #d1d5db 5px, transparent 5px, transparent 11px)' }}
                    />
                    {isFlying && flyConn === i && (
                      <div key={`plane-${phase}`} className="home-plane absolute top-1/2 -translate-y-1/2">
                        <PiAirplane className="w-3.5 h-3.5 text-[#0093FF] drop-shadow-sm" style={{ transform: 'rotate(90deg)' }} />
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Divider */}
        <div className="mx-6 w-px h-10 bg-gray-200 flex-shrink-0" />

        {/* ── Stats 2×2 ── */}
        <div className="flex-shrink-0 grid grid-cols-2 gap-x-7 gap-y-3">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="text-[18px] font-bold tabular-nums text-gray-900 leading-none">{value}</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

      </div>
    </>
  )
}
