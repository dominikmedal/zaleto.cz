import Link from 'next/link'
import { PiMapPin, PiBuildings } from 'react-icons/pi'
import { fetchNearbyHotels } from '@/lib/api'
import type { NearbyHotel } from '@/lib/types'

function formatPriceShort(p: number) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(p)
}

export default async function NearbyHotels({ lat, lon, exclude }: { lat: number; lon: number; exclude: string }) {
  let nearby: NearbyHotel[] = []
  try {
    nearby = await fetchNearbyHotels(lat, lon, exclude, 12)
  } catch {
    return null
  }

  if (nearby.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="flex items-center gap-2.5 text-[17px] font-semibold text-gray-900 mb-4">
        <span className="text-[#008afe] flex-shrink-0"><PiMapPin className="w-5 h-5" /></span>
        Hotely v okolí
      </h3>
      <div className="divide-y divide-gray-50">
        {nearby.map(n => (
          <Link
            key={n.slug}
            href={`/hotel/${n.slug}`}
            className="flex items-center gap-3 py-2.5 group"
          >
            <div className="w-10 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              {n.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.thumbnail_url} alt={n.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PiBuildings className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-[#008afe] transition-colors">{n.name}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {n.stars ? <span className="text-[10px] text-amber-400">{'★'.repeat(n.stars)}</span> : null}
                {n.distance_km != null && <span className="text-[10px] text-gray-400">{n.distance_km.toFixed(1)} km</span>}
                {n.agency && <span className="text-[10px] text-blue-500 font-medium">{n.agency}</span>}
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-600 flex-shrink-0 tabular-nums">{formatPriceShort(n.min_price)} Kč</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
