'use client'
import React, { useState, useEffect } from 'react'
import {
  PiMagnifyingGlass, PiArrowsDownUp, PiCheckCircle,
  PiClock, PiAirplane, PiBuildings, PiGlobe, PiTag,
} from 'react-icons/pi'

interface Props {
  totalHotels: number
  totalTours: number
  countryCount: number
  minPrice: number | null
}

const STEPS = [
  { num: '1', bg: 'bg-blue-50',    Icon: PiMagnifyingGlass, color: 'text-[#008afe]',    badgeBg: 'bg-[#008afe]',   title: 'Zadej destinaci',   desc: 'nebo jen termín odjezdu' },
  { num: '2', bg: 'bg-[#f0fcfa]',  Icon: PiArrowsDownUp,    color: 'text-teal-600',      badgeBg: 'bg-teal-500',    title: 'Srovnáme za tebe',  desc: '15+ cestovních kanceláří' },
  { num: '3', bg: 'bg-emerald-50', Icon: PiCheckCircle,      color: 'text-emerald-600',   badgeBg: 'bg-emerald-500', title: 'Vyber a rezervuj',  desc: 'přímo u CK · bez poplatků' },
] as const

// [activeStep, isFlying, connectorIndex, durationMs]
const PHASES: [number, boolean, number, number][] = [
  [0, false, -1, 2400],
  [0, true,   0,  950],
  [1, false, -1, 2400],
  [1, true,   1,  950],
  [2, false, -1, 2400],
]

function fmtNum(n: number | null): string {
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
    { Icon: PiBuildings, value: fmtNum(totalHotels),         label: 'hotelů',     valCls: 'text-gray-900'    },
    { Icon: PiAirplane,  value: fmtNum(totalTours),          label: 'termínů',    valCls: 'text-gray-900'    },
    { Icon: PiGlobe,     value: String(countryCount),        label: 'zemí',       valCls: 'text-gray-900'    },
    { Icon: PiTag,       value: `od ${fmtNum(minPrice)} Kč`, label: 'cena / os.', valCls: 'text-emerald-600' },
  ]

  return (
    <>
      <style>{`
        @keyframes home-fly {
          0%   { left: -2px;            opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { left: calc(100% - 14px); opacity: 0; }
        }
        .home-plane { animation: home-fly 950ms ease-in-out forwards; }
      `}</style>

      <div className="hidden sm:flex items-center mt-4">

        {/* Levá část: animovaný stepper */}
        <div className="flex items-center flex-1 min-w-0">
          {STEPS.map((step, i) => {
            const isActive = i === activeStep
            return (
              <React.Fragment key={step.num}>

                {/* Krok */}
                <div className={`flex items-center gap-2.5 flex-shrink-0 transition-all duration-500 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="relative flex-shrink-0">
                    <div className={`w-9 h-9 rounded-xl ${step.bg} flex items-center justify-center transition-shadow duration-500 ${isActive ? 'shadow-md' : ''}`}>
                      <step.Icon className={`w-5 h-5 ${step.color} transition-transform duration-500 ${isActive ? 'scale-110' : 'scale-100'}`} />
                    </div>
                    <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full ${step.badgeBg} text-white text-[8px] font-extrabold flex items-center justify-center leading-none select-none`}>
                      {step.num}
                    </span>
                  </div>
                  <div>
                    <p className={`text-xs font-bold leading-tight transition-colors duration-500 ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                      {step.title}
                    </p>
                    <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{step.desc}</p>
                  </div>
                </div>

                {/* Spojnice s létajícím letadlem */}
                {i < 2 && (
                  <div className="flex-1 mx-4 relative h-5 flex items-center">
                    <div
                      className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
                      style={{ backgroundImage: 'repeating-linear-gradient(to right, #9ca3af 0, #9ca3af 6px, transparent 6px, transparent 12px)' }}
                    />
                    {isFlying && flyConn === i && (
                      <div key={`plane-${phase}`} className="home-plane absolute top-1/2 -translate-y-1/2">
                        <PiAirplane className="w-3.5 h-3.5 text-[#008afe] drop-shadow-sm" style={{ transform: 'rotate(90deg)' }} />
                      </div>
                    )}
                  </div>
                )}

              </React.Fragment>
            )
          })}

          {/* ~2h badge */}

        </div>

        {/* Svislý oddělovač */}
        <div className="mx-6 w-px h-10 bg-gray-200 flex-shrink-0" />

        {/* Pravá část: statistiky 2×2 */}
        <div className="flex-shrink-0 grid grid-cols-2 gap-x-6 gap-y-2">
          {stats.map(({ Icon, value, label, valCls }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 flex-shrink-0 text-[#008afe]" />
              <div>
                <p className={`text-[13px] font-bold leading-none tabular-nums ${valCls}`}>{value}</p>
                <p className="text-[9px] font-semibold text-gray-400 mt-0.5 leading-none uppercase tracking-wide">{label}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </>
  )
}
