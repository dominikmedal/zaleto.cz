'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { API } from '@/lib/api'

interface GeoHotel {
  id: number; slug: string; name: string
  stars: number | null; resort_town: string | null
  latitude: number; longitude: number; min_price: number
}

const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(n)

export default function HotelsMapView() {
  const sp = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [count,   setCount]   = useState(0)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      setLoading(true)

      const params = new URLSearchParams(sp)
      params.delete('page')
      params.delete('sort')

      try {
        const res = await fetch(`${API}/api/hotels/geo?${params}`)
        if (!res.ok || cancelled) return
        const hotels: GeoHotel[] = await res.json()
        if (cancelled || !containerRef.current) { setLoading(false); return }

        const { default: L } = await import('leaflet')
        if (cancelled) return

        // Clean up previous map instance
        const el = containerRef.current as any
        if (el._leaflet_id) { try { mapRef.current?.remove() } catch { /* ignore */ } }
        delete el._leaflet_id

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl

        const map = L.map(containerRef.current, {
          zoom: 5,
          center: [38, 20],
          scrollWheelZoom: true,
          zoomControl: false,
          attributionControl: true,
        })
        if (cancelled) { map.remove(); return }
        mapRef.current = map

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map)

        const bounds: [number, number][] = []

        hotels.forEach(hotel => {
          bounds.push([hotel.latitude, hotel.longitude])
          const stars = hotel.stars ? '★'.repeat(hotel.stars) : ''
          const loc   = hotel.resort_town || ''

          L.marker([hotel.latitude, hotel.longitude], {
            icon: L.divIcon({
              className: '',
              html: `<div style="background:white;border:2px solid #e5e7eb;border-radius:10px;padding:3px 8px;font-size:11px;font-weight:700;color:#374151;box-shadow:0 2px 8px rgba(0,0,0,0.12);white-space:nowrap;cursor:pointer;">${fmt(hotel.min_price)} Kč</div>`,
              iconSize:   [100, 26],
              iconAnchor: [50, 13],
              popupAnchor: [0, -16],
            }),
          }).addTo(map).bindPopup(`
            <div style="font-family:system-ui,sans-serif;min-width:170px;padding:2px 0">
              ${stars ? `<p style="color:#f59e0b;font-size:11px;margin:0 0 2px;line-height:1">${stars}</p>` : ''}
              <p style="font-weight:700;font-size:13px;margin:0 0 2px;line-height:1.3">${hotel.name}</p>
              ${loc ? `<p style="color:#9ca3af;font-size:11px;margin:0 0 6px">${loc}</p>` : '<div style="height:6px"></div>'}
              <p style="color:#0093FF;font-weight:700;font-size:13px;margin:0 0 8px">od ${fmt(hotel.min_price)} Kč</p>
              <a href="/hotel/${hotel.slug}" style="display:inline-block;background:#0093FF;color:white;font-size:11px;font-weight:600;padding:5px 12px;border-radius:8px;text-decoration:none">Zobrazit →</a>
            </div>
          `)
        })

        if (bounds.length > 0) {
          map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 13 })
        }

        setCount(hotels.length)
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [sp])

  return (
    <div className="relative rounded-2xl border border-gray-100 overflow-hidden" style={{ height: 600 }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0" />

      {/* Hotel count badge */}
      {!loading && (
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm pointer-events-none"
          style={{ zIndex: 500 }}>
          <span className="text-xs font-semibold text-gray-700">
            {count.toLocaleString('cs-CZ')} hotelů na mapě
          </span>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-px" style={{ zIndex: 500 }}>
        <button onClick={() => mapRef.current?.zoomIn()}
          className="w-8 h-8 bg-white/95 border border-gray-200 rounded-t-lg text-lg font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors flex items-center justify-center leading-none">
          +
        </button>
        <button onClick={() => mapRef.current?.zoomOut()}
          className="w-8 h-8 bg-white/95 border border-gray-200 border-t-0 rounded-b-lg text-lg font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors flex items-center justify-center leading-none">
          −
        </button>
      </div>
    </div>
  )
}
