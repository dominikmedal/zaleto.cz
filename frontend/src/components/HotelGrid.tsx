'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
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

async function fetchPage(
  sp: URLSearchParams,
  page: number,
  limit: number,
  view?: string,
  knownTotal?: number,
): Promise<PageResult> {
  const params = new URLSearchParams(sp)
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (view === 'list') params.set('view', 'list')
  if (knownTotal !== undefined && page > 1) params.set('known_total', String(knownTotal))
  const res = await fetch(`${API}/api/hotels?${params.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch hotels')
  return res.json()
}

export default function HotelGrid({ hotels: initial, pagination: initialPag, adults = 2 }: { hotels: Hotel[]; pagination: Pagination; adults?: number }) {
  const sp = useSearchParams()
  const [view, setView]             = useState<'grid' | 'list' | 'map'>('grid')
  const [hotels, setHotels]         = useState(initial)
  const [pagination, setPagination] = useState(initialPag)
  const [loading, setLoading]       = useState(false)
  const sentinelRef  = useRef<HTMLDivElement>(null)
  const prefetchRef  = useRef<Promise<PageResult> | null>(null)

  // Když přijdou nová data (změna filtrů/URL), resetuj a prefetchni stránku 2
  useEffect(() => {
    setHotels(initial)
    setPagination(initialPag)
    prefetchRef.current = initialPag.hasMore
      ? fetchPage(sp, 2, initialPag.limit, view, initialPag.total).catch(() => null) as Promise<PageResult>
      : null
  }, [initial, initialPag]) // sp a view záměrně vynechány — mění se spolu s initial/initialPag

  const prevViewRef = useRef(view)
  useEffect(() => {
    const prev = prevViewRef.current
    prevViewRef.current = view
    if (view === prev) return
    if (view !== 'list' && prev !== 'list') return
    prefetchRef.current = null
    setLoading(true)
    fetchPage(sp, 1, initialPag.limit, view)
      .then(({ hotels: next, pagination: nextPag }) => {
        setHotels(next)
        setPagination(nextPag)
        prefetchRef.current = nextPag.hasMore
          ? fetchPage(sp, 2, nextPag.limit, view, nextPag.total).catch(() => null) as Promise<PageResult>
          : null
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [view, sp, initialPag.limit])

  const loadMore = useCallback(async () => {
    if (loading || !pagination.hasMore) return
    setLoading(true)
    try {
      const nextPage = pagination.page + 1
      // Použij prefetchovaná data pokud jsou k dispozici
      const pending = prefetchRef.current
      prefetchRef.current = null
      const { hotels: next, pagination: nextPag } = await (
        pending ?? fetchPage(sp, nextPage, pagination.limit, view, pagination.total)
      )
      setHotels(prev => [...prev, ...next])
      setPagination(nextPag)
      // Okamžitě prefetchni další stránku
      if (nextPag.hasMore) {
        prefetchRef.current = fetchPage(sp, nextPag.page + 1, nextPag.limit, view, nextPag.total)
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

  if (hotels.length === 0) {
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
    { id: 'list' as const, icon: <List className="w-3.5 h-3.5" />,       label: 'Seznam'  },
    { id: 'map'  as const, icon: <Map  className="w-3.5 h-3.5" />,       label: 'Mapa'    },
  ]

  return (
    <div>
      {/* Header row: count + view toggle */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-400">
          <span className="font-semibold text-gray-900">{pagination.total.toLocaleString('cs-CZ')}</span>
          {' '}{pagination.total === 1 ? 'hotel' : pagination.total < 5 ? 'hotely' : 'hotelů'}
        </p>

        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
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

      {/* Map view */}
      {view === 'map' && <HotelsMapView />}

      {/* Grid view */}
      {view === 'grid' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-8">
            {hotels.map(hotel => <HotelCard key={hotel.id} hotel={hotel} adults={adults} />)}
          </div>
          <div ref={sentinelRef} className="h-4 mt-8" />
          {loading && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-[#008afe] animate-spin" /></div>}
          {!pagination.hasMore && hotels.length > 0 && pagination.total > pagination.limit && (
            <p className="text-center text-sm text-gray-400 py-6">Zobrazeny všechny výsledky</p>
          )}
        </>
      )}

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="flex flex-col gap-3">
            {hotels.map(hotel => <HotelListRow key={hotel.id} hotel={hotel} adults={adults} />)}
          </div>
          <div ref={sentinelRef} className="h-4 mt-8" />
          {loading && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-[#008afe] animate-spin" /></div>}
          {!pagination.hasMore && hotels.length > 0 && pagination.total > pagination.limit && (
            <p className="text-center text-sm text-gray-400 py-6">Zobrazeny všechny výsledky</p>
          )}
        </>
      )}
    </div>
  )
}
