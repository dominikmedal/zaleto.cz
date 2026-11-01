'use client'
import { useEffect, useRef } from 'react'

export interface MapPin {
  id: string
  lat: number
  lng: number
  title: string
  sub?: string
  image?: string | null
  href?: string
  /** beach = oranžová špendlíková značka, hotel = tmavá, price = cenovka (zájezdy) */
  kind: 'beach' | 'hotel' | 'price'
  /** text cenovky u kind="price" */
  label?: string
  stars?: number | null
  /** drobné řádky v bublině (typ pláže apod.) */
  meta?: string[]
}

interface Props {
  pins: MapPin[]
  activeId?: string | null
  onSelect?: (id: string) => void
  cluster?: boolean
  className?: string
  ariaLabel?: string
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

function pinHtml(p: MapPin): string {
  if (p.kind === 'price') return `<span class="z-pin z-pin--price">${esc(p.label ?? '')}</span>`
  return `<span class="z-pin z-pin--${p.kind}"><i></i></span>`
}

function popupHtml(p: MapPin): string {
  const stars = p.stars ? `<span class="z-pop__stars" aria-label="${p.stars} hvězdiček">${'★'.repeat(Math.min(5, p.stars))}</span>` : ''
  const meta = (p.meta ?? []).filter(Boolean).map(m => `<span>${esc(m)}</span>`).join('')
  return `<div class="z-pop">
    ${p.image ? `<img class="z-pop__img" src="${esc(p.image)}" alt="" loading="lazy">` : ''}
    <div class="z-pop__body">
      ${stars}
      <b class="z-pop__title">${esc(p.title)}</b>
      ${p.sub ? `<span class="z-pop__sub">${esc(p.sub)}</span>` : ''}
      ${meta ? `<div class="z-pop__meta">${meta}</div>` : ''}
      ${p.href ? `<a class="z-pop__go" href="${esc(p.href)}">Zobrazit</a>` : ''}
    </div>
  </div>`
}

/**
 * Mapa Leaflet v stylu „Palubní deník“: podklad OpenStreetMap zabarvený do papírové palety,
 * vlastní značky a bubliny. Kolečkem se přibližuje až po kliknutí do mapy (aby nepřebíralo posouvání stránky),
 * na telefonu se mapa táhne až po klepnutí.
 */
export default function GuideMap({ pins, activeId, onSelect, cluster = false, className = '', ariaLabel = 'Mapa' }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const state = useRef<{ map: any; layer: any; markers: Map<string, any> } | null>(null)
  const select = useRef(onSelect)
  select.current = onSelect

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !box.current) return
      let group: any
      if (cluster) {
        // @ts-ignore – plugin nemá typy
        await import('leaflet.markercluster')
        if (cancelled) return
        group = (L as any).markerClusterGroup({
          maxClusterRadius: 52,
          showCoverageOnHover: false,
          iconCreateFunction: (c: any) => L.divIcon({ className: '', html: `<span class="z-pin z-pin--cluster">${c.getChildCount()}</span>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
        })
      } else group = L.layerGroup()

      const map = L.map(box.current, { zoomControl: true, scrollWheelZoom: false, dragging: !L.Browser.mobile, attributionControl: true, zoomSnap: 0.5 })
      map.attributionControl.setPrefix(false)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map)
      map.once('click', () => { map.scrollWheelZoom.enable(); map.dragging.enable() })
      group.addTo(map)
      state.current = { map, layer: group, markers: new Map() }
      draw()
    })()
    return () => {
      cancelled = true
      state.current?.map.remove()
      state.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster])

  function draw() {
    const st = state.current
    if (!st) return
    import('leaflet').then(({ default: L }) => {
      st.layer.clearLayers()
      st.markers.clear()
      const pts: [number, number][] = []
      for (const p of pins) {
        const price = p.kind === 'price'
        const m = L.marker([p.lat, p.lng], {
          icon: L.divIcon({ className: '', html: pinHtml(p), iconSize: price ? [84, 28] : [34, 42], iconAnchor: price ? [42, 14] : [17, 40], popupAnchor: [0, price ? -16 : -38] }),
          keyboard: true,
          title: p.title,
        }).bindPopup(popupHtml(p), { maxWidth: 260, minWidth: 190, autoPanPadding: [30, 30] })
        m.on('click', () => select.current?.(p.id))
        st.layer.addLayer(m)
        st.markers.set(p.id, m)
        pts.push([p.lat, p.lng])
      }
      if (pts.length === 1) st.map.setView(pts[0], 13)
      else if (pts.length > 1) st.map.fitBounds(L.latLngBounds(pts), { padding: [44, 44], maxZoom: 13 })
    })
  }

  // změna značek (filtr, načtená data)
  useEffect(() => { draw() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pins])

  // vybraná značka: přiblížit a otevřít bublinu
  useEffect(() => {
    const st = state.current
    if (!st || !activeId) return
    const m = st.markers.get(activeId)
    if (!m) return
    const open = () => { st.map.flyTo(m.getLatLng(), Math.max(st.map.getZoom(), 14), { duration: 0.7 }); m.openPopup() }
    if (cluster && st.layer.zoomToShowLayer) st.layer.zoomToShowLayer(m, open)
    else open()
  }, [activeId, cluster])

  return <div ref={box} className={`z-map ${className}`} role="region" aria-label={ariaLabel} />
}
