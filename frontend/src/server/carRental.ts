import 'server-only'
import { query } from './db'
import type { Q } from './hotels'

/* eslint-disable @typescript-eslint/no-explicit-any */

function slugify(str: string) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// ─── In-memory cache (per teplá instance) ─────────────────────────────────
const _cache = new Map<string, { v: any; ts: number; ttl: number }>()
const CACHE_TTL = 25 * 60 * 1000
const LOC_CACHE_TTL = 24 * 60 * 60 * 1000
function cGet(key: string) {
  const e = _cache.get(key)
  if (!e) return null
  if (Date.now() - e.ts > e.ttl) { _cache.delete(key); return null }
  return e.v
}
function cSet(key: string, value: any, ttl = CACHE_TTL) {
  if (_cache.size > 500) _cache.delete(_cache.keys().next().value as string)
  _cache.set(key, { v: value, ts: Date.now(), ttl })
}

const DC_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.discovercars.com/',
  'Origin': 'https://www.discovercars.com',
  'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
}
const AFFILIATE_ID = process.env.DISCOVERCARS_AFFILIATE_ID || 'dominikmedal'

async function getLocation(searchTerm: string): Promise<any | null> {
  const key = `loc:${searchTerm.toLowerCase()}`
  const cached = cGet(key)
  if (cached) return cached
  const r = await fetch(`https://www.discovercars.com/en/search/autocomplete/${encodeURIComponent(searchTerm)}`, { headers: DC_HEADERS, signal: AbortSignal.timeout(10_000) })
  if (!r.ok) return null
  const data = await r.json()
  if (!Array.isArray(data) || data.length === 0) return null
  const loc =
    data.find((d: any) => (d.type || '').toLowerCase().includes('airport')) ||
    data.find((d: any) => (d.place || '').toLowerCase().includes('airport')) ||
    data[0]
  cSet(key, loc, LOC_CACHE_TTL)
  return loc
}

