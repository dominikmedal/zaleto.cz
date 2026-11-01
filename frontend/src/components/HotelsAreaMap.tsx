'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Icon from '@/components/ui/Icon'
import { apiFetch } from '@/lib/api'
import type { MapPin } from './GuideMap'

const GuideMap = dynamic(() => import('./GuideMap'), { ssr: false, loading: () => <div className="z-map z-map--loading" /> })

interface MapHotel {
  slug: string; name: string; stars: number | null; resort_town: string | null
  thumbnail_url: string | null; latitude: number | null; longitude: number | null; min_price: number
}

const fmt = (n: number) => `${Math.round(n).toLocaleString('cs-CZ').replace(/\s/g, ' ')} Kč`

/**
 * Mapa hotelů destinace (Leaflet). Data se stahují až když se mapa zobrazí na obrazovce nebo se rozbalí.
 * `showPrice`: u zájezdů cenovky „od X Kč“, u hotelů značky bez ceny.
 */
export default function HotelsAreaMap({ destination, showPrice = false, collapsible = false, sort = 'price_asc' }: { destination: string; showPrice?: boolean; collapsible?: boolean; sort?: string }) {
  const [open, setOpen] = useState(!collapsible)
  const [hotels, setHotels] = useState<MapHotel[] | null>(null)
  const [error, setError] = useState(false)
  const [visible, setVisible] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el || !open) return
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) { setVisible(true); obs.disconnect() } }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [open])

  useEffect(() => {
    if (!open || !visible || hotels) return
    let off = false
    const p = new URLSearchParams({ destination, sort, page: '1', limit: '500' })
    apiFetch(`/api/hotels?${p}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('fetch'))))
      .then((d: { hotels: MapHotel[] }) => { if (!off) setHotels((d.hotels ?? []).filter(h => h.latitude != null && h.longitude != null)) })
      .catch(() => { if (!off) setError(true) })
    return () => { off = true }
  }, [open, visible, hotels, destination, sort])

  const pins = useMemo<MapPin[]>(() => (hotels ?? []).map(h => ({
    id: h.slug, lat: h.latitude as number, lng: h.longitude as number,
    kind: showPrice ? 'price' as const : 'hotel' as const, label: showPrice ? `od ${fmt(h.min_price)}` : undefined,
    title: h.name, sub: h.resort_town ?? undefined, stars: h.stars, href: `/hotel/${h.slug}`,
    image: h.thumbnail_url, meta: showPrice ? [`od ${fmt(h.min_price)} / osobu`] : undefined,
  })), [hotels, showPrice])

  const note = (text: string) => <p className="z-data" style={{ textTransform: 'none' }}>{text}</p>

  return (
    <div ref={root} className="z-areamap">
      {collapsible && (
        <button type="button" className="z-btn z-btn--line z-btn--sm" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <Icon name="mapa" size="sm" />{open ? 'Skrýt mapu' : 'Zobrazit na mapě'}
        </button>
      )}
      {open && (
        <div className="z-areamap__box">
          {error ? note('Mapu se nepodařilo načíst.')
            : hotels && hotels.length === 0 ? note('U hotelů této destinace zatím nemáme polohu.')
            : hotels ? (
              <div className="z-beaches__map">
                <GuideMap pins={pins} cluster ariaLabel={`Mapa hotelů: ${destination}`} />
                <span className="z-beaches__count"><Icon name="hotel" size="sm" />{pins.length} hotelů na mapě</span>
              </div>
            ) : <div className="z-map z-map--loading" />}
        </div>
      )}
    </div>
  )
}
