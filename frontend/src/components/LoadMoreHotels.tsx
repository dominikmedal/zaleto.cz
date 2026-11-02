'use client'
import { useCallback, useEffect, useState } from 'react'
import TourCard from '@/components/ui/TourCard'
import HotelTile from '@/components/ui/HotelTile'
import TourAd from '@/components/ui/TourAd'
import Icon from '@/components/ui/Icon'
import { apiFetch } from '@/lib/api'
import type { Hotel } from '@/lib/types'

interface Props {
  initial: Hotel[]
  total: number
  /** Kolik hotelů se načte najednou (první stránka od serveru i každé kliknutí na „Načíst další“). */
  limit: number
  /** Parametry dotazu do /api/hotels (bez page a limit). */
  query: Record<string, string | undefined>
  /** Za kolikátou kartu vložit reklamní lístek (jen jednou). */
  adAfter?: number
  /** `tile` = dlaždice bez ceny a termínu (stránka Hotely). */
  variant?: 'ticket' | 'tile'
}

/**
 * Mřížka hotelů s tlačítkem „Načíst další“. Žádný automatický scroll: stránka pod seznamem
 * (texty, otázky, odkazy, patička) zůstává dosažitelná a návštěvník sám rozhoduje, kdy chce víc.
 */
export default function LoadMoreHotels({ initial, total, limit, query, adAfter = 6, variant = 'ticket' }: Props) {
  const [hotels, setHotels] = useState<Hotel[]>(initial)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const remaining = total - hotels.length
  const hasMore = remaining > 0

  // změna filtrů = nový seznam od serveru
  useEffect(() => { setHotels(initial); setPage(1); setFailed(false) }, [initial])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    setFailed(false)
    const p = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => { if (v) p.set(k, v) })
    p.set('page', String(page + 1)); p.set('limit', String(limit)); p.set('known_total', String(total))
    try {
      const r = await apiFetch(`/api/hotels?${p}`)
      if (!r.ok) throw new Error('fetch')
      const data: { hotels: Hotel[] } = await r.json()
      if (data.hotels.length === 0) throw new Error('empty')
      setHotels(prev => {
        const seen = new Set(prev.map(h => h.slug))
        return [...prev, ...data.hotels.filter(h => !seen.has(h.slug))]
      })
      setPage(x => x + 1)
    } catch { setFailed(true) }
    finally { setLoading(false) }
  }, [loading, hasMore, query, page, limit, total])

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

      <div className="z-infinite" aria-live="polite">
        {hasMore && (
          <button type="button" className="z-btn z-btn--line" onClick={loadMore} disabled={loading} aria-busy={loading}>
            {loading
              ? <><Icon name="spinner" className="animate-spin" />Načítám další zájezdy</>
              : <>{failed ? 'Zkusit znovu: ' : ''}Načíst dalších {Math.min(limit, remaining)} zájezdů · zbývá {remaining.toLocaleString('cs-CZ')}</>}
          </button>
        )}
        {!hasMore && hotels.length > limit && <span className="z-data">TO JE VŠE — {hotels.length} HOTELŮ</span>}
        {failed && !loading && <span className="z-data" style={{ marginLeft: 'var(--space-3)' }}>NAČTENÍ SE NEZDAŘILO</span>}
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
