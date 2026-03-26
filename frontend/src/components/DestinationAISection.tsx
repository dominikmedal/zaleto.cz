import { PiMapPin, PiSparkle } from 'react-icons/pi'

interface Excursion {
  name: string
  emoji: string
  description: string
}

interface Props {
  destination: string
  description: string | null
  excursions: Excursion[]
}

export default function DestinationAISection({ destination, description, excursions }: Props) {
  if (!description && excursions.length === 0) return null

  const paragraphs = description ? description.split(/\n\n+/).filter(Boolean) : []

  return (
    <section className="space-y-6">
      {/* AI description */}
      {paragraphs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-[#0093FF]">
              <PiSparkle className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">
              Proč jet do {destination}
            </h2>
          </div>
          <div className="space-y-3">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-gray-600 text-sm leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Excursions grid */}
      {excursions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-[#0093FF]">
              <PiMapPin className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">
              Co zažít v {destination}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {excursions.map((exc, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div className="text-2xl mb-2">{exc.emoji}</div>
                <p className="text-sm font-semibold text-gray-800 leading-tight mb-1">{exc.name}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{exc.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
