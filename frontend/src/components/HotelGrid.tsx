'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, LayoutGrid, List, Map } from 'lucide-react'
import { PiMagnifyingGlass } from 'react-icons/pi'
import dynamic from 'next/dynamic'
import HotelCard from './HotelCard'
import HotelListRow from './HotelListRow'
import type { Hotel, Pagination } from '@/lib/types'
import { API } from '@/lib/api'

const HotelsMapView = dynamic(() => import('./HotelsMapView'), { ssr: false })

type PageResult = { hotels: Hotel[]; pagination: Pagination }

const EMPTY_PAG: Pagination = { total: 0, page: 1, limit: 24, totalPages: 0, hasMore: false }

function preloadImages(hotels: Hotel[]) {
  if (typeof window === 'undefined') return
  hotels.forEach(h => {
    if (!h.thumbnail_url) return
    const img = new window.Image()
    img.src = h.thumbnail_url
  })
}

async function fetchPage(
  sp: URLSearchParams,
  page: number,
  limit: number,
  view?: string,
  knownTotal?: number,
): Promise<PageResult> {
  const params = new URLSearchParams(sp)
  params.delete('adults')  // adults is display-only, does not filter hotels
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (view === 'list') params.set('view', 'list')
  if (knownTotal !== undefined && page > 1) params.set('known_total', String(knownTotal))
  const res = await fetch(`${API}/api/hotels?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch hotels')
  return res.json()
}

function HotelSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-gray-100" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-5 bg-gray-100 rounded w-1/3 mt-3" />
      </div>
    </div>
  )
}

export default function HotelGrid({ adults = 2, forcedDestination }: { adults?: number; forcedDestination?: string }) {
  const spBase = useSearchParams()
  // spStr tracks the "effective" search string — updated immediately by filterchange
  // events (before Next.js navigation commits) and also by useSearchParams changes
  const [spStr, setSpStr] = useState(() => {
    const base = spBase.toString()
    if (forcedDestination && !new URLSearchParams(base).has('destination')) {
      const p = new URLSearchParams(base)
      p.set('destination', forcedDestination)
      return p.toString()
    }
    return base
  })
  // Tracks when the last filterchange event fired — guards against stale navigation commits
  // overwriting a newer filterchange (race: nav1 commits after filterchange2 fired)
  const lastFilterTs = useRef(0)

  useEffect(() => {
    // Only override with URL params if no filterchange fired in the last 10s.
    // This prevents a slow navigation (railway ~5-15s) from overwriting a newer filter.
    if (Date.now() - lastFilterTs.current > 10_000) {
      const base = spBase.toString()
      if (forcedDestination && !new URLSearchParams(base).has('destination')) {
        const p = new URLSearchParams(base)
        p.set('destination', forcedDestination)
        setSpStr(p.toString())
      } else {
        setSpStr(base)
      }
    }
  }, [spBase, forcedDestination])

  useEffect(() => {
    const handler = (e: Event) => {
      lastFilterTs.current = Date.now()
      setSpStr((e as CustomEvent<string>).detail)
    }
    window.addEventListener('filterchange', handler)
    return () => window.removeEventListener('filterchange', handler)
  }, [])

  const sp = useMemo(() => new URLSearchParams(spStr), [spStr])
  const activeTourType = sp.get('tour_type') ?? undefined

  const [view, setView]             = useState<'grid' | 'list' | 'map'>('grid')
  const [hotels, setHotels]         = useState<Hotel[]>([])
  const [pagination, setPagination] = useState<Pagination>(EMPTY_PAG)
  const [loading, setLoading]       = useState(true)
  const [initialDone, setInitialDone] = useState(false)
  const sentinelRef  = useRef<HTMLDivElement>(null)
  const prefetchRef  = useRef<Promise<PageResult> | null>(null)
  const abortRef     = useRef<AbortController | null>(null)

  // Initial fetch + refetch on URL param changes
  useEffect(() => {
    // Cancel any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setInitialDone(false)   // reset skeleton on every filter change
    prefetchRef.current = null

    const params = new URLSearchParams(sp)
    params.delete('adults')  // adults is display-only, does not filter hotels
    params.set('page', '1')
    params.set('limit', '24')
    if (view === 'list') params.set('view', 'list')

    fetch(`${API}/api/hotels?${params.toString()}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : { hotels: [], pagination: EMPTY_PAG })
      .then(({ hotels: h, pagination: p }: PageResult) => {
        setHotels(h)
        setPagination(p)
        preloadImages(h)
        setInitialDone(true)
        if (p.hasMore) {
          prefetchRef.current = fetchPage(sp, 2, p.limit, view, p.total)
            .then(res => { preloadImages(res.hotels); return res })
            .catch(() => null) as Promise<PageResult>
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') { setHotels([]); setPagination(EMPTY_PAG) }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })

    return () => controller.abort()
  }, [sp, view]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loading || !pagination.hasMore) return
    setLoading(true)
    try {
      const nextPage = pagination.page + 1
      const pending = prefetchRef.current
      prefetchRef.current = null
      const { hotels: next, pagination: nextPag } = await (
        pending ?? fetchPage(sp, nextPage, pagination.limit, view, pagination.total)
      )
      setHotels(prev => [...prev, ...next])
      setPagination(nextPag)
      if (nextPag.hasMore) {
        prefetchRef.current = fetchPage(sp, nextPag.page + 1, nextPag.limit, view, nextPag.total)
          .then(res => { preloadImages(res.hotels); return res })
          .catch(() => null) as Promise<PageResult>
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [loading, pagination, sp, view])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || view === 'map') return
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '900px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore, view])

  // Skeleton during initial load
  if (!initialDone && loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8">
        {Array.from({ length: 12 }).map((_, i) => <HotelSkeleton key={i} />)}
      </div>
    )
  }

  if (initialDone && hotels.length === 0) {
    return (
      <div className="text-center py-24">
        <PiMagnifyingGlass className="w-12 h-12 text-gray-300 mx-auto mb-5" />
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Žádné výsledky</h3>
        <p className="text-gray-400 text-sm">Zkuste upravit filtry nebo vyberte jinou destinaci.</p>
      </div>
    )
  }

  const viewButtons = [
    { id: 'grid' as const, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Přehled' },
    { id: 'list' as const, icon: <List       className="w-3.5 h-3.5" />, label: 'Seznam'  },
    { id: 'map'  as const, icon: <Map        className="w-3.5 h-3.5" />, label: 'Mapa'    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-400">
          {loading && !initialDone ? (
            <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-[#008afe]" /> Načítám…</span>
          ) : (
            <><span className="font-semibold text-gray-900">{pagination.total.toLocaleString('cs-CZ')}</span>
            {' '}{pagination.total === 1 ? 'hotel' : pagination.total < 5 ? 'hotely' : 'hotelů'}</>
          )}
        </p>

        <div className="flex items-center gap-1 bg-[#f5faff] rounded-xl p-1">
          {viewButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => setView(btn.id)}
              title={btn.label}
              className={`${btn.id === 'list' ? 'hidden sm:flex' : 'flex'} items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                view === btn.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {btn.icon}
              <span className="hidden sm:inline">{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {view === 'map' && <HotelsMapView />}

      {view === 'grid' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8">
            {hotels.map(hotel => <HotelCard key={hotel.id} hotel={hotel} adults={adults} activeTourType={activeTourType} />)}
          </div>
          <div ref={sentinelRef} className="h-4 mt-8" />
          {loading && initialDone && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-[#008afe] animate-spin" /></div>}
          {!pagination.hasMore && hotels.length > 0 && pagination.total > pagination.limit && (
            <p className="text-center text-sm text-gray-400 py-6">Zobrazeny všechny výsledky</p>
          )}
        </>
      )}

      {view === 'list' && (
        <>
          <div className="flex flex-col gap-3">
            {hotels.map(hotel => <HotelListRow key={hotel.id} hotel={hotel} adults={adults} activeTourType={activeTourType} />)}
          </div>
          <div ref={sentinelRef} className="h-4 mt-8" />
          {loading && initialDone && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-[#008afe] animate-spin" /></div>}
          {!pagination.hasMore && hotels.length > 0 && pagination.total > pagination.limit && (
            <p className="text-center text-sm text-gray-400 py-6">Zobrazeny všechny výsledky</p>
          )}
        </>
      )}
    </div>
  )
}
