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
  // Rozměry odpovídají zobrazené velikosti (karta je jen půlka sloupce), aby písmo nebylo zmenšené a graf byl čitelný
  const W = 360
  const H = 260
  const PAD = { top: 26, right: 6, bottom: 34, left: 6 }
  const CW = W - PAD.left - PAD.right
  const CH = H - PAD.top - PAD.bottom
  const barW = CW / 12
  const gap = barW * 0.22

  return (
    <div className="z-chartcard">
      <div className="px-5 pt-4 pb-1">
        <h3 className="h4">{title}</h3>
      </div>
      <div className="px-2 pb-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ fontFamily: 'var(--font-sans)' }}>
          {/* Bars */}
          {values.map((v, i) => {
            const bh = maxVal > 0 ? (v / maxVal) * CH : 0
            const bx = PAD.left + i * barW + gap / 2
            const by = PAD.top + CH - bh
            const isHighlight = highlightMonths?.includes(i + 1)
            const barColor = isHighlight ? 'var(--brand-strong)' : color

            return (
              <g key={i}>
                <rect x={bx} y={by} width={barW - gap} height={bh}
                  fill={barColor} rx="4" opacity={isHighlight ? 1 : 0.8} />
                {/* Value label on top */}
                {v > 0 && (
                  <text x={bx + (barW - gap) / 2} y={by - 4}
                    textAnchor="middle" fontSize="12.5" fill="var(--ink)" fontWeight="700" fontFamily="var(--font-mono)">
                    {v}
                  </text>
                )}
                {/* Month label */}
                <text x={bx + (barW - gap) / 2} y={PAD.top + CH + 20}
                  textAnchor="middle" fontSize="11.5" fill="var(--ink-muted)" fontFamily="var(--font-mono)">
                  {MONTHS[i]}
                </text>
              </g>
            )
          })}

          {/* Baseline */}
          <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH}
            stroke="var(--line-strong)" strokeWidth="1" />
        </svg>
        {maxVal === 0 && <p className="z-data" style={{ textAlign: 'center', textTransform: 'none' }}>Hodnoty jsou po celý rok prakticky nulové.</p>}
        <p className="z-data" style={{ textAlign: 'right', paddingRight: 16 }}>{unit.toUpperCase()}</p>
      </div>
    </div>
  )
}
