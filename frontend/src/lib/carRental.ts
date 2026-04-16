export const AFFILIATE_ID = 'dominikmedal'
export const DC_BASE = 'https://www.discovercars.com'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CarDestination {
  slug: string
  name: string
  country: string
  countrySlug: string    // slug for our country-level page
  dcPath: string         // DiscoverCars URL path after /car-hire/
  dcSearchTerm: string   // English term for DC autocomplete API (airport/city name)
  popular: boolean
  emoji?: string
}

// ─── URL builder ──────────────────────────────────────────────────────────────

export function buildDCUrl(params: {
  dcPath: string
  pickupDate?: string
  dropoffDate?: string
  pickupTime?: string
  dropoffTime?: string
  driverAge?: number
}): string {
  const url = new URL(`${DC_BASE}/car-hire/${params.dcPath}`)
  if (params.pickupDate)  url.searchParams.set('pickup_date',  params.pickupDate)
  if (params.dropoffDate) url.searchParams.set('dropoff_date', params.dropoffDate)
  url.searchParams.set('pickup_time',  params.pickupTime  ?? '12:00')
  url.searchParams.set('dropoff_time', params.dropoffTime ?? '12:00')
  if (params.driverAge)   url.searchParams.set('driver_age', String(params.driverAge))
  url.searchParams.set('a_aid', AFFILIATE_ID)
  return url.toString()
}

export function buildDCHubUrl(): string {
  return `${DC_BASE}/?a_aid=${AFFILIATE_ID}`
}

/**
 * Deep link using numeric placeID — avoids slug 404s.
 * Use this whenever we have a placeID from autocomplete/search response.
 */
export function buildDCUrlById(params: {
  placeID: number
  pickupDate?: string
  dropoffDate?: string
  pickupTime?: string
  dropoffTime?: string
  driverAge?: number
}): string {
  const url = new URL(`${DC_BASE}/`)
  url.searchParams.set('pickup_location_id',  String(params.placeID))
  url.searchParams.set('dropoff_location_id', String(params.placeID))
  if (params.pickupDate)  url.searchParams.set('pickup_date',  params.pickupDate)
  if (params.dropoffDate) url.searchParams.set('dropoff_date', params.dropoffDate)
  url.searchParams.set('pickup_time',  params.pickupTime  ?? '12:00')
  url.searchParams.set('dropoff_time', params.dropoffTime ?? '12:00')
  if (params.driverAge)   url.searchParams.set('driver_age', String(params.driverAge))
  url.searchParams.set('a_aid', AFFILIATE_ID)
  return url.toString()
}

export function getCarDestination(slug: string, all?: CarDestination[]): CarDestination | undefined {
  return (all ?? CAR_DESTINATIONS).find(d => d.slug === slug)
}

export function getRelatedDestinations(slug: string, all?: CarDestination[], limit = 4): CarDestination[] {
  const pool = all ?? CAR_DESTINATIONS
  const dest = getCarDestination(slug, pool)
  if (!dest) return pool.filter(d => d.popular).slice(0, limit)
  return pool
    .filter(d => d.slug !== slug && (d.country === dest.country || d.popular))
    .slice(0, limit)
}

/**
 * Merge static + dynamic destinations, deduplicating by slug.
 * Static entries always take priority (they have richer metadata).
 */
export function mergeDestinations(dynamic: CarDestination[]): CarDestination[] {
  const staticSlugs = new Set(CAR_DESTINATIONS.map(d => d.slug))
  const extras = dynamic.filter(d => !staticSlugs.has(d.slug))
  return [...CAR_DESTINATIONS, ...extras]
}

// ─── Destinations ─────────────────────────────────────────────────────────────

