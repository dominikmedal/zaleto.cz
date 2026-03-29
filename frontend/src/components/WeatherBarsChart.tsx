'use client'

interface BarChartProps {
  title: string
  values: number[]
  color: string
  unit: string
  highlightMonths?: number[]  // 1-based month numbers to highlight
}

const MONTHS = ['Led', 'Únr', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']
const MONTHS_FULL = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']

export default function WeatherBarsChart({ title, values, color, unit, highlightMonths }: BarChartProps) {
  const maxVal = Math.max(...values)
  const W = 700
  const H = 200
  const PAD = { top: 12, right: 16, bottom: 36, left: 36 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom
  const barW = CW / 12
  const gap = barW * 0.28

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-1">
        <h3 className="font-semibold text-gray-900 text-[15px]">{title}</h3>
      </div>
      <div className="px-2 pb-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ fontFamily: 'inherit' }}>
          {/* Bars */}
          {values.map((v, i) => {
            const bh = maxVal > 0 ? (v / maxVal) * CH : 0
            const bx = PAD.left + i * barW + gap / 2
            const by = PAD.top + CH - bh
            const isHighlight = highlightMonths?.includes(i + 1)
            const barColor = isHighlight ? '#008afe' : color

            return (
              <g key={i}>
                <rect x={bx} y={by} width={barW - gap} height={bh}
                  fill={barColor} rx="3" opacity={isHighlight ? 1 : 0.75} />
                {/* Value label on top */}
                {v > 0 && (
                  <text x={bx + (barW - gap) / 2} y={by - 4}
                    textAnchor="middle" fontSize="9.5" fill={barColor} fontWeight="600">
                    {v}
                  </text>
                )}
                {/* Month label */}
                <text x={bx + (barW - gap) / 2} y={PAD.top + CH + 18}
                  textAnchor="middle" fontSize="10.5" fill="#9ca3af">
                  {MONTHS[i]}
                </text>
              </g>
            )
          })}

          {/* Baseline */}
          <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH}
            stroke="#e5e7eb" strokeWidth="1" />
        </svg>
        <p className="text-right text-[11px] text-gray-400 pr-4 -mt-1">{unit}</p>
      </div>
    </div>
  )
}
