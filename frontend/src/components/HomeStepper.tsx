'use client'
import React, { useState, useEffect } from 'react'
import {
  PiMagnifyingGlass, PiArrowsDownUp, PiCheckCircle,
  PiAirplane,
} from 'react-icons/pi'

interface Props {
  totalHotels: number
  totalTours:  number
  countryCount: number
  minPrice: number | null
}

const STEPS = [
  {
    num: '01',
    Icon: PiMagnifyingGlass,
    title: 'Zadej destinaci',
    sub:   'nebo jen termín odjezdu',
  },
  {
    num: '02',
    Icon: PiArrowsDownUp,
    title: 'Srovnáme za tebe',
    sub:   '15+ cestovních kanceláří',
  },
  {
    num: '03',
    Icon: PiCheckCircle,
    title: 'Vyber a rezervuj',
    sub:   'přímo u CK · bez poplatků',
  },
] as const

// [activeStep, isFlying, connectorIdx, durationMs]
const PHASES: [number, boolean, number, number][] = [
  [0, false, -1, 2800],
  [0, true,   0,  900],
  [1, false, -1, 2800],
  [1, true,   1,  900],
  [2, false, -1, 2800],
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
    { value: fmt(totalHotels),          label: 'hotelů'     },
    { value: fmt(totalTours),           label: 'termínů'    },
    { value: String(countryCount),      label: 'zemí'       },
    { value: `od ${fmt(minPrice)} Kč`,  label: 'cena / os.' },
  ]

  return (
    <>
      <style>{`
        @keyframes plane-fly {
          0%   { left: 2px;               opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { left: calc(100% - 18px); opacity: 0; }
        }
        .hs-plane { animation: plane-fly 900ms cubic-bezier(0.33, 0, 0.66, 1) forwards; }

        @keyframes hs-badge-in {
          0%   { transform: scale(0.7) rotate(-8deg); opacity: 0; }
          60%  { transform: scale(1.12) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg);   opacity: 1; }
        }
        .hs-badge-pop { animation: hs-badge-in 0.38s ease-out forwards; }
      `}</style>

      {/* ── Desktop layout ── */}
      <div className="hidden sm:flex items-center gap-5">

        {/* Steps */}
        <div className="flex items-stretch flex-1 min-w-0 gap-2">
          {STEPS.map((step, i) => {
            const active = i === activeStep
            return (
              <React.Fragment key={step.num}>

                {/* Step card */}
                <div
                  className="relative flex-1 min-w-0 rounded-2xl px-4 py-4 overflow-hidden transition-all duration-500 flex flex-col gap-3"
                  style={{
                    background: active
                      ? 'rgba(255,255,255,0.88)'
                      : 'rgba(237,246,255,0.45)',
                    backdropFilter: 'blur(16px) saturate(150%)',
                    WebkitBackdropFilter: 'blur(16px) saturate(150%)',
                    border: active
                      ? '1.5px solid rgba(0,147,255,0.28)'
                      : '1.5px solid rgba(200,227,255,0.50)',
                    boxShadow: active
                      ? '0 4px 24px rgba(0,147,255,0.12), inset 0 1px 0 rgba(255,255,255,0.95)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.6)',
                    opacity: active ? 1 : 0.72,
                  }}
                >
                  {/* Watermark number */}
                  <span
                    className="absolute right-3 bottom-1 font-black leading-none select-none pointer-events-none"
                    style={{
                      fontSize: 56,
                      color: active ? 'rgba(0,147,255,0.07)' : 'rgba(0,0,0,0.03)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {step.num}
                  </span>

                  {/* Icon row */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)'
                          : 'rgba(200,227,255,0.50)',
                        boxShadow: active ? '0 2px 10px rgba(0,147,255,0.32)' : 'none',
                      }}
                    >
                      <step.Icon
                        style={{
                          width: 18,
                          height: 18,
                          color: active ? '#fff' : '#9ca3af',
                          transition: 'color 0.5s',
                        }}
                      />
                    </div>

                    {/* Step eyebrow */}
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.13em] leading-none"
                      style={{ color: active ? '#0093FF' : '#9ca3af' }}
                    >
                      Krok {i + 1}
                    </span>
                  </div>

                  {/* Text */}
                  <div>
                    <p
                      className="text-[14px] font-bold leading-tight tracking-tight"
                      style={{ color: active ? '#111827' : '#374151' }}
                    >
                      {step.title}
                    </p>
                    <p
                      className="text-[11px] mt-1 leading-snug"
                      style={{ color: active ? '#6b7280' : '#9ca3af' }}
                    >
                      {step.sub}
                    </p>
                  </div>
                </div>

                {/* Connector + plane */}
                {i < 2 && (
                  <div className="relative flex items-center justify-center flex-shrink-0 self-center" style={{ width: 28, height: 28 }}>
                    <div
                      className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
                      style={{
                        backgroundImage: 'repeating-linear-gradient(to right, rgba(0,147,255,0.25) 0, rgba(0,147,255,0.25) 3px, transparent 3px, transparent 8px)',
                      }}
                    />
                    {isFlying && flyConn === i && (
                      <div key={`p-${phase}`} className="hs-plane absolute top-1/2 -translate-y-1/2 z-10">
                        <div style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          width: 18,
                          height: 2,
                          borderRadius: 99,
                          background: 'linear-gradient(to left, rgba(0,147,255,0.55), transparent)',
                        }} />
                        <PiAirplane style={{
                          width: 15,
                          height: 15,
                          color: '#0093FF',
                          transform: 'rotate(90deg)',
                          filter: 'drop-shadow(0 0 4px rgba(0,147,255,0.75))',
                        }} />
                      </div>
                    )}
                  </div>
                )}

              </React.Fragment>
            )
          })}
        </div>

        {/* Divider */}
        <div
          className="flex-shrink-0 w-px self-stretch my-1"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(200,227,255,0.65), transparent)' }}
        />

        {/* Stats */}
        <div className="flex-shrink-0 grid grid-cols-2 gap-x-7 gap-y-3">
          {stats.map(({ value, label }) => (
            <div key={label}>
              <p className="text-[17px] font-bold tabular-nums text-gray-900 leading-none tracking-tight">{value}</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

      </div>

      {/* ── Mobile layout ── */}
      <div className="sm:hidden flex flex-col gap-2.5">
        {STEPS.map((step, i) => (
          <div
            key={step.num}
            className="flex items-center gap-3 rounded-xl px-3.5 py-3"
            style={{
              background: 'rgba(237,246,255,0.60)',
              border: '1px solid rgba(200,227,255,0.65)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
                boxShadow: '0 2px 8px rgba(0,147,255,0.28)',
              }}
            >
              <step.Icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-900 leading-tight">{step.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{step.sub}</p>
            </div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.10em] flex-shrink-0"
              style={{ color: '#0093FF' }}
            >
              {i + 1}/{STEPS.length}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
