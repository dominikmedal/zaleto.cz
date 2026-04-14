import Image from 'next/image'
import { MapPin } from 'lucide-react'

export interface WikiSummary {
  title: string
  extract: string
  thumbnail?: { source: string; width: number; height: number }
}

interface Props { wiki: WikiSummary; destination: string }

export default function DestinationInfo({ wiki, destination }: Props) {
  const firstSentence = wiki.extract.split(/(?<=[.!?])\s+/)[0]

  return (
    <div className="h-full flex rounded-2xl border border-gray-100 overflow-hidden bg-white shadow-sm">
      {wiki.thumbnail && (
        <div className="relative w-24 flex-shrink-0">
          <Image
            src={wiki.thumbnail.source}
            alt={destination}
            fill
            className="object-cover"
           
            priority
          />
        </div>
      )}
      <div className="flex-1 px-4 py-3 flex flex-col justify-center min-w-0 gap-1">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-blue-500 flex-shrink-0" />
          <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-widest truncate">
            {destination}
          </span>
        </div>
        <p className="text-[13px] font-bold text-gray-900 leading-snug line-clamp-1">
          {wiki.title}
        </p>
        <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
          {firstSentence}
        </p>
      </div>
    </div>
  )
}
