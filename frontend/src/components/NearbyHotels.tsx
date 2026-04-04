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
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(0,147,255,0.08)' }}>
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-gray-800">
          <span
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,147,255,0.08)' }}
          >
            <PiMapPin className="w-3.5 h-3.5 text-[#0093FF]" />
          </span>
          Hotely v okolí
        </h3>
      </div>

      {/* List */}
      <div className="px-3 py-2">
        {nearby.map((n, idx) => (
          <Link
            key={n.slug}
            href={`/hotel/${n.slug}`}
            className="flex items-center gap-3 px-1 py-2.5 rounded-xl group transition-colors hover:bg-[rgba(0,147,255,0.04)]"
            style={idx < nearby.length - 1 ? { borderBottom: '1px solid rgba(0,147,255,0.05)' } : undefined}
          >
            {/* Thumbnail */}
            <div className="relative w-12 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 shadow-[0_1px_4px_rgba(0,0,0,0.10)]">
              {n.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={n.thumbnail_url}
                  alt={n.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PiBuildings className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-800 truncate group-hover:text-[#0093FF] transition-colors leading-tight">
                {n.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {n.stars ? (
                  <span className="text-[10px] text-amber-400 leading-none tracking-tighter">
                    {'★'.repeat(Math.min(n.stars, 5))}
                  </span>
                ) : null}
                {n.distance_km != null && (
                  <span className="text-[10px] text-gray-400">
                    {Number(n.distance_km).toFixed(1)} km
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex-shrink-0 text-right">
              <p className="text-[12px] font-bold text-[#039669] tabular-nums leading-tight">
                {formatPriceShort(n.min_price)}
              </p>
              <p className="text-[10px] text-gray-400 leading-tight">Kč / os.</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
