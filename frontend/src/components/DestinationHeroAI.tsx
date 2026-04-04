'use client'
import { useState } from 'react'
import { PiSun, PiMapPin, PiForkKnife, PiMapTrifold, PiCompass } from 'react-icons/pi'
import type { DestinationAIData, DestinationAIItem } from '@/lib/api'

interface Panel {
  key: string
  title: string
  Icon: React.ElementType
  items?: DestinationAIItem[]
  text?: string
}

export default function DestinationHeroAI({ data }: { data: DestinationAIData }) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const panels: Panel[] = ([
    data.best_time
      ? { key: 'best_time', title: 'Kdy jet', Icon: PiSun, text: data.best_time }
      : null,
    (data.places ?? []).length > 0
      ? { key: 'places', title: 'Místa k objevení', Icon: PiMapPin, items: data.places }
      : null,
    (data.food ?? []).length > 0
      ? { key: 'food', title: 'Tradiční jídlo', Icon: PiForkKnife, items: data.food }
      : null,
    (data.trips ?? []).length > 0
      ? { key: 'trips', title: 'Výlety z okolí', Icon: PiMapTrifold, items: data.trips }
      : null,
    (data.excursions ?? []).length > 0
      ? { key: 'excursions', title: 'Co zažít', Icon: PiCompass, items: data.excursions }
      : null,
  ] as (Panel | null)[]).filter((p): p is Panel => p !== null)

  if (!panels.length) return null

  return (
    <div>
      {/* ── Tab bar ── */}
      <div
        className="inline-flex flex-wrap gap-1.5 p-1.5 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.58)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          border: '1px solid rgba(255,255,255,0.75)',
          boxShadow: '0 1px 8px rgba(0,147,255,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {panels.map(({ key, title, Icon }) => {
          const isActive = openKey === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenKey(isActive ? null : key)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 whitespace-nowrap"
              style={
                isActive
                  ? {
                      background: 'linear-gradient(135deg, rgba(0,147,255,0.12) 0%, rgba(0,112,224,0.10) 100%)',
                      border: '1px solid rgba(0,147,255,0.28)',
                      color: '#0068CC',
                      boxShadow: '0 2px 10px rgba(0,147,255,0.14), inset 0 1px 0 rgba(255,255,255,0.8)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(200,227,255,0.45)',
                      color: '#4b5563',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
                    }
              }
            >
              <Icon
                className="w-4 h-4 flex-shrink-0 transition-colors duration-200"
                style={{ color: isActive ? '#0093FF' : '#9ca3af' }}
              />
              {title}
            </button>
          )
        })}
      </div>

      {/* ── Panel ── */}
      <div
        style={{
          maxHeight: openKey ? '700px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.28s ease-in-out',
        }}
      >
        {panels.map(({ key, Icon, items, text }) => (
          <div key={key} className={key === openKey ? 'block' : 'hidden'}>
            <div
              className="mt-2 rounded-2xl p-4 sm:p-5"
              style={{
                background: 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                border: '1px solid rgba(255,255,255,0.78)',
                boxShadow: '0 0 0 0.5px rgba(0,147,255,0.07), 0 4px 20px rgba(0,147,255,0.08), inset 0 1px 0 rgba(255,255,255,0.92)',
              }}
            >
              {text && (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {text.split(/\n\n+/)[0]}
                </p>
              )}
              {Array.isArray(items) && items.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="group flex flex-col gap-2 p-3.5 rounded-xl transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.62)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        border: '1px solid rgba(200,227,255,0.50)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                      }}
                    >
                      <Icon className="w-4 h-4 text-[#0093FF] flex-shrink-0" />
                      <div>
                        <p className="text-[12px] font-semibold text-gray-800 leading-snug mb-0.5 group-hover:text-[#0093FF] transition-colors duration-200">{item.name}</p>
                        {item.description && (
                          <p className="text-[10px] text-gray-400 leading-relaxed">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
