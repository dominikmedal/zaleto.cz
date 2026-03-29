'use client'
import { useState } from 'react'

interface Props {
  name: string
  air: number[]     // 12 monthly values
  sea?: number[]    // 12 monthly values (optional)
}

const MONTHS = ['Led', 'Únr', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
const MONTHS_FULL = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']

const W = 700
const H = 230
const PAD = { top: 36, right: 16, bottom: 34, left: 44 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  const tension = 0.25
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)]
    const p1 = pts[i - 1]
    const p2 = pts[i]
    const p3 = pts[Math.min(pts.length - 1, i + 1)]
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

export default function ClimateChart({ name, air, sea }: Props) {
  const [tooltip, setTooltip] = useState<{ i: number; x: number; y: number } | null>(null)

  const allVals = [...air, ...(sea ?? [])]
  const rawMin = Math.min(...allVals)
  const rawMax = Math.max(...allVals)
  const minV = Math.floor((rawMin - 3) / 2) * 2
  const maxV = Math.ceil((rawMax + 3) / 2) * 2
  const range = maxV - minV

  const xPos = (i: number) => PAD.left + (i / 11) * CW
  const yPos = (v: number) => PAD.top + CH - ((v - minV) / range) * CH

  const airPts: [number, number][] = air.map((v, i) => [xPos(i), yPos(v)])
  const seaPts: [number, number][] = (sea ?? []).map((v, i) => [xPos(i), yPos(v)])

  const step = range > 22 ? 4 : 2
  const ticks: number[] = []
  for (let v = minV; v <= maxV; v += step) ticks.push(v)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 text-[15px]">{name}</h3>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-full bg-[#ff8c2e] inline-block" />
              Vzduch
            </span>
            {sea && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-full bg-[#4db6e8] inline-block" />
                Moře
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative px-2 pb-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          style={{ fontFamily: 'inherit' }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Chart bg */}
          <rect x={PAD.left} y={PAD.top} width={CW} height={CH} fill="#f7f8fa" rx="6" />

          {/* Horizontal grid lines + Y labels */}
          {ticks.map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={yPos(v)} x2={PAD.left + CW} y2={yPos(v)}
                stroke={v === 0 ? '#d1d5db' : '#e5e7eb'} strokeWidth="1" />
              <text x={PAD.left - 6} y={yPos(v)} textAnchor="end" dominantBaseline="middle"
                fontSize="10" fill="#6b7280">{v}°</text>
            </g>
          ))}

          {/* X axis labels */}
          {MONTHS.map((m, i) => (
            <text key={m} x={xPos(i)} y={PAD.top + CH + 18} textAnchor="middle"
              fontSize="9" fill="#9ca3af">{m}</text>
          ))}

          {/* Sea line + dots */}
          {sea && (
            <>
              <path d={smoothPath(seaPts)} fill="none" stroke="#4db6e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              {seaPts.map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="3.5" fill="#4db6e8" stroke="white" strokeWidth="1.5"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setTooltip({ i, x: cx, y: cy })} />
              ))}
            </>
          )}

          {/* Air line + dots */}
          <path d={smoothPath(airPts)} fill="none" stroke="#ff8c2e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {airPts.map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3.5" fill="#ff8c2e" stroke="white" strokeWidth="1.5"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setTooltip({ i, x: cx, y: cy })} />
          ))}

          {/* Tooltip */}
          {tooltip !== null && (() => {
            const i = tooltip.i
            const bw = sea ? 116 : 84
            const bh = sea ? 58 : 42
            let tx = tooltip.x - bw / 2
            tx = Math.max(PAD.left + 4, Math.min(W - PAD.right - bw - 4, tx))
            const ty = tooltip.y - bh - 14

            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tx} y={ty} width={bw} height={bh} rx="8" fill="white"
                  stroke="#e5e7eb" strokeWidth="1"
                  style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))' }} />
                <text x={tx + bw / 2} y={ty + 13} textAnchor="middle" fontSize="10" fontWeight="600" fill="#374151">
                  {MONTHS_FULL[i]}
                </text>
                <text x={tx + 10} y={ty + 28} fontSize="9.5" fill="#ff8c2e" fontWeight="600">● {air[i]}°C vzduch</text>
                {sea && (
                  <text x={tx + 10} y={ty + 43} fontSize="9.5" fill="#4db6e8" fontWeight="600">● {sea[i]}°C moře</text>
                )}
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}
