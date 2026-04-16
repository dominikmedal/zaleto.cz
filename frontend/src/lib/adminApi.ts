const BASE     = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const FRONTEND = typeof window !== 'undefined' ? window.location.origin : ''
const REVALIDATE_SECRET = process.env.NEXT_PUBLIC_REVALIDATE_SECRET ?? ''

async function revalidateFrontend(path: string, tag?: string) {
  await fetch(`${FRONTEND}/api/revalidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      ...(tag    ? { tag }    : {}),
      ...(REVALIDATE_SECRET ? { secret: REVALIDATE_SECRET } : {}),
    }),
  })
}

function getToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('admin_token') ?? ''
}

function headers() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api/admin${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string> ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}

// ── Auth ─────────────────────────────────────────────────────────────
export async function adminLogin(password: string): Promise<string> {
  const data = await api<{ ok: boolean; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  localStorage.setItem('admin_token', data.token)
  return data.token
}

export async function adminCheck(): Promise<boolean> {
  try { await api('/auth/check'); return true } catch { return false }
}

export function adminLogout() { localStorage.removeItem('admin_token') }

// ── Stats ─────────────────────────────────────────────────────────────
export interface AdminStats {
  hotels: number; agencies: number; tours: number; articles: number
  destinations: number; customPhotos: number; minPrice: number | null
  recentHotels: RecentHotel[]; recentArticles: RecentArticle[]
}
export interface RecentHotel { id: number; slug: string; name: string; agency: string; country: string; stars: number | null; updated_at: string }
export interface RecentArticle { id: number; slug: string; title: string; category: string | null; location: string | null; published_at: string }

export function fetchAdminStats() { return api<AdminStats>('/stats') }

// ── Hotels ────────────────────────────────────────────────────────────
export interface AdminHotel {
  id: number; slug: string; name: string; agency: string; country: string
  destination: string | null; resort_town: string | null; stars: number | null
  thumbnail_url: string | null; review_score: number | null
  min_price: number | null; available_dates: number | null; next_departure: string | null
  updated_at: string
}
export interface HotelList { hotels: AdminHotel[]; total: number; page: number; limit: number }

export function fetchAdminHotels(params: Record<string, string | number>) {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return api<HotelList>(`/hotels?${qs}`)
}
export function createHotel(body: Partial<AdminHotel>) {
  return api<{ ok: boolean; slug: string }>('/hotels', { method: 'POST', body: JSON.stringify(body) })
}
export function updateHotel(id: number, body: Partial<AdminHotel>) {
  return api(`/hotels/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}
export function deleteHotel(id: number) {
  return api(`/hotels/${id}`, { method: 'DELETE' })
}

// ── Tours ─────────────────────────────────────────────────────────────
export interface AdminTour {
  id: number; agency: string; departure_date: string; return_date: string | null
  duration: number | null; price: number; transport: string | null
  meal_plan: string | null; adults: number; departure_city: string | null
  hotel_name: string; country: string; resort_town: string | null; hotel_slug: string
  hotel_id?: number
}
export interface TourList { tours: AdminTour[]; total: number; page: number; limit: number }

export function fetchAdminTours(params: Record<string, string | number>) {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return api<TourList>(`/tours?${qs}`)
}
export function createTour(body: Partial<AdminTour> & { hotel_id: number; price: number; departure_date: string }) {
  return api('/tours', { method: 'POST', body: JSON.stringify(body) })
}
export function updateTour(id: number, body: Partial<AdminTour>) {
  return api(`/tours/${id}`, { method: 'PUT', body: JSON.stringify(body) })
}
export function deleteTour(id: number) {
  return api(`/tours/${id}`, { method: 'DELETE' })
}

// ── Articles ──────────────────────────────────────────────────────────
export interface AdminArticle {
  id: number; slug: string; topic: string; title: string
  category: string | null; location: string | null; excerpt: string | null
  content?: string | null; reading_time: number | null; custom_image_url: string | null
  published_at: string; generated_at: string
}
export interface ArticleList { articles: AdminArticle[]; total: number }

export function fetchAdminArticles(params: Record<string, string | number>) {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return api<ArticleList>(`/articles?${qs}`)
}
export async function createArticle(body: Partial<AdminArticle>) {
  const result = await api<{ ok: boolean; slug: string }>('/articles', { method: 'POST', body: JSON.stringify(body) })
  await revalidateFrontend('/clanky', 'articles').catch(() => {})
  await revalidateFrontend('/').catch(() => {})
  return result
}
export async function updateArticle(id: number, body: Partial<AdminArticle> & { slug?: string }) {
  await api(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(body) })
  if (body.slug) {
    await revalidateFrontend(`/clanky/${body.slug}`, `article-${body.slug}`).catch(() => {})
  }
  await revalidateFrontend('/clanky', 'articles').catch(() => {})
  await revalidateFrontend('/').catch(() => {})
}
export function deleteArticle(id: number) {
  return api(`/articles/${id}`, { method: 'DELETE' })
}

// ── Destinations ──────────────────────────────────────────────────────
export interface AdminDest { name: string; photo_url: string | null; has_ai: boolean; updated_at: string }
export interface DestList { destinations: AdminDest[]; total: number }

export function fetchAdminDests(params: Record<string, string | number>) {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return api<DestList>(`/destinations?${qs}`)
}
export async function updateDest(name: string, photo_url: string) {
  await api(`/destinations/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ photo_url }) })
  await revalidateFrontend(`/destinace`).catch(() => {})
}

// ── Upload ────────────────────────────────────────────────────────────
export async function uploadImage(file: File): Promise<{ url: string; filename: string }> {
  const form = new FormData()
  form.append('image', file)
  const res = await fetch(`${BASE}/api/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}
