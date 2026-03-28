import type { Hotel, NearbyHotel, Tour, Filters, Pagination } from './types'

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function buildParams(filters: Filters & { page?: number; limit?: number }): string {
  const p = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  })
  return p.toString()
}

/** Vrátí AbortSignal s timeoutem — pojistka pro SSR/build, aby Railway neblokoval worker. */
function timeout(ms = 15_000) {
  return AbortSignal.timeout(ms)
}

export async function fetchHotels(filters: Filters & { page?: number; limit?: number } = {}): Promise<{
  hotels: Hotel[]
  pagination: Pagination
}> {
  const qs = buildParams(filters)
  const res = await fetch(`${API}/api/hotels${qs ? `?${qs}` : ''}`, {
    next: { revalidate: 300 },
    signal: timeout(30_000),   // 30s — slow path (GROUP BY) může trvat déle, ale ne navždy
  })
  if (!res.ok) throw new Error('Failed to fetch hotels')
  return res.json()
}

export async function fetchHotel(slug: string): Promise<Hotel> {
  const res = await fetch(`${API}/api/hotels/${slug}`, { next: { revalidate: 3600 }, signal: timeout() })
  if (!res.ok) throw new Error('Hotel not found')
  return res.json()
}

export async function fetchHotelTours(slug: string, filters: Partial<Filters> = {}): Promise<{ tours: Tour[] }> {
  const qs = buildParams(filters)
  const res = await fetch(`${API}/api/hotels/${slug}/tours${qs ? `?${qs}` : ''}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error('Failed to fetch tours')
  return res.json()
}

export async function fetchDestinations(): Promise<{ country: string; destination: string; resort_town: string | null; hotel_count: number }[]> {
  const res = await fetch(`${API}/api/destinations`, { next: { revalidate: 300 }, signal: timeout() })
  if (!res.ok) return []
  return res.json()
}

export async function fetchCalendarPrices(
  dateFrom: string,
  dateTo: string,
  destination?: string
): Promise<{ date: string; min_price: number; tour_count: number }[]> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
  if (destination) params.set('destination', destination)
  try {
    const res = await fetch(`${API}/api/calendar-prices?${params.toString()}`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export async function fetchHotelReviews(slug: string): Promise<{
  reviews: {
    id: number; author_name: string; author_photo: string | null
    rating: number; text: string; review_date: string | null; language: string | null
  }[]
  overall_rating: number | null
  total_ratings: number | null
  source: string
}> {
  try {
    const res = await fetch(`${API}/api/hotels/${slug}/reviews`, { next: { revalidate: 3600 } })
    if (!res.ok) return { reviews: [], overall_rating: null, total_ratings: null, source: 'error' }
    return res.json()
  } catch {
    return { reviews: [], overall_rating: null, total_ratings: null, source: 'error' }
  }
}

export async function fetchDestinationPhoto(destination: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${API}/api/destination-photo/${encodeURIComponent(destination)}`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.url ?? null
  } catch { return null }
}

export async function fetchWikiSummary(query: string): Promise<{
  title: string; extract: string; thumbnail?: { source: string; width: number; height: number }
} | null> {
  const title = encodeURIComponent(query.replace(/ /g, '_'))
  try {
    const res = await fetch(`https://cs.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      next: { revalidate: 86400 },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.extract && data.type !== 'disambiguation') return data
    }
  } catch { /* ignore */ }
  return null
}

export async function fetchNearbyHotels(lat: number, lon: number, exclude: string, limit = 6): Promise<NearbyHotel[]> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), exclude, limit: String(limit) })
    const res = await fetch(`${API}/api/hotels/nearby?${params}`, { next: { revalidate: 600 } })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function fetchAllHotelSlugs(limit?: number): Promise<{ slug: string; updated_at: string | null }[]> {
  try {
    const qs = limit ? `?limit=${limit}` : ''
    const res = await fetch(`${API}/api/hotels/slugs${qs}`, { next: { revalidate: 3600 }, signal: timeout(20_000) })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function fetchHotelSearch(q: string): Promise<{
  slug: string; name: string; country: string; resort_town: string | null; stars: number | null; thumbnail_url: string | null
}[]> {
  if (q.trim().length < 2) return []
  try {
    const res = await fetch(`${API}/api/hotels/search?q=${encodeURIComponent(q.trim())}`)
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export type DestinationAIItem = { name: string; description: string; emoji?: string }
export type DestinationAIData = {
  description: string | null
  excursions: DestinationAIItem[]
  best_time: string | null
  places: DestinationAIItem[]
  food: DestinationAIItem[]
  trips: DestinationAIItem[]
}

export async function fetchDestinationAI(destination: string): Promise<DestinationAIData> {
  try {
    const res = await fetch(
      `${API}/api/destination-ai/${encodeURIComponent(destination)}`,
      { next: { revalidate: 3600 }, signal: timeout() }
    )
    if (!res.ok) return { description: null, excursions: [], best_time: null, places: [], food: [], trips: [] }
    const d = await res.json()
    return {
      description: d.description ?? null,
      excursions:  d.excursions  ?? [],
      best_time:   d.best_time   ?? null,
      places:      d.places      ?? [],
      food:        d.food        ?? [],
      trips:       d.trips       ?? [],
    }
  } catch { return { description: null, excursions: [], best_time: null, places: [], food: [], trips: [] } }
}

export async function fetchFilters(): Promise<{
  mealPlans: { meal_plan: string; count: number }[]
  priceRange: { min: number; max: number }
  durations: { duration: number; count: number }[]
  stars: { stars: number; count: number }[]
  transports: { transport: string; count: number }[]
  totalTours: number
  totalHotels: number
  departureCities: { departure_city: string; count: number }[]
}> {
  const res = await fetch(`${API}/api/filters`, { next: { revalidate: 300 }, signal: timeout() })
  if (!res.ok) return { mealPlans: [], priceRange: { min: 0, max: 200000 }, durations: [], stars: [], transports: [], totalTours: 0, totalHotels: 0, departureCities: [] }
  return res.json()
}
