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

  const panels: Panel[] = [
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
  ].filter((p): p is Panel => p !== null)

  if (!panels.length) return null

  const activePanel = panels.find(p => p.key === openKey) ?? null

  return (
    <div>
      {/* Tab bar */}
      <div className="flex flex-wrap gap-2">
        {panels.map(({ key, title, Icon }) => {
          const isActive = openKey === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenKey(isActive ? null : key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                isActive
                  ? 'bg-[#008afe] text-white shadow-[#008afe]/25 shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-[#008afe]/40 hover:text-[#008afe] hover:shadow-md'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {title}
            </button>
          )
        })}
      </div>

      {/* Full-width panel */}
      <div
        style={{
          maxHeight: activePanel ? '600px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.25s ease-in-out',
        }}
      >
        {panels.map(({ key, Icon, items, text }) => (
          <div key={key} className={key === openKey ? 'block' : 'hidden'}>
            <div className="mt-2 bg-white border border-gray-100 rounded-2xl shadow-sm p-4 sm:p-5">
              {text && (
                <p className="text-sm text-gray-600 leading-relaxed max-w-3xl">
                  {text.split(/\n\n+/)[0]}
                </p>
              )}
              {Array.isArray(items) && items.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {items.map((item, i) => (
                    <div key={i} className="group flex flex-col gap-2 p-3.5 rounded-2xl border border-gray-100 bg-white hover:border-[#008afe]/25 hover:shadow-sm transition-all">
                      <Icon className="w-5 h-5 text-[#008afe] flex-shrink-0" />
                      <div>
                        <p className="text-[13px] font-semibold text-gray-900 leading-snug mb-1 group-hover:text-[#008afe] transition-colors">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-gray-400 leading-relaxed">{item.description}</p>
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
