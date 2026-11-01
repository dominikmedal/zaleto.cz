'use client'
import dynamic from 'next/dynamic'
import { useMemo } from 'react'

const GuideMap = dynamic(() => import('./GuideMap'), { ssr: false, loading: () => <div className="z-map z-map--loading" /> })

/** Malá mapa s jednou značkou (stránka pláže). */
export default function ItemMap({ lat, lng, title, sub }: { lat: number; lng: number; title: string; sub?: string }) {
  const pins = useMemo(() => [{ id: title, lat, lng, kind: 'beach' as const, title, sub }], [lat, lng, title, sub])
  return <div className="z-itemmap"><GuideMap pins={pins} ariaLabel={`Mapa: ${title}`} /></div>
}
