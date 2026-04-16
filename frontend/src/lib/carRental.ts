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

    // ── Řecko ────────────────────────────────────────────────────────────────
    { slug: 'kreta', name: 'Kréta', country: 'Řecko', countrySlug: 'recko', dcPath: 'greece/heraklion', dcSearchTerm: 'heraklion airport', popular: true, emoji: '🏛️' },
    { slug: 'rhodos', name: 'Rhodos', country: 'Řecko', countrySlug: 'recko', dcPath: 'greece/rhodes', dcSearchTerm: 'rhodes airport', popular: true, emoji: '🌹' },
    { slug: 'korfu', name: 'Korfu', country: 'Řecko', countrySlug: 'recko', dcPath: 'greece/corfu', dcSearchTerm: 'corfu airport', popular: true, emoji: '🫒' },
    { slug: 'kos', name: 'Kos', country: 'Řecko', countrySlug: 'recko', dcPath: 'greece/kos', dcSearchTerm: 'kos airport', popular: false, emoji: '⚕️' },
    { slug: 'lefkada', name: 'Lefkáda', country: 'Řecko', countrySlug: 'recko', dcPath: 'greece/lefkada', dcSearchTerm: 'preveza airport', popular: true, emoji: '🌊' },
    { slug: 'santorini', name: 'Santorini', country: 'Řecko', countrySlug: 'recko', dcPath: 'greece/santorini', dcSearchTerm: 'santorini airport', popular: true, emoji: '🔵' },
    { slug: 'zakynthos', name: 'Zakynthos', country: 'Řecko', countrySlug: 'recko', dcPath: 'greece/zakynthos', dcSearchTerm: 'zakynthos airport', popular: false, emoji: '🐢' },
    { slug: 'atheny', name: 'Atény', country: 'Řecko', countrySlug: 'recko', dcPath: 'greece/athens', dcSearchTerm: 'athens airport', popular: true, emoji: '🏛️' },

    // ── Španělsko ────────────────────────────────────────────────────────────
    { slug: 'mallorca', name: 'Mallorca', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/mallorca', dcSearchTerm: 'palma mallorca airport', popular: true, emoji: '🌴' },
    { slug: 'tenerife', name: 'Tenerife', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/tenerife', dcSearchTerm: 'tenerife south airport', popular: true, emoji: '🌋' },
    { slug: 'gran-canaria', name: 'Gran Canaria', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/gran-canaria', dcSearchTerm: 'las palmas airport', popular: true, emoji: '🏜️' },
    { slug: 'ibiza', name: 'Ibiza', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/ibiza', dcSearchTerm: 'ibiza airport', popular: true, emoji: '🎉' },
    { slug: 'menorca', name: 'Menorca', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/menorca', dcSearchTerm: 'menorca airport', popular: false, emoji: '🌿' },
    { slug: 'barcelona', name: 'Barcelona', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/barcelona', dcSearchTerm: 'barcelona airport', popular: true, emoji: '🏖️' },
    { slug: 'malaga', name: 'Malaga', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/malaga', dcSearchTerm: 'malaga airport', popular: true, emoji: '🌞' },
    { slug: 'alicante', name: 'Alicante', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/alicante', dcSearchTerm: 'alicante airport', popular: true, emoji: '🏝️' },
    { slug: 'valencia', name: 'Valencia', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/valencia', dcSearchTerm: 'valencia airport', popular: false, emoji: '🍊' },
    { slug: 'sevilla', name: 'Sevilla', country: 'Španělsko', countrySlug: 'spanelsko', dcPath: 'spain/seville', dcSearchTerm: 'seville airport', popular: false, emoji: '💃' },

    // ── Itálie ───────────────────────────────────────────────────────────────
    { slug: 'sicilie', name: 'Sicílie', country: 'Itálie', countrySlug: 'italie', dcPath: 'italy/sicily', dcSearchTerm: 'catania airport', popular: true, emoji: '🌋' },
    { slug: 'sardinie', name: 'Sardinie', country: 'Itálie', countrySlug: 'italie', dcPath: 'italy/sardinia', dcSearchTerm: 'cagliari airport', popular: true, emoji: '🏝️' },
    { slug: 'rim', name: 'Řím', country: 'Itálie', countrySlug: 'italie', dcPath: 'italy/rome', dcSearchTerm: 'rome airport', popular: true, emoji: '🏛️' },
    { slug: 'milano', name: 'Milán', country: 'Itálie', countrySlug: 'italie', dcPath: 'italy/milan', dcSearchTerm: 'milan airport', popular: false, emoji: '👗' },
    { slug: 'neapol', name: 'Neapol', country: 'Itálie', countrySlug: 'italie', dcPath: 'italy/naples', dcSearchTerm: 'naples airport', popular: true, emoji: '🍕' },
    { slug: 'benatky', name: 'Benátky', country: 'Itálie', countrySlug: 'italie', dcPath: 'italy/venice', dcSearchTerm: 'venice airport', popular: true, emoji: '🚤' },
    { slug: 'bologna', name: 'Bologna', country: 'Itálie', countrySlug: 'italie', dcPath: 'italy/bologna', dcSearchTerm: 'bologna airport', popular: false, emoji: '🍝' },
    { slug: 'florencie', name: 'Florencie', country: 'Itálie', countrySlug: 'italie', dcPath: 'italy/florence', dcSearchTerm: 'florence airport', popular: false, emoji: '🎨' },

    // ── Chorvatsko ───────────────────────────────────────────────────────────
    { slug: 'split', name: 'Split', country: 'Chorvatsko', countrySlug: 'chorvatsko', dcPath: 'croatia/split', dcSearchTerm: 'split airport', popular: true, emoji: '🏟️' },
    { slug: 'dubrovnik', name: 'Dubrovník', country: 'Chorvatsko', countrySlug: 'chorvatsko', dcPath: 'croatia/dubrovnik', dcSearchTerm: 'dubrovnik airport', popular: true, emoji: '🏯' },
    { slug: 'zadar', name: 'Zadar', country: 'Chorvatsko', countrySlug: 'chorvatsko', dcPath: 'croatia/zadar', dcSearchTerm: 'zadar airport', popular: false, emoji: '🌅' },
    { slug: 'pula', name: 'Pula', country: 'Chorvatsko', countrySlug: 'chorvatsko', dcPath: 'croatia/pula', dcSearchTerm: 'pula airport', popular: false, emoji: '🏛️' },

    // ── Portugalsko ──────────────────────────────────────────────────────────
    { slug: 'algarve', name: 'Algarve', country: 'Portugalsko', countrySlug: 'portugalsko', dcPath: 'portugal/faro', dcSearchTerm: 'faro airport', popular: true, emoji: '🌞' },
    { slug: 'madeira', name: 'Madeira', country: 'Portugalsko', countrySlug: 'portugalsko', dcPath: 'portugal/madeira', dcSearchTerm: 'funchal airport', popular: true, emoji: '🌿' },
    { slug: 'lisabon', name: 'Lisabon', country: 'Portugalsko', countrySlug: 'portugalsko', dcPath: 'portugal/lisbon', dcSearchTerm: 'lisbon airport', popular: true, emoji: '🏙️' },

    // ── Francie ──────────────────────────────────────────────────────────────
    { slug: 'nice', name: 'Nice', country: 'Francie', countrySlug: 'francie', dcPath: 'france/nice', dcSearchTerm: 'nice airport', popular: true, emoji: '🌊' },
    { slug: 'pariz', name: 'Paříž', country: 'Francie', countrySlug: 'francie', dcPath: 'france/paris', dcSearchTerm: 'paris airport', popular: true, emoji: '🗼' },
    { slug: 'lyon', name: 'Lyon', country: 'Francie', countrySlug: 'francie', dcPath: 'france/lyon', dcSearchTerm: 'lyon airport', popular: false, emoji: '🍷' },
    { slug: 'toulouse', name: 'Toulouse', country: 'Francie', countrySlug: 'francie', dcPath: 'france/toulouse', dcSearchTerm: 'toulouse airport', popular: false, emoji: '🚀' },

    // ── Kypr ─────────────────────────────────────────────────────────────────
    { slug: 'paphos', name: 'Paphos', country: 'Kypr', countrySlug: 'kypr', dcPath: 'cyprus/paphos', dcSearchTerm: 'paphos airport', popular: true, emoji: '🏺' },
    { slug: 'larnaka', name: 'Larnaka', country: 'Kypr', countrySlug: 'kypr', dcPath: 'cyprus/larnaca', dcSearchTerm: 'larnaca airport', popular: true, emoji: '✈️' },

    // ── Malta ────────────────────────────────────────────────────────────────
    { slug: 'malta', name: 'Malta', country: 'Malta', countrySlug: 'malta', dcPath: 'malta/malta', dcSearchTerm: 'malta airport', popular: true, emoji: '🏖️' },

    // ── Turecko ──────────────────────────────────────────────────────────────
    { slug: 'antalya', name: 'Antalya', country: 'Turecko', countrySlug: 'turecko', dcPath: 'turkey/antalya-airport', dcSearchTerm: 'antalya airport', popular: true, emoji: '🕌' },
    { slug: 'bodrum', name: 'Bodrum', country: 'Turecko', countrySlug: 'turecko', dcPath: 'turkey/bodrum', dcSearchTerm: 'bodrum airport', popular: false, emoji: '⛵' },
    { slug: 'dalaman', name: 'Dalaman', country: 'Turecko', countrySlug: 'turecko', dcPath: 'turkey/dalaman', dcSearchTerm: 'dalaman airport', popular: false, emoji: '🏖️' },

    // ── Balkán ───────────────────────────────────────────────────────────────
    { slug: 'tirana', name: 'Tirana', country: 'Albánie', countrySlug: 'albanie', dcPath: 'albania/tirana', dcSearchTerm: 'tirana airport', popular: true, emoji: '🏔️' },
    { slug: 'podgorica', name: 'Podgorica', country: 'Černá Hora', countrySlug: 'cerna-hora', dcPath: 'montenegro/podgorica', dcSearchTerm: 'podgorica airport', popular: false, emoji: '🌄' },

    // ── Egypt ────────────────────────────────────────────────────────────────
    { slug: 'hurghada', name: 'Hurghada', country: 'Egypt', countrySlug: 'egypt', dcPath: 'egypt/hurghada', dcSearchTerm: 'hurghada airport', popular: true, emoji: '🐪' },
    { slug: 'sharm-el-sheikh', name: 'Sharm El Sheikh', country: 'Egypt', countrySlug: 'egypt', dcPath: 'egypt/sharm-el-sheikh', dcSearchTerm: 'sharm el sheikh airport', popular: true, emoji: '🌊' },

    // ── Maroko ───────────────────────────────────────────────────────────────
    { slug: 'marrakesh', name: 'Marrákeš', country: 'Maroko', countrySlug: 'maroko', dcPath: 'morocco/marrakech', dcSearchTerm: 'marrakech airport', popular: true, emoji: '🕌' },
    { slug: 'agadir', name: 'Agadir', country: 'Maroko', countrySlug: 'maroko', dcPath: 'morocco/agadir', dcSearchTerm: 'agadir airport', popular: false, emoji: '🏖️' },

    // ── SAE ──────────────────────────────────────────────────────────────────
    { slug: 'dubai', name: 'Dubaj', country: 'SAE', countrySlug: 'sae', dcPath: 'uae/dubai', dcSearchTerm: 'dubai airport', popular: true, emoji: '🏙️' },
    { slug: 'abu-dhabi', name: 'Abu Dhabi', country: 'SAE', countrySlug: 'sae', dcPath: 'uae/abu-dhabi', dcSearchTerm: 'abu dhabi airport', popular: false, emoji: '🕌' },

    // ── USA ──────────────────────────────────────────────────────────────────
    { slug: 'miami', name: 'Miami', country: 'USA', countrySlug: 'usa', dcPath: 'usa/miami', dcSearchTerm: 'miami airport', popular: true, emoji: '🌴' },
    { slug: 'los-angeles', name: 'Los Angeles', country: 'USA', countrySlug: 'usa', dcPath: 'usa/los-angeles', dcSearchTerm: 'los angeles airport', popular: true, emoji: '🎬' },
    { slug: 'las-vegas', name: 'Las Vegas', country: 'USA', countrySlug: 'usa', dcPath: 'usa/las-vegas', dcSearchTerm: 'las vegas airport', popular: true, emoji: '🎰' },
    { slug: 'new-york', name: 'New York', country: 'USA', countrySlug: 'usa', dcPath: 'usa/new-york', dcSearchTerm: 'new york airport', popular: true, emoji: '🗽' },
    { slug: 'orlando', name: 'Orlando', country: 'USA', countrySlug: 'usa', dcPath: 'usa/orlando', dcSearchTerm: 'orlando airport', popular: true, emoji: '🎢' },

    // ── Kanada ───────────────────────────────────────────────────────────────
    { slug: 'toronto', name: 'Toronto', country: 'Kanada', countrySlug: 'kanada', dcPath: 'canada/toronto', dcSearchTerm: 'toronto airport', popular: false, emoji: '🏙️' },
    { slug: 'vancouver', name: 'Vancouver', country: 'Kanada', countrySlug: 'kanada', dcPath: 'canada/vancouver', dcSearchTerm: 'vancouver airport', popular: false, emoji: '🌲' },

    // ── Asie ─────────────────────────────────────────────────────────────────
    { slug: 'phuket', name: 'Phuket', country: 'Thajsko', countrySlug: 'thajsko', dcPath: 'thailand/phuket', dcSearchTerm: 'phuket airport', popular: true, emoji: '🏝️' },
    { slug: 'bangkok', name: 'Bangkok', country: 'Thajsko', countrySlug: 'thajsko', dcPath: 'thailand/bangkok', dcSearchTerm: 'bangkok airport', popular: false, emoji: '🏙️' },
    { slug: 'bali', name: 'Bali', country: 'Indonésie', countrySlug: 'indonesie', dcPath: 'indonesia/bali', dcSearchTerm: 'denpasar airport', popular: true, emoji: '🌺' },

    // ── Oceánie ──────────────────────────────────────────────────────────────
    { slug: 'sydney', name: 'Sydney', country: 'Austrálie', countrySlug: 'australie', dcPath: 'australia/sydney', dcSearchTerm: 'sydney airport', popular: true, emoji: '🌏' },
    { slug: 'auckland', name: 'Auckland', country: 'Nový Zéland', countrySlug: 'novy-zeland', dcPath: 'new-zealand/auckland', dcSearchTerm: 'auckland airport', popular: true, emoji: '🚐' },

    // ── Island ───────────────────────────────────────────────────────────────
    { slug: 'island', name: 'Island', country: 'Island', countrySlug: 'island', dcPath: 'iceland/reykjavik', dcSearchTerm: 'keflavik airport', popular: true, emoji: '❄️' },
]
