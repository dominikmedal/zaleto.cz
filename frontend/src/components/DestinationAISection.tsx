import CollapsibleSection from '@/components/CollapsibleSection'
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
  /** Show the description text (proč jet) — omit if already shown in hero */
  showDescription?: boolean
}

function ItemList({ items, icon: Icon }: { items: DestinationAIItem[]; icon: React.ElementType }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-blue-50/50 transition-colors">
          <span className="flex-shrink-0 mt-0.5 text-[#0093FF]">
            <Icon className="w-4 h-4" />
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
  const description   = data.description ?? null
  const excursions    = data.excursions  ?? []
  const best_time     = data.best_time   ?? null
  const places        = data.places      ?? []
  const food          = data.food        ?? []
  const trips         = data.trips       ?? []

  const hasSections = best_time || places.length || food.length || trips.length || excursions.length
  if (!hasSections && !description) return null

  const bestTimeParagraphs = best_time ? best_time.split(/\n\n+/).filter(Boolean) : []
  const descParagraphs     = description ? description.split(/\n\n+/).filter(Boolean) : []

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden px-2">
      {/* Description — only when explicitly requested (no-photo hero fallback) */}
      {showDescription && descParagraphs.length > 0 && (
        <CollapsibleSection
          title={`Proč jet do ${destination}`}
          icon={<PiCompass className="w-5 h-5" />}
          defaultOpen
        >
          <div className="space-y-2">
            {descParagraphs.map((p, i) => (
              <p key={i} className="text-gray-600 text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Best time */}
      {bestTimeParagraphs.length > 0 && (
        <CollapsibleSection
          title="Kdy jet"
          icon={<PiSun className="w-5 h-5" />}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {bestTimeParagraphs.map((p, i) => (
              <p key={i} className="text-gray-600 text-sm leading-relaxed">{p}</p>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Places */}
      {places.length > 0 && (
        <CollapsibleSection
          title={`Místa k objevení`}
          icon={<PiMapPin className="w-5 h-5" />}
          defaultOpen={false}
        >
          <ItemList items={places} icon={PiMapPin} />
        </CollapsibleSection>
      )}

      {/* Food */}
      {food.length > 0 && (
        <CollapsibleSection
          title="Tradiční jídlo"
          icon={<PiForkKnife className="w-5 h-5" />}
          defaultOpen={false}
        >
          <ItemList items={food} icon={PiForkKnife} />
        </CollapsibleSection>
      )}

      {/* Day trips */}
      {trips.length > 0 && (
        <CollapsibleSection
          title="Výlety z okolí"
          icon={<PiMapTrifold className="w-5 h-5" />}
          defaultOpen={false}
        >
          <ItemList items={trips} icon={PiMapTrifold} />
        </CollapsibleSection>
      )}

      {/* Activities */}
      {excursions.length > 0 && (
        <CollapsibleSection
          title="Co zažít"
          icon={<PiCompass className="w-5 h-5" />}
          defaultOpen={false}
        >
          <ItemList items={excursions} icon={PiCompass} />
        </CollapsibleSection>
      )}
    </div>
  )
}
