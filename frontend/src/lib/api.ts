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

export type WeatherAIData = {
  description: string | null
  monthly_air: number[] | null
  monthly_sea: number[] | null
  monthly_rain_days: number[] | null
  monthly_sun_hours: number[] | null
  best_months: number[]
  winter: string | null
  spring: string | null
  summer: string | null
  autumn: string | null
  wind_info: string | null
  sea_info: string | null
}

const EMPTY_WEATHER: WeatherAIData = {
  description: null, monthly_air: null, monthly_sea: null,
  monthly_rain_days: null, monthly_sun_hours: null, best_months: [],
  winter: null, spring: null, summer: null, autumn: null,
  wind_info: null, sea_info: null,
}

export async function fetchWeatherAI(destination: string): Promise<WeatherAIData> {
  try {
    const res = await fetch(
      `${API}/api/weather-ai/${encodeURIComponent(destination)}`,
      { next: { revalidate: 86400 }, signal: timeout() }
    )
    if (!res.ok) return EMPTY_WEATHER
    const d = await res.json()
    return { ...EMPTY_WEATHER, ...d }
  } catch { return EMPTY_WEATHER }
}

export async function fetchWeatherLocation(destination: string): Promise<{ lat: number | null; lon: number | null }> {
  try {
    const res = await fetch(
      `${API}/api/weather-ai/location/${encodeURIComponent(destination)}`,
      { next: { revalidate: 86400 }, signal: timeout() }
    )
    if (!res.ok) return { lat: null, lon: null }
    return res.json()
  } catch { return { lat: null, lon: null } }
}

export type Article = {
  id: number
  slug: string
  title: string
  category: string | null
  location: string | null
  excerpt: string | null
  reading_time: number
  published_at: string
  custom_image_url: string | null
}

export type ArticleFull = Article & { content: string | null; topic: string; custom_image_url: string | null }

export async function fetchAllArticleSlugs(): Promise<{ slug: string; published_at: string }[]> {
  try {
    const res = await fetch(`${API}/api/articles/slugs`, { next: { revalidate: 3600 }, signal: timeout(20_000) })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function fetchArticles(limit = 3, location?: string): Promise<Article[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit) })
    if (location) params.set('location', location)
    const res = await fetch(`${API}/api/articles?${params}`, {
      next: { revalidate: 3600, tags: ['articles'] },
      signal: timeout(),
    })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

export async function fetchArticle(slug: string): Promise<ArticleFull | null> {
  try {
    const res = await fetch(`${API}/api/articles/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300, tags: [`article-${slug}`] },
      signal: timeout(),
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ─── Car rental (DiscoverCars proxy) ─────────────────────────────────────────

export interface CarOffer {
  carName: string
  category: string
  sipp: string
  image: string | null
  seats: number | null
  bags: number | null
  transmission: string | null
  ac: boolean
  fuelPolicy: string | null
  price: { total: number | null; perDay: number | null; formatted: string | null; currency: string }
  supplier: { name: string; logo: string | null; rating: number | null }
  bookUrl: string | null  // direct DC booking link with affiliate already appended
  offerHash: string | null
}

export interface CarSearchResult {
  cars: CarOffer[]
  sq?: string   // DC search token — used to build /offer/{hash}?sq=... direct links
  location?: { name: string; place: string; city: string; country: string; placeID?: number } | null
  isComplete?: boolean
  error?: string
}

export async function fetchCarSearch(params: {
  location: string       // English search term, e.g. "heraklion airport"
  pickupDate: string     // YYYY-MM-DD
  dropoffDate: string    // YYYY-MM-DD
  pickupTime?: string    // HH:MM, default 12:00
  dropoffTime?: string   // HH:MM, default 12:00
  driverAge?: number
  residence?: string
}): Promise<CarSearchResult> {
  try {
    const p = new URLSearchParams({
      location:      params.location,
      pickup_date:   params.pickupDate,
      dropoff_date:  params.dropoffDate,
      pickup_time:   params.pickupTime  ?? '12:00',
      dropoff_time:  params.dropoffTime ?? '12:00',
      driver_age:    String(params.driverAge ?? 30),
      residence:     params.residence ?? 'CZ',
    })
    const res = await fetch(`${API}/api/car-rental/search?${p}`, {
      signal: AbortSignal.timeout(35_000),
    })
    if (!res.ok) return { cars: [] }
    return res.json()
  } catch {
    return { cars: [] }
  }
}

export interface DynamicCarDestination {
  slug: string
  name: string
  country: string
  countrySlug: string
  dcPath: string
  dcSearchTerm: string
  placeID?: number
  cityID?: number
  countryID?: number
  popular: false
  dynamic: true
}

async function fetchEnrichedCarDestinations(): Promise<DynamicCarDestination[]> {
  try {
    const res = await fetch(`${API}/api/car-rental/enriched-destinations`, {
      next: { revalidate: 21600 },
      signal: timeout(30_000),
    })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

async function fetchCustomCarDestinations(): Promise<DynamicCarDestination[]> {
  try {
    const res = await fetch(`${API}/api/car-rental/custom-destinations`, {
      next: { revalidate: 3600 },
      signal: timeout(10_000),
    })
    if (!res.ok) return []
    const rows = await res.json()
    // Map DB column names to DynamicCarDestination shape
    return rows.map((r: { slug: string; name: string; country: string; country_slug: string; dc_path: string; dc_search_term: string; popular: boolean }) => ({
      slug:          r.slug,
      name:          r.name,
      country:       r.country,
      countrySlug:   r.country_slug,
      dcPath:        r.dc_path,
      dcSearchTerm:  r.dc_search_term,
      popular:       r.popular,
      dynamic:       true as const,
    }))
  } catch { return [] }
}

/** Fetches all dynamic destinations: admin-managed (DB) + auto-enriched from tours */
export async function fetchDynamicCarDestinations(): Promise<DynamicCarDestination[]> {
  const [custom, enriched] = await Promise.all([
    fetchCustomCarDestinations(),
    fetchEnrichedCarDestinations(),
  ])
  // Custom (admin-managed) override enriched on same slug
  const customSlugs = new Set(custom.map(d => d.slug))
  return [...custom, ...enriched.filter(d => !customSlugs.has(d.slug))]
}

export async function fetchCarAutocomplete(q: string): Promise<{
  location: string; place: string; city: string; country: string
  countryID: number; cityID: number; placeID: number; type: string
}[]> {
  if (q.trim().length < 2) return []
  try {
    const res = await fetch(`${API}/api/car-rental/autocomplete?q=${encodeURIComponent(q.trim())}`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// ─── Filters ──────────────────────────────────────────────────────────────────

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
