'use client'
import { useState } from 'react'
import {
  PiSun,
  PiMapPin,
  PiForkKnife,
  PiMapTrifold,
  PiCompass,
} from 'react-icons/pi'
import type { DestinationAIData, DestinationAIItem } from '@/lib/api'

interface Props {
  destination: string
  data: DestinationAIData
  showDescription?: boolean
}

function ItemList({ items, icon: Icon }: { items: DestinationAIItem[]; icon: React.ElementType }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3.5 rounded-xl transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.62)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.75)',
            boxShadow: '0 1px 4px rgba(0,147,255,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          <span className="flex-shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-[#0093FF]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{item.name}</p>
            <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DestinationAISection({ destination, data, showDescription = false }: Props) {
  const description        = data.description ?? null
  const excursions         = data.excursions  ?? []
  const best_time          = data.best_time   ?? null
  const places             = data.places      ?? []
  const food               = data.food        ?? []
  const trips              = data.trips       ?? []
  const bestTimeParagraphs = best_time ? best_time.split(/\n\n+/).filter(Boolean) : []
  const descParagraphs     = description ? description.split(/\n\n+/).filter(Boolean) : []

  // Build visible tabs
  const tabs: { id: string; label: string; Icon: React.ElementType; content: React.ReactNode }[] = []

  if (showDescription && descParagraphs.length > 0) {
    tabs.push({
      id: 'popis',
      label: `Proč jet do ${destination}`,
      Icon: PiCompass,
      content: (
        <div className="space-y-2.5">
          {descParagraphs.map((p, i) => (
            <p key={i} className="text-gray-600 text-sm leading-relaxed">{p}</p>
          ))}
        </div>
      ),
    })
  }

  if (bestTimeParagraphs.length > 0) {
    tabs.push({
      id: 'kdy',
      label: 'Kdy jet',
      Icon: PiSun,
      content: (
        <div className="space-y-2.5">
          {bestTimeParagraphs.map((p, i) => (
            <p key={i} className="text-gray-600 text-sm leading-relaxed">{p}</p>
          ))}
        </div>
      ),
    })
  }

  if (places.length > 0) {
    tabs.push({ id: 'mista', label: 'Místa k objevení', Icon: PiMapPin, content: <ItemList items={places} icon={PiMapPin} /> })
  }

  if (food.length > 0) {
    tabs.push({ id: 'jidlo', label: 'Tradiční jídlo', Icon: PiForkKnife, content: <ItemList items={food} icon={PiForkKnife} /> })
  }

  if (trips.length > 0) {
    tabs.push({ id: 'vylety', label: 'Výlety z okolí', Icon: PiMapTrifold, content: <ItemList items={trips} icon={PiMapTrifold} /> })
  }

  if (excursions.length > 0) {
    tabs.push({ id: 'zazit', label: 'Co zažít', Icon: PiCompass, content: <ItemList items={excursions} icon={PiCompass} /> })
  }

  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '')
  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0]

  if (tabs.length === 0) return null

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.62)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.78)',
        boxShadow: '0 0 0 0.5px rgba(0,147,255,0.08), 0 4px 24px rgba(0,147,255,0.09), 0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.92)',
      }}
    >
      {/* Tab bar */}
      <div
        className="flex items-center gap-1 px-3 py-2.5 overflow-x-auto scrollbar-hide"
        style={{ borderBottom: '1px solid rgba(200,227,255,0.45)' }}
      >
        {tabs.map(tab => {
          const active = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 whitespace-nowrap"
              style={
                active
                  ? {
                      background: 'rgba(0,147,255,0.10)',
                      border: '1px solid rgba(0,147,255,0.25)',
                      color: '#0068CC',
                      boxShadow: '0 1px 6px rgba(0,147,255,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
                    }
                  : {
                      background: 'transparent',
                      border: '1px solid transparent',
                      color: '#9ca3af',
                    }
              }
            >
              <tab.Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors duration-200 ${active ? 'text-[#0093FF]' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab?.content}
      </div>
    </div>
  )
}