export const CAR_DESTINATIONS: CarDestination[] = [
  // ── Řecko ──────────────────────────────────────────────────────────────────
  // ── Řecko ──────────────────────────────────────────────────────────────────
  { slug: 'kreta',     name: 'Kréta',           country: 'Řecko',      countrySlug: 'recko',       dcPath: 'greece/heraklion',       dcSearchTerm: 'heraklion airport',           popular: true,  emoji: '🏛️' },
  { slug: 'rhodos',    name: 'Rhodos',           country: 'Řecko',      countrySlug: 'recko',       dcPath: 'greece/rhodes',          dcSearchTerm: 'rhodes airport',              popular: true,  emoji: '🌹' },
  { slug: 'korfu',     name: 'Korfu',            country: 'Řecko',      countrySlug: 'recko',       dcPath: 'greece/corfu',           dcSearchTerm: 'corfu airport',               popular: true,  emoji: '🫒' },
  { slug: 'kos',       name: 'Kos',              country: 'Řecko',      countrySlug: 'recko',       dcPath: 'greece/kos',             dcSearchTerm: 'kos airport',                 popular: false, emoji: '⚕️' },
  { slug: 'lefkada',   name: 'Lefkáda',          country: 'Řecko',      countrySlug: 'recko',       dcPath: 'greece/lefkada',         dcSearchTerm: 'preveza airport',             popular: true,  emoji: '🌊' },
  { slug: 'santorini', name: 'Santorini',        country: 'Řecko',      countrySlug: 'recko',       dcPath: 'greece/santorini',       dcSearchTerm: 'santorini airport',           popular: true,  emoji: '🔵' },
  { slug: 'zakynthos', name: 'Zakynthos',        country: 'Řecko',      countrySlug: 'recko',       dcPath: 'greece/zakynthos',       dcSearchTerm: 'zakynthos airport',           popular: false, emoji: '🐢' },
  // ── Turecko ────────────────────────────────────────────────────────────────
  { slug: 'antalya',   name: 'Antalya',          country: 'Turecko',    countrySlug: 'turecko',     dcPath: 'turkey/antalya-airport', dcSearchTerm: 'antalya airport',             popular: true,  emoji: '🕌' },
  { slug: 'bodrum',    name: 'Bodrum',           country: 'Turecko',    countrySlug: 'turecko',     dcPath: 'turkey/bodrum',          dcSearchTerm: 'bodrum airport',              popular: false, emoji: '⛵' },
  { slug: 'dalaman',   name: 'Dalaman & Fethiye',country: 'Turecko',    countrySlug: 'turecko',     dcPath: 'turkey/dalaman',         dcSearchTerm: 'dalaman airport',             popular: false, emoji: '🏖️' },
  // ── Chorvatsko ─────────────────────────────────────────────────────────────
  { slug: 'split',     name: 'Split',            country: 'Chorvatsko', countrySlug: 'chorvatsko',  dcPath: 'croatia/split',          dcSearchTerm: 'split airport',               popular: true,  emoji: '🏟️' },
  { slug: 'dubrovnik', name: 'Dubrovník',        country: 'Chorvatsko', countrySlug: 'chorvatsko',  dcPath: 'croatia/dubrovnik',      dcSearchTerm: 'dubrovnik airport',           popular: true,  emoji: '🏯' },
  { slug: 'zadar',     name: 'Zadar',            country: 'Chorvatsko', countrySlug: 'chorvatsko',  dcPath: 'croatia/zadar',          dcSearchTerm: 'zadar airport',               popular: false, emoji: '🌅' },
  // ── Španělsko ──────────────────────────────────────────────────────────────
  { slug: 'mallorca',     name: 'Mallorca',     country: 'Španělsko',  countrySlug: 'spanelsko',   dcPath: 'spain/mallorca',         dcSearchTerm: 'palma mallorca airport',      popular: true,  emoji: '🌴' },
  { slug: 'tenerife',     name: 'Tenerife',     country: 'Španělsko',  countrySlug: 'spanelsko',   dcPath: 'spain/tenerife',         dcSearchTerm: 'tenerife south airport',      popular: true,  emoji: '🌋' },
  { slug: 'gran-canaria', name: 'Gran Canaria', country: 'Španělsko',  countrySlug: 'spanelsko',   dcPath: 'spain/gran-canaria',     dcSearchTerm: 'las palmas gran canaria airport', popular: false, emoji: '🏜️' },
  // ── Kypr ───────────────────────────────────────────────────────────────────
  { slug: 'paphos',    name: 'Paphos',           country: 'Kypr',       countrySlug: 'kypr',        dcPath: 'cyprus/paphos',          dcSearchTerm: 'paphos airport',              popular: true,  emoji: '🏺' },
  { slug: 'larnaka',   name: 'Larnaka',          country: 'Kypr',       countrySlug: 'kypr',        dcPath: 'cyprus/larnaca',         dcSearchTerm: 'larnaca airport',             popular: false, emoji: '✈️' },
  // ── Portugalsko ────────────────────────────────────────────────────────────
  { slug: 'algarve',   name: 'Algarve',          country: 'Portugalsko',countrySlug: 'portugalsko', dcPath: 'portugal/faro',          dcSearchTerm: 'faro airport',                popular: true,  emoji: '🌞' },
  { slug: 'madeira',   name: 'Madeira',          country: 'Portugalsko',countrySlug: 'portugalsko', dcPath: 'portugal/madeira',       dcSearchTerm: 'funchal airport',             popular: false, emoji: '🌿' },
]
