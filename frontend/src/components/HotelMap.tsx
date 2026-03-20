'use client'
import { useEffect, useRef, useState } from 'react'
import type { Hotel } from '@/lib/types'

interface NearbyHotel {
  id: number; slug: string; name: string
  stars: number | null; thumbnail_url: string | null
  min_price: number; resort_town: string | null
  latitude: number; longitude: number; distance_km?: number
}
interface Props { hotel: Hotel; nearby: NearbyHotel[] }
interface PoiEl { id: number; lat: number; lon: number; tags: Record<string, string> }

const POI_LAYERS = [
  { id: 'beach',      label: 'Pláže',      emoji: '🏖️', color: '#0891b2', limit: 30 },
  { id: 'attraction', label: 'Atrakce',    emoji: '🏛️', color: '#d97706', limit: 20 },
  { id: 'food',       label: 'Restaurace', emoji: '🍽️', color: '#059669', limit: 25 },
] as const
type LayerId = 'hotels' | 'beach' | 'attraction' | 'food'

const TYPE_LABELS: Record<string, string> = {
  museum: 'Muzeum', viewpoint: 'Vyhlídka', artwork: 'Umělecké dílo',
  theme_park: 'Zábavní park', zoo: 'Zoo', gallery: 'Galerie', attraction: 'Atrakce',
  castle: 'Hrad / Zámek', monument: 'Památník', memorial: 'Pomník',
  ruins: 'Zřícenina', archaeological_site: 'Naleziště',
  restaurant: 'Restaurace', cafe: 'Kavárna', bar: 'Bar',
  fast_food: 'Fast food', pub: 'Hospoda', biergarten: 'Biergarten',
  beach: 'Pláž', beach_resort: 'Plážový resort', water_park: 'Aquapark',
}

function poiName(tags: Record<string, string>, fallback: string) {
  return (
    tags.name || tags['name:cs'] || tags['name:en'] || tags['name:de'] ||
    TYPE_LABELS[tags.tourism ?? ''] || TYPE_LABELS[tags.historic ?? ''] ||
    TYPE_LABELS[tags.amenity ?? ''] || TYPE_LABELS[tags.leisure ?? ''] ||
    TYPE_LABELS[tags.natural ?? ''] || fallback
  )
}

function categorizePoi(tags: Record<string, string>): 'beach' | 'attraction' | 'food' | null {
  const { natural, tourism, leisure, amenity, historic } = tags
  if (natural === 'beach' || tourism === 'beach' || leisure === 'beach_resort' || leisure === 'water_park') return 'beach'
  if (tourism && ['attraction','museum','viewpoint','gallery','artwork','theme_park','zoo'].includes(tourism)) return 'attraction'
  if (historic && ['monument','memorial','castle','ruins','archaeological_site'].includes(historic)) return 'attraction'
  if (amenity && ['restaurant','bar','cafe','fast_food','pub','biergarten'].includes(amenity)) return 'food'
  return null
}

const fmt = (n: number) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(n)

const TILES = {
  map:       { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',            attr: '© <a href="https://openstreetmap.org">OpenStreetMap</a>' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles © Esri' },
}