async function createSearch(p: {
  countryID: number; cityID: number; placeID: number
  dropoffCountryID?: number; dropoffCityID?: number; dropoffPlaceID?: number
  pickupDate: string; dropoffDate: string; pickupTime?: string; dropoffTime?: string
  driverAge?: number; residence?: string
}) {
  const pt = p.pickupTime || '12:00'
  const dt = p.dropoffTime || '12:00'
  const dCountry = p.dropoffCountryID ?? p.countryID
  const dCity = p.dropoffCityID ?? p.cityID
  const dPlace = p.dropoffPlaceID ?? p.placeID
  const body = new URLSearchParams({
    pick_up_country_id: String(p.countryID), pick_up_city_id: String(p.cityID), pick_up_location_id: String(p.placeID),
    drop_off_country_id: String(dCountry), drop_off_city_id: String(dCity), drop_off_location_id: String(dPlace),
    pickup_id: String(p.placeID), dropoff_id: String(dPlace),
    pickup_from: `${p.pickupDate} ${pt}`, pickup_to: `${p.dropoffDate} ${dt}`,
    pick_time: pt, drop_time: dt,
    driver_age: String(p.driverAge || 30), residence_country: p.residence || 'CZ',
    is_drop_off: dPlace !== p.placeID ? '1' : '0',
    partner_id: '0', exclude_locations: '0', luxOnly: '0', abtest: '', token: '', recent_search: '0',
  })
  const r = await fetch('https://www.discovercars.com/en/search/create-search', {
    method: 'POST',
    headers: { ...DC_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) return null
  const data = await r.json()
  return data?.success && data?.data?.guid ? data : null
}

async function pollResults(guid: string, sq: string) {
  const url = `https://www.discovercars.com/api/v2/search/${guid}?sq=${encodeURIComponent(sq)}&searchVersion=2`
  for (let i = 0; i < 5; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1500))
    try {
      const r = await fetch(url, { headers: DC_HEADERS, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) continue
      const data = await r.json()
      const offers = data?.data?.offers || data?.offers
      if (offers && offers.length > 0 && (data?.data?.isComplete !== false || i >= 3)) return data
    } catch (e) {
      console.error('[car-rental] poll error:', (e as Error).message)
    }
  }
  return null
}

const SIPP_CATEGORY: Record<string, string> = {
  E: 'Economy', C: 'Compact', I: 'Intermediate', S: 'Standard', F: 'Full-size',
  P: 'Premium', L: 'Luxury', M: 'Minivan', X: 'Speciální', N: 'SUV', G: 'SUV',
}

export function dcBookUrl(raw: string | null) {
  if (!raw) return null
  try {
    const base = raw.startsWith('http') ? raw : `https://www.discovercars.com${raw.startsWith('/') ? '' : '/'}${raw}`
    const normalized = base.replace(/discovercars\.com\/[a-z]{2}\//, 'discovercars.com/cz/')
    const u = new URL(normalized)
    u.searchParams.set('a_aid', AFFILIATE_ID)
    return u.toString()
  } catch { return raw }
}

function parseSpecs(specs: any): Record<string, any> {
  if (!specs || typeof specs !== 'object') return {}
  if (Array.isArray(specs)) {
    const r: Record<string, any> = {}
    for (const s of specs) {
      const k = String(s.name || s.type || s.key || '').toLowerCase()
      r[k] = s.value !== undefined ? s.value : s.count
    }
    return r
  }
  return specs
}
function extractNum(val: any): number | null {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseInt(val, 10) || null
  if (typeof val === 'object') return val.number ?? val.count ?? val.value ?? null
  return null
}
function dcUrl(raw: string | null) {
  if (!raw) return null
  if (raw.startsWith('http')) return raw
  return `https://www.discovercars.com${raw.startsWith('/') ? '' : '/'}${raw}`
}

function normalizeOffer(offer: any) {
  const v = offer.vehicle || {}
  const pr = offer.price || {}
  const su = offer.supplier || {}
  const ex = offer.extras || {}
  const raw = pr.raw || {}
  const sp = parseSpecs(v.specifications || v.specs || {})
  const sipp = v.sippGroup || v.sipp || ''
  const cat = v.category || v.vehicleCategory || SIPP_CATEGORY[sipp?.[0]?.toUpperCase()] || 'Ostatní'
  return {
    carName: v.carName || 'Vozidlo nebo podobné',
    category: cat,
    sipp,
    image: dcUrl(v.carImg || v.imageUrl || v.image || null),
    seats: extractNum(sp.seats || sp.passengers || v.seats) ?? null,
    bags: extractNum(sp.bags || sp.luggage || v.bags) ?? null,
    transmission: sp.transmission || sp.gearbox || null,
    ac: sp.ac !== undefined ? !!sp.ac : sp.aircon !== undefined ? !!sp.aircon : true,
    fuelPolicy: sp.fuelPolicy || ex.fuelPolicy || null,
    price: {
      total: raw.total || raw.value || raw.price || null,
      perDay: raw.perDay || raw.daily || null,
      formatted: pr.formatted || null,
      currency: raw.currency || 'EUR',
    },
    supplier: {
      name: su.name || 'N/A',
      logo: dcUrl(su.logo || null),
      rating: typeof su.rating === 'object' ? (su.rating?.average ?? su.rating?.score ?? null) : (su.rating ?? null),
    },
    bookUrl: dcBookUrl(offer.bookUrl || null),
    offerHash: offer.hash || null,
  }
}

/** Cíl pro /api/car-rental/click – vrací validní URL DiscoverCars, nebo null. */
export function clickTarget(raw: string | undefined): URL | null {
  if (!raw) return null
  let dest: URL
  try { dest = new URL(raw) } catch { return null }
  if (dest.hostname !== 'discovercars.com' && !dest.hostname.endsWith('.discovercars.com')) return null
  if (!dest.searchParams.get('a_aid')) dest.searchParams.set('a_aid', AFFILIATE_ID)
  return dest
}

// GET /api/car-rental/search
export async function carSearch(q: Q) {
  const { location, dropoff_location, pickup_date, dropoff_date, pickup_time = '12:00', dropoff_time = '12:00', driver_age = '30', residence = 'CZ' } = q
  if (!location || !pickup_date || !dropoff_date) {
    return { status: 400, body: { error: 'Chybí parametry: location, pickup_date, dropoff_date' } }
  }
  const dropoffTerm = dropoff_location && dropoff_location !== location ? dropoff_location : null
  const cacheKey = `search:${location}:${dropoffTerm || ''}:${pickup_date}${pickup_time}:${dropoff_date}${dropoff_time}:${driver_age}:${residence}`
  const cached = cGet(cacheKey)
  if (cached) return { status: 200, body: cached }

  try {
    const [loc, dropoffLoc] = await Promise.all([getLocation(location), dropoffTerm ? getLocation(dropoffTerm) : Promise.resolve(null)])
    if (!loc?.placeID || (dropoffTerm && !dropoffLoc?.placeID)) {
      return { status: 200, body: { cars: [], error: 'location_not_found', location: null } }
    }
    const search = await createSearch({
      countryID: loc.countryID, cityID: loc.cityID, placeID: loc.placeID,
      dropoffCountryID: dropoffLoc?.countryID, dropoffCityID: dropoffLoc?.cityID, dropoffPlaceID: dropoffLoc?.placeID,
      pickupDate: pickup_date, dropoffDate: dropoff_date, pickupTime: pickup_time, dropoffTime: dropoff_time,
      driverAge: parseInt(driver_age, 10) || 30, residence,
    })
    if (!search) return { status: 200, body: { cars: [], error: 'search_create_failed', location: loc } }

    const results = await pollResults(search.data.guid, search.data.sq)
    const rawOffers = results?.data?.offers || results?.offers || []
    const cars = rawOffers.slice(0, 24).map(normalizeOffer)
    const response = {
      cars,
      sq: search.data.sq,
      location: { name: loc.location, place: loc.place, city: loc.city, country: loc.country, placeID: loc.placeID },
      dropoffLocation: dropoffLoc ? { place: dropoffLoc.place || dropoffLoc.location, placeID: dropoffLoc.placeID } : null,
      isComplete: results?.data?.isComplete ?? true,
    }
    if (cars.length > 0) cSet(cacheKey, response)
    return { status: 200, body: response }
  } catch (err) {
    console.error('[car-rental] search error:', (err as Error).message || err)
    return { status: 200, body: { cars: [], error: 'server_error' } }
  }
}

// GET /api/car-rental/custom-destinations
export async function customCarDestinations() {
  try {
    const { rows } = await query(`SELECT slug, name, country, country_slug, dc_path, dc_search_term, popular
                                  FROM car_destinations WHERE active = TRUE ORDER BY country ASC, name ASC`)
    return rows
  } catch { return [] }
}

const ENRICH_CACHE_TTL = 6 * 60 * 60 * 1000
const CZ_TO_EN_COUNTRY: Record<string, string> = {
  'Řecko': 'Greece', 'Turecko': 'Turkey', 'Chorvatsko': 'Croatia', 'Španělsko': 'Spain', 'Kypr': 'Cyprus',
  'Portugalsko': 'Portugal', 'Itálie': 'Italy', 'Bulharsko': 'Bulgaria', 'Albánie': 'Albania', 'Tunisko': 'Tunisia',
  'Maroko': 'Morocco', 'Egypt': 'Egypt', 'Thajsko': 'Thailand', 'Maledivy': 'Maldives',
  'Dominikánská republika': 'Dominican Republic', 'Mexiko': 'Mexico', 'Kuba': 'Cuba', 'Spojené arabské emiráty': 'UAE',
}

// GET /api/car-rental/enriched-destinations (těžké – spoléhá na cache; viz ISR/unstable_cache v dispatch)
export async function enrichedCarDestinations() {
  const cached = cGet('enriched-destinations')
  if (cached) return cached
  try {
    const { rows } = await query(`
      SELECT DISTINCT h.country, COALESCE(h.resort_town, h.destination) AS resort_town, h.destination
      FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
      WHERE s.next_departure >= CURRENT_DATE::text AND (h.resort_town IS NOT NULL OR h.destination IS NOT NULL)
      ORDER BY h.country, resort_town`)
    if (!rows.length) return []

    const BATCH = 6
    const results: any[] = []
    for (let i = 0; i < rows.length; i += BATCH) {
      const settled = await Promise.allSettled(rows.slice(i, i + BATCH).map(async (row: any) => {
        const czName = row.resort_town || row.destination
        const enCtx = CZ_TO_EN_COUNTRY[row.country] || ''
        const loc = (await getLocation(`${czName} airport`)) || (await getLocation(czName))
        if (!loc?.placeID) return null
        const dcPlace = (loc.place || loc.location || czName).toLowerCase().replace(/\s*\(.*?\)/g, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        const dcCountry = enCtx.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        return {
          slug: slugify(czName), name: czName, country: row.country, countrySlug: slugify(row.country),
          dcPath: dcCountry ? `${dcCountry}/${dcPlace}` : dcPlace,
          dcSearchTerm: loc.place || czName,
          placeID: loc.placeID, cityID: loc.cityID, countryID: loc.countryID,
          popular: false, dynamic: true,
        }
      }))
      for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    }
    cSet('enriched-destinations', results, ENRICH_CACHE_TTL)
    return results
  } catch (err) {
    console.error('[car-rental] enriched-destinations error:', (err as Error).message || err)
    return []
  }
}

// GET /api/car-rental/autocomplete
export async function carAutocomplete(q: Q) {
  const term = q.q
  if (!term || term.length < 2) return []
  try {
    const r = await fetch(`https://www.discovercars.com/en/search/autocomplete/${encodeURIComponent(term)}`, { headers: DC_HEADERS, signal: AbortSignal.timeout(8_000) })
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data.slice(0, 8) : []
  } catch (err) {
    console.error('[car-rental] autocomplete error:', (err as Error).message || err)
    return []
  }
}
