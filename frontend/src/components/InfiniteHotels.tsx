'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import TourCard from '@/components/ui/TourCard'
import HotelTile from '@/components/ui/HotelTile'
import TourAd from '@/components/ui/TourAd'
import Icon from '@/components/ui/Icon'
import { apiFetch } from '@/lib/api'
import type { Hotel } from '@/lib/types'

interface Props {
  initial: Hotel[]
  total: number
  limit: number
  /** Parametry dotazu do /api/hotels (bez page a limit). */
  query: Record<string, string | undefined>
  /** Za kolikátou kartu vložit reklamní lístek (jen jednou). */
  adAfter?: number
  /** `tile` = dlaždice bez ceny a termínu (stránka Hotely). */
  variant?: 'ticket' | 'tile'
}

/** Mřížka hotelů s nekonečným scrollem: další stránky se dočítají při dojetí na konec. */
export default function InfiniteHotels({ initial, total, limit, query, adAfter = 6, variant = 'ticket' }: Props) {
  const [hotels, setHotels] = useState<Hotel[]>(initial)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const hasMore = hotels.length < total && !failed

  // změna filtrů = nový seznam od serveru
  useEffect(() => { setHotels(initial); setPage(1); setFailed(false) }, [initial])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    const p = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => { if (v) p.set(k, v) })
    p.set('page', String(page + 1)); p.set('limit', String(limit)); p.set('known_total', String(total))
    try {
      const r = await apiFetch(`/api/hotels?${p}`)
      if (!r.ok) throw new Error('fetch')
      const data: { hotels: Hotel[] } = await r.json()
      setHotels(prev => {
        const seen = new Set(prev.map(h => h.slug))
        return [...prev, ...data.hotels.filter(h => !seen.has(h.slug))]
      })
      setPage(x => x + 1)
      if (data.hotels.length === 0) setFailed(true)
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }, [loading, hasMore, query, page, limit, total])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting) loadMore() }, { rootMargin: '600px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore])

  const ad = hotels.find(h => h.thumbnail_url) ?? null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${variant === 'tile' ? 250 : 280}px, 1fr))`, gap: 'var(--space-5)', alignItems: 'stretch' }}>
        {hotels.map((h, i) => (
          <FragmentWithAd key={h.slug} showAd={variant === 'ticket' && i === adAfter - 1 && !!ad} ad={ad}>
            {variant === 'tile' ? <HotelTile hotel={h} priority={i < 3} /> : <TourCard hotel={h} priority={i < 3} />}
          </FragmentWithAd>
        ))}
      </div>

      <div ref={sentinel} style={{ height: 1 }} />
      <div className="z-infinite" aria-live="polite">
        {loading && <span className="z-infinite__load"><Icon name="spinner" className="animate-spin" />Načítám další zájezdy</span>}
        {!hasMore && !loading && hotels.length > limit && <span className="z-data">TO JE VŠE — {hotels.length} HOTELŮ</span>}
        {failed && hotels.length < total && (
          <button type="button" className="z-btn z-btn--line z-btn--sm" onClick={() => { setFailed(false); loadMore() }}>Zkusit znovu</button>
        )}
      </div>
    </div>
  )
}

function FragmentWithAd({ children, showAd, ad }: { children: React.ReactNode; showAd: boolean; ad: Hotel | null }) {
  return (
    <>
      {children}
      {showAd && ad && <div style={{ display: 'flex' }}><div style={{ width: '100%' }}><TourAd hotel={ad} /></div></div>}
    </>
  )
}
