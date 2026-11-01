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
  { id: 'beach',      label: 'Pláže',      limit: 30 },
  { id: 'attraction', label: 'Atrakce',    limit: 20 },
  { id: 'food',       label: 'Restaurace', limit: 25 },
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

const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
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

      const map = L.map(containerRef.current!, {
        center: [hotel.latitude!, hotel.longitude!],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: !L.Browser.mobile,
        zoomSnap: 0.5,
      })
      if (cancelled) { map.remove(); return }
      map.attributionControl.setPrefix(false)
      // kolečko a tažení až po kliknutí do mapy, aby mapa nepřebírala posouvání stránky
      map.once('click', () => { map.scrollWheelZoom.enable(); map.dragging.enable() })
      mapRef.current = map

      baseTileRef.current = L.tileLayer(TILES.map.url, { attribution: TILES.map.attr, maxZoom: 19 }).addTo(map)

      const hotelsLayer = L.layerGroup().addTo(map)
      layerGroupsRef.current['hotels'] = hotelsLayer

      L.marker([hotel.latitude!, hotel.longitude!], {
        icon: L.divIcon({ className: '', html: '<span class="z-pin z-pin--hotel"><i></i></span>', iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -38] }),
        zIndexOffset: 1000,
        title: hotel.name,
      }).addTo(hotelsLayer).bindPopup(`
        <div class="z-pop"><div class="z-pop__body">
          ${hotel.stars ? `<span class="z-pop__stars">${'★'.repeat(Math.min(5, hotel.stars))}</span>` : ''}
          <b class="z-pop__title">${esc(hotel.name)}</b>
          <span class="z-pop__sub">${esc(hotel.resort_town || hotel.destination || '')}</span>
          ${hotel.min_price ? `<div class="z-pop__meta"><span>od ${fmt(hotel.min_price)} Kč</span></div>` : ''}
        </div></div>
      `, { maxWidth: 260, minWidth: 190 }).openPopup()

      nearby.forEach(n => {
        if (!n.latitude || !n.longitude) return
        L.marker([n.latitude, n.longitude], {
          icon: L.divIcon({ className: '', html: `<span class="z-pin z-pin--price">${fmt(n.min_price)} Kč</span>`, iconSize: [84, 28], iconAnchor: [42, 14], popupAnchor: [0, -16] }),
          title: n.name,
        }).addTo(hotelsLayer).bindPopup(`
          <div class="z-pop">
            ${n.thumbnail_url ? `<img class="z-pop__img" src="${esc(n.thumbnail_url)}" alt="" loading="lazy">` : ''}
            <div class="z-pop__body">
              ${n.stars ? `<span class="z-pop__stars">${'★'.repeat(Math.min(5, n.stars))}</span>` : ''}
              <b class="z-pop__title">${esc(n.name)}</b>
              <span class="z-pop__sub">${esc(n.resort_town ?? '')}${n.distance_km != null ? ` · ${Number(n.distance_km).toFixed(1)} km` : ''}</span>
              <a class="z-pop__go" href="/hotel/${esc(n.slug)}">Zobrazit</a>
            </div>
          </div>
        `, { maxWidth: 260, minWidth: 190 })
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
            icon: L.divIcon({ className: '', html: `<span class="z-pin z-pin--dot" data-poi="${cat}"></span>`, iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -12] }),
            title: name,
          }).addTo(layerGroupsRef.current[cat]).bindPopup(`
            <div class="z-pop"><div class="z-pop__body">
              <b class="z-pop__title">${esc(name)}</b>
              <div class="z-pop__meta"><span>${layer.label}</span></div>
            </div></div>
          `, { maxWidth: 240 })
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

  const chip = (on: boolean, label: React.ReactNode, onClick: () => void, disabled = false) => (
    <button type="button" className="z-chip z-hmap__chip" aria-pressed={on} disabled={disabled} onClick={onClick}>{label}</button>
  )

  return (
    <div className="z-hmap" data-sat={satellite || undefined}>
      <div ref={containerRef} className="z-map" role="region" aria-label={`Mapa: ${hotel.name}`} />
      <div className="z-hmap__bar">
        {chip(active.has('hotels'), <>Hotely · {nearby.length + 1}</>, () => toggle('hotels'))}
        {POI_LAYERS.map(layer => chip(
          active.has(layer.id),
          <>{layer.label}{poiStatus === 'loading' && active.has(layer.id) ? ' …' : ''}</>,
          () => toggle(layer.id),
          poiStatus === 'loading' && !active.has(layer.id),
        ))}
        {chip(satellite, 'Satelit', () => setSatellite(s => !s))}
        {poiStatus === 'error' && chip(false, '↺ Zkusit znovu', () => { setPoiStatus('idle'); loadPois() })}
      </div>
    </div>
  )
}