export default function HotelMap({ hotel, nearby }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const mapRef         = useRef<any>(null)
  const baseTileRef    = useRef<any>(null)
  const layerGroupsRef = useRef<Record<string, any>>({})
  const [active, setActive]       = useState<Set<LayerId>>(new Set(['hotels']))
  const [satellite, setSatellite] = useState(false)
  const [poiStatus, setPoiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const poiStatusRef = useRef(poiStatus)
  poiStatusRef.current = poiStatus

  // Init map — cancelled flag prevents double-init from React StrictMode
  useEffect(() => {
    if (!hotel.latitude || !hotel.longitude) return
    let cancelled = false

    import('leaflet').then(({ default: L }) => {
      if (cancelled || !containerRef.current) return
      // Remove any leftover Leaflet state from previous run
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = containerRef.current as any
      if (el._leaflet_id) { try { el._leaflet?.remove() } catch { /* ignore */ } }
      delete el._leaflet_id

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(containerRef.current!, {
        center: [hotel.latitude!, hotel.longitude!],
        zoom: 13,
        scrollWheelZoom: true,
        zoomControl: false,
        dragging: true,
      })
      if (cancelled) { map.remove(); return }
      mapRef.current = map

      baseTileRef.current = L.tileLayer(TILES.map.url, { attribution: TILES.map.attr, maxZoom: 19 }).addTo(map)

      // Hotels layer
      const hotelsLayer = L.layerGroup().addTo(map)
      layerGroupsRef.current['hotels'] = hotelsLayer

      L.marker([hotel.latitude!, hotel.longitude!], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:46px;height:46px;border-radius:50%;background:#0093FF;border:3px solid white;box-shadow:0 3px 16px rgba(0,147,255,0.5);display:flex;align-items:center;justify-content:center;font-size:20px;">🏨</div>`,
          iconSize: [46, 46], iconAnchor: [23, 23], popupAnchor: [0, -26],
        }),
      }).addTo(hotelsLayer).bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:170px;padding:2px 0">
          <p style="font-weight:700;font-size:14px;margin:0 0 3px">${hotel.name}</p>
          <p style="color:#6b7280;font-size:12px;margin:0 0 5px">${hotel.resort_town || hotel.destination || ''}</p>
          ${hotel.min_price ? `<p style="color:#0093FF;font-weight:700;margin:0">od ${fmt(hotel.min_price)} Kč</p>` : ''}
        </div>
      `).openPopup()

      nearby.forEach(n => {
        if (!n.latitude || !n.longitude) return
        L.marker([n.latitude, n.longitude], {
          icon: L.divIcon({
            className: '',
            html: `<div style="background:white;border:2px solid #d1d5db;border-radius:10px;padding:3px 8px;font-size:11px;font-weight:700;color:#374151;box-shadow:0 2px 8px rgba(0,0,0,0.12);white-space:nowrap;">🏨 ${fmt(n.min_price)} Kč</div>`,
            iconSize: [120, 26], iconAnchor: [60, 13], popupAnchor: [0, -15],
          }),
        }).addTo(hotelsLayer).bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:150px;padding:2px 0">
            <p style="font-weight:700;font-size:13px;margin:0 0 3px">${n.name}</p>
            <p style="color:#6b7280;font-size:11px;margin:0 0 5px">${'★'.repeat(n.stars || 0)}${n.distance_km ? ` · ${n.distance_km.toFixed(1)} km` : ''}</p>
            <a href="/hotel/${n.slug}" style="color:#0093FF;font-size:12px;font-weight:600;text-decoration:none">Zobrazit →</a>
          </div>
        `)
      })

      const pts: [number, number][] = [
        [hotel.latitude!, hotel.longitude!],
        ...nearby.filter(n => n.latitude && n.longitude).map(n => [n.latitude, n.longitude] as [number, number]),
      ]
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 14 })
    })

    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Show/hide layers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    Object.entries(layerGroupsRef.current).forEach(([id, lg]) => {
      if (active.has(id as LayerId)) { if (!map.hasLayer(lg)) map.addLayer(lg) }
      else                           { if (map.hasLayer(lg))  map.removeLayer(lg) }
    })
  }, [active])

  // Switch base tile
  useEffect(() => {
    const map = mapRef.current
    if (!map || !baseTileRef.current) return
    import('leaflet').then(({ default: L }) => {
      baseTileRef.current.remove()
      const t = satellite ? TILES.satellite : TILES.map
      baseTileRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map)
      baseTileRef.current.bringToBack()
    })
  }, [satellite])

  const loadPois = async () => {
    if (poiStatusRef.current !== 'idle' || !hotel.latitude || !hotel.longitude) return
    setPoiStatus('loading')
    try {
      const q = `[out:json][timeout:25];
(
  node["natural"="beach"](around:8000,${hotel.latitude},${hotel.longitude});
  node["leisure"~"^(beach_resort|water_park)$"](around:8000,${hotel.latitude},${hotel.longitude});
  node["tourism"="beach"](around:8000,${hotel.latitude},${hotel.longitude});
  node["tourism"~"^(attraction|museum|viewpoint|gallery|artwork|theme_park|zoo)$"](around:5000,${hotel.latitude},${hotel.longitude});
  node["historic"~"^(monument|memorial|castle|ruins|archaeological_site)$"](around:5000,${hotel.latitude},${hotel.longitude});
  node["amenity"~"^(restaurant|bar|cafe|fast_food|pub)$"](around:2500,${hotel.latitude},${hotel.longitude});
);
out body;`
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(q)}`,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const { default: L } = await import('leaflet')

      const counts: Record<string, number> = {}
      ;((data.elements || []) as PoiEl[])
        .filter(el => el.lat && el.lon)
        .sort((a, b) =>
          Math.hypot(a.lat - hotel.latitude!, a.lon - hotel.longitude!) -
          Math.hypot(b.lat - hotel.latitude!, b.lon - hotel.longitude!)
        )
        .forEach(el => {
          const cat = categorizePoi(el.tags || {})
          if (!cat) return
          const layer = POI_LAYERS.find(l => l.id === cat)!
          counts[cat] = counts[cat] || 0
          if (counts[cat] >= layer.limit) return
          counts[cat]++
          if (!layerGroupsRef.current[cat]) layerGroupsRef.current[cat] = L.layerGroup()
          const name = poiName(el.tags, layer.label)
          L.marker([el.lat, el.lon], {
            icon: L.divIcon({
              className: '',
              html: `<div style="width:28px;height:28px;border-radius:50%;background:${layer.color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:12px;">${layer.emoji}</div>`,
              iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -16],
            }),
          }).addTo(layerGroupsRef.current[cat]).bindPopup(`
            <div style="font-family:system-ui,sans-serif;min-width:120px;padding:2px 0">
              <p style="font-weight:700;font-size:13px;margin:0 0 4px">${name}</p>
              <span style="display:inline-block;background:${layer.color}22;color:${layer.color};font-size:10px;font-weight:600;padding:1px 6px;border-radius:99px">${layer.label}</span>
            </div>
          `)
        })

      const map = mapRef.current
      if (map) POI_LAYERS.forEach(({ id }) => {
        const lg = layerGroupsRef.current[id]
        if (lg && active.has(id)) map.addLayer(lg)
      })
      setPoiStatus('done')
    } catch (e) {
      console.error('Overpass:', e)
      setPoiStatus('error')
    }
  }

  const toggle = (id: LayerId) => {
    setActive(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    if (id !== 'hotels' && poiStatusRef.current === 'idle') loadPois()
  }

  if (!hotel.latitude || !hotel.longitude) return null

  // Minimalist button base classes
  const btn = 'cursor-pointer select-none transition-colors duration-150 text-[11px] font-semibold'
  const btnOff = 'bg-white/95 text-gray-700 border border-gray-200 hover:bg-gray-50'

  return (
    <div className="relative z-0 rounded-2xl border border-gray-100 overflow-hidden" style={{ height: 440 }}>
      {/* Leaflet map fills entire container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Controls overlay — pointer-events-none passes mouse events to map */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 500 }}>

        {/* Top-right: zoom + satellite */}
        <div className="absolute top-3 right-3 flex flex-col gap-px pointer-events-auto">
          <button onClick={() => mapRef.current?.zoomIn()}
            className={`${btn} ${btnOff} w-8 h-8 flex items-center justify-center rounded-t-lg text-base leading-none shadow-sm`}>
            +
          </button>
          <button onClick={() => mapRef.current?.zoomOut()}
            className={`${btn} ${btnOff} w-8 h-8 flex items-center justify-center rounded-b-lg text-base leading-none shadow-sm border-t-0`}>
            −
          </button>
          <button onClick={() => setSatellite(s => !s)}
            className={`${btn} w-8 h-8 flex items-center justify-center rounded-lg shadow-sm mt-1.5 ${
              satellite ? 'bg-gray-800 text-white border border-gray-700' : btnOff
            }`}>
            {satellite ? 'M' : 'S'}
          </button>
        </div>

        {/* Bottom-left: layer toggles */}
        <div className="absolute bottom-5 left-3 flex flex-col gap-1 pointer-events-auto">
          {/* Hotels */}
          <button onClick={() => toggle('hotels')}
            className={`${btn} flex items-center gap-2 h-7 px-3 rounded-lg shadow-sm ${
              active.has('hotels') ? 'bg-[#0093FF] text-white border border-[#0093FF]' : btnOff
            }`}>
            Hotely
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${active.has('hotels') ? 'bg-white/25' : 'bg-gray-100 text-gray-500'}`}>
              {nearby.length + 1}
            </span>
          </button>

          {POI_LAYERS.map(layer => (
            <button key={layer.id} onClick={() => toggle(layer.id)}
              disabled={poiStatus === 'loading' && !active.has(layer.id)}
              style={active.has(layer.id) ? { background: layer.color, borderColor: layer.color } : {}}
              className={`${btn} flex items-center gap-1.5 h-7 px-3 rounded-lg shadow-sm disabled:opacity-50 ${
                active.has(layer.id) ? 'text-white border' : btnOff
              }`}>
              {layer.label}
              {poiStatus === 'loading' && active.has(layer.id) && (
                <svg className="animate-spin w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" />
                </svg>
              )}
            </button>
          ))}

          {poiStatus === 'error' && (
            <button onClick={() => { setPoiStatus('idle'); loadPois() }}
              className={`${btn} flex items-center h-7 px-3 rounded-lg text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 shadow-sm`}>
              ↺ Zkusit znovu
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
