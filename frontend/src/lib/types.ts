export interface Hotel {
  id: number
  slug: string
  agency: string
  name: string
  country: string | null
  destination: string | null
  resort_town: string | null
  stars: number | null
  review_score: number | null
  description: string | null
  thumbnail_url: string | null
  photos: string | null  // JSON array of photo URLs
  amenities: string | null
  tags: string | null
  distances: string | null
  food_options: string | null
  price_includes: string | null
  latitude: number | null
  longitude: number | null
  min_price: number
  max_price?: number
  available_dates: number
  next_departure: string | null
  total_dates?: number
  has_last_minute?: number   // 1 pokud má alespoň jeden LM termín
  has_first_minute?: number  // 1 pokud má alespoň jeden FM termín
}

export interface Tour {
  id: number
  hotel_id: number
  agency: string
  departure_date: string | null
  return_date: string | null
  duration: number | null
  price: number
  transport: string | null
  meal_plan: string | null
  adults: number
  room_code: string | null
  url: string
  departure_city?: string | null
}

export interface Filters {
  destination?: string
  date_from?: string
  date_to?: string
  adults?: number
  duration?: string
  min_price?: number
  max_price?: number
  stars?: string
  meal_plan?: string
  transport?: string
  tour_type?: string   // 'last_minute' | 'first_minute'
  departure_city?: string
  sort?: string
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}
