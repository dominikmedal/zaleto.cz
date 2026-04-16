const express = require('express')
const router = express.Router()
const db = require('../db')

let _offerFieldsLogged = false

// Inline slugify — same logic as frontend/src/lib/slugify.ts
function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
const _cache = new Map()
const CACHE_TTL = 25 * 60 * 1000      // 25 min pro výsledky hledání
const LOC_CACHE_TTL = 24 * 60 * 60 * 1000  // 24 hod pro location IDs

function cGet(key) {
  const e = _cache.get(key)
  if (!e) return null
  if (Date.now() - e.ts > e.ttl) { _cache.delete(key); return null }
  return e.v
}
function cSet(key, value, ttl = CACHE_TTL) {
  if (_cache.size > 500) _cache.delete(_cache.keys().next().value)
  _cache.set(key, { v: value, ts: Date.now(), ttl })
}

// ─── DiscoverCars headers (browser-like, pro CloudFlare) ──────────────────────
const DC_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer':         'https://www.discovercars.com/',
  'Origin':          'https://www.discovercars.com',
  'sec-ch-ua':        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest':  'empty',
  'sec-fetch-mode':  'cors',
  'sec-fetch-site':  'same-origin',
}

// ─── Step 1 — Location autocomplete ──────────────────────────────────────────
async function getLocation(searchTerm) {
  const key = `loc:${searchTerm.toLowerCase()}`
  const cached = cGet(key)
  if (cached) return cached

  const url = `https://www.discovercars.com/en/search/autocomplete/${encodeURIComponent(searchTerm)}`
  const r = await fetch(url, { headers: DC_HEADERS, signal: AbortSignal.timeout(10_000) })
  if (!r.ok) return null

  const data = await r.json()
  if (!Array.isArray(data) || data.length === 0) return null

  // Prefer airport then station, fallback first result
  const loc = data.find(d => (d.type || '').toLowerCase().includes('airport'))
    || data.find(d => (d.place || '').toLowerCase().includes('airport'))
    || data[0]

  cSet(key, loc, LOC_CACHE_TTL)
  return loc
}

// ─── Step 2 — Create search ───────────────────────────────────────────────────
async function createSearch({ countryID, cityID, placeID, pickupDate, dropoffDate, pickupTime, dropoffTime, driverAge, residence }) {
  const pt = pickupTime  || '12:00'
  const dt = dropoffTime || '12:00'
  const body = new URLSearchParams({
    pick_up_country_id:   String(countryID),
    pick_up_city_id:      String(cityID),
    pick_up_location_id:  String(placeID),
    drop_off_country_id:  String(countryID),
    drop_off_city_id:     String(cityID),
    drop_off_location_id: String(placeID),
    pickup_id:            String(placeID),
    dropoff_id:           String(placeID),
    pickup_from:          `${pickupDate} ${pt}`,
    pickup_to:            `${dropoffDate} ${dt}`,
    pick_time:            pt,
    drop_time:            dt,
    driver_age:           String(driverAge || 30),
    residence_country:    residence || 'CZ',
    is_drop_off:          '0',
    partner_id:           '0',
    exclude_locations:    '0',
    luxOnly:              '0',
    abtest:               '',
    token:                '',
    recent_search:        '0',
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

// ─── Step 3 — Poll results (max 5× à 1.5 s) ──────────────────────────────────
async function pollResults(guid, sq) {
  const url = `https://www.discovercars.com/api/v2/search/${guid}?sq=${encodeURIComponent(sq)}&searchVersion=2`

  for (let i = 0; i < 5; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1500))

    try {
      const r = await fetch(url, { headers: DC_HEADERS, signal: AbortSignal.timeout(10_000) })
      if (!r.ok) continue

      const data = await r.json()
      const offers = data?.data?.offers || data?.offers

      if (offers && offers.length > 0 && (data?.data?.isComplete !== false || i >= 3)) {
        return data
      }
    } catch (e) {
      console.error('[car-rental] poll error:', e.message)
    }
  }
  return null
}

// ─── Normalize single offer ───────────────────────────────────────────────────
const SIPP_CATEGORY = {
  E: 'Economy', C: 'Compact', I: 'Intermediate', S: 'Standard', F: 'Full-size',
  P: 'Premium', L: 'Luxury', M: 'Minivan', X: 'Speciální', N: 'SUV', G: 'SUV',
}

/**
 * Make a relative DC URL absolute and append affiliate ID.
 * Works for both /offer/... and full https:// URLs.
 */
function dcBookUrl(raw) {
  if (!raw) return null
  try {
    const base = raw.startsWith('http') ? raw : `https://www.discovercars.com${raw.startsWith('/') ? '' : '/'}${raw}`
    // Force English locale: replace /cz/, /de/, /fr/, etc. with /en/
    const normalized = base.replace(/discovercars\.com\/[a-z]{2}\//, 'discovercars.com/cz/')
    const u = new URL(normalized)
    u.searchParams.set('a_aid', 'dominikmedal')
    return u.toString()
  } catch { return raw }
}

/** Parse vehicle.specifications — handles both object and array shapes */
function parseSpecs(specs) {
  if (!specs || typeof specs !== 'object') return {}
  if (Array.isArray(specs)) {
    const r = {}
    for (const s of specs) {
      const k = String(s.name || s.type || s.key || '').toLowerCase()
      r[k] = s.value !== undefined ? s.value : s.count
    }
    return r
  }
  return specs
}

/** Extract a plain number from a spec value that may be {number, label} or a plain number/string */
function extractNum(val) {
  if (val == null) return null
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseInt(val, 10) || null
  if (typeof val === 'object') return val.number ?? val.count ?? val.value ?? null
  return null
}

/** Prefix relative DC URLs with the DC origin */
function dcUrl(raw) {
  if (!raw) return null
  if (raw.startsWith('http')) return raw
  return `https://www.discovercars.com${raw.startsWith('/') ? '' : '/'}${raw}`
}

function normalizeOffer(offer) {
  const v   = offer.vehicle  || {}
  const pr  = offer.price    || {}
  const su  = offer.supplier || {}
  const ex  = offer.extras   || {}
  const raw = pr.raw         || {}        // price.raw holds numeric values
  const sp  = parseSpecs(v.specifications || v.specs || {})

  const sipp = v.sippGroup || v.sipp || ''
  const cat  = v.category  || v.vehicleCategory || SIPP_CATEGORY[sipp?.[0]?.toUpperCase()] || 'Ostatní'

  return {
    carName:      v.carName || 'Vozidlo nebo podobné',
    category:     cat,
    sipp,
    image:        dcUrl(v.carImg || v.imageUrl || v.image || null),
    seats:        extractNum(sp.seats        || sp.passengers   || v.seats)  ?? null,
    bags:         extractNum(sp.bags         || sp.luggage       || v.bags)   ?? null,
    transmission: sp.transmission || sp.gearbox       || null,
    ac:           sp.ac !== undefined ? !!sp.ac : (sp.aircon !== undefined ? !!sp.aircon : true),
    fuelPolicy:   sp.fuelPolicy   || ex.fuelPolicy    || null,
    price: {
      total:     raw.total     || raw.value    || raw.price  || null,
      perDay:    raw.perDay    || raw.daily    || null,
      formatted: pr.formatted  || null,
      currency:  raw.currency  || 'EUR',
    },
    supplier: {
      name:   su.name   || 'N/A',
      logo:   dcUrl(su.logo || null),
      rating: typeof su.rating === 'object' ? (su.rating?.average ?? su.rating?.score ?? null) : (su.rating ?? null),
    },
    // bookUrl: direct DC booking link — append affiliate, use as "Rezervovat" href
    bookUrl: dcBookUrl(offer.bookUrl || null),
    offerHash: offer.hash || null,  // hex hash, kept for reference
  }
}

// ─── GET /api/car-rental/search ───────────────────────────────────────────────
// Params: location (string), pickup_date (YYYY-MM-DD), dropoff_date (YYYY-MM-DD),
//         pickup_time (HH:MM, default 12:00), dropoff_time (HH:MM, default 12:00),
//         driver_age (number, default 30), residence (2-letter country, default CZ)
router.get('/search', async (req, res) => {
  const { location, pickup_date, dropoff_date, pickup_time = '12:00', dropoff_time = '12:00', driver_age = '30', residence = 'CZ' } = req.query

  if (!location || !pickup_date || !dropoff_date) {
    return res.status(400).json({ error: 'Chybí parametry: location, pickup_date, dropoff_date' })
  }

  const cacheKey = `search:${location}:${pickup_date}${pickup_time}:${dropoff_date}${dropoff_time}:${driver_age}:${residence}`
  const cached = cGet(cacheKey)
  if (cached) {
    res.set('X-Cache', 'HIT')
    return res.json(cached)
  }

  try {
    // 1. Autocomplete → location IDs
    const loc = await getLocation(location)
    if (!loc?.placeID) {
      console.warn(`[car-rental] location not found: "${location}"`)
      return res.json({ cars: [], error: 'location_not_found', location: null })
    }

    // 2. Create search
    const search = await createSearch({
      countryID:   loc.countryID,
      cityID:      loc.cityID,
      placeID:     loc.placeID,
      pickupDate:  pickup_date,
      dropoffDate: dropoff_date,
      pickupTime:  pickup_time,
      dropoffTime: dropoff_time,
      driverAge:   parseInt(driver_age, 10) || 30,
      residence,
    })

    if (!search) {
      return res.json({ cars: [], error: 'search_create_failed', location: loc })
    }

    // 3. Poll results
    const results = await pollResults(search.data.guid, search.data.sq)
    const rawOffers = results?.data?.offers || results?.offers || []

    // Debug — log first offer structure once per restart to find correct hash field
    if (rawOffers.length > 0 && !_offerFieldsLogged) {
      _offerFieldsLogged = true
      const o = rawOffers[0]
      console.log('[car-rental] offer top-level keys:', Object.keys(o))
      const v = o.vehicle || o.Vehicle || o.car || {}
      console.log('[car-rental] vehicle keys:', Object.keys(v))
      const su = o.supplier || o.Supplier || o.vendor || {}
      console.log('[car-rental] supplier keys:', Object.keys(su))
      const pr = o.price || o.Price || o.pricing || {}
      console.log('[car-rental] price keys:', Object.keys(pr))
      console.log('[car-rental] sample offerHash candidates:',
        o.offerHash, '|', o.hash, '|', o.id, '|', o.key, '|', o.guid, '|', o.identifier, '|', o.bookingHash, '|', o.bookingId
      )
    }

    const cars = rawOffers.slice(0, 24).map(normalizeOffer)

    const response = {
      cars,
      sq: search.data.sq,        // used by frontend to build /offer/{hash}?sq=... links
      location: {
        name: loc.location, place: loc.place, city: loc.city, country: loc.country,
        placeID: loc.placeID,    // used by frontend for DC deep link fallback
      },
      isComplete: results?.data?.isComplete ?? true,
    }

    if (cars.length > 0) cSet(cacheKey, response)
    return res.json(response)

  } catch (err) {
    console.error('[car-rental] search error:', err.message || err)
    return res.json({ cars: [], error: 'server_error' })
  }
})

// ─── GET /api/car-rental/custom-destinations — DB-managed (admin) destinations ─
router.get('/custom-destinations', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT slug, name, country, country_slug, dc_path, dc_search_term, popular
       FROM car_destinations
       WHERE active = TRUE
       ORDER BY country ASC, name ASC`
    )
    return res.json(rows)
  } catch (err) {
    // Table may not exist yet — return empty gracefully
    return res.json([])
  }
})

// ─── GET /api/car-rental/enriched-destinations ───────────────────────────────
// Returns destinations derived from the hotels DB + DC autocomplete.
// Used by Next.js at build time to extend the static CAR_DESTINATIONS list.
const ENRICH_CACHE_TTL = 6 * 60 * 60 * 1000  // 6 h

// Map Czech country names (from DB) to English for DC autocomplete context
const CZ_TO_EN_COUNTRY = {
  'Řecko':       'Greece',
  'Turecko':     'Turkey',
  'Chorvatsko':  'Croatia',
  'Španělsko':   'Spain',
  'Kypr':        'Cyprus',
  'Portugalsko': 'Portugal',
  'Itálie':      'Italy',
  'Bulharsko':   'Bulgaria',
  'Albánie':     'Albania',
  'Tunisko':     'Tunisia',
  'Maroko':      'Morocco',
  'Egypt':       'Egypt',
  'Thajsko':     'Thailand',
  'Maledivy':    'Maldives',
  'Dominikánská republika': 'Dominican Republic',
  'Mexiko':      'Mexico',
  'Kuba':        'Cuba',
  'Spojené arabské emiráty': 'UAE',
}

router.get('/enriched-destinations', async (req, res) => {
  const cacheKey = 'enriched-destinations'
  const cached = cGet(cacheKey)
  if (cached) {
    res.set('X-Cache', 'HIT')
    return res.json(cached)
  }

  try {
    // 1. Pull distinct resort_towns with future departures from the DB
    const { rows } = await db.query(`
      SELECT DISTINCT
        h.country,
        COALESCE(h.resort_town, h.destination) AS resort_town,
        h.destination
      FROM hotels h
      INNER JOIN hotel_stats s ON s.hotel_id = h.id
      WHERE s.departure_date >= CURRENT_DATE
        AND (h.resort_town IS NOT NULL OR h.destination IS NOT NULL)
      ORDER BY h.country, resort_town
    `)

    if (!rows || rows.length === 0) return res.json([])

    // 2. For each row, run DC autocomplete (already 24h cached in getLocation)
    //    Process in small batches to avoid hammering DC
    const BATCH = 6
    const results = []

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const settled = await Promise.allSettled(
        batch.map(async row => {
          const czName = row.resort_town || row.destination
          const enCtx  = CZ_TO_EN_COUNTRY[row.country] || ''
          // Try "resort_town airport" first, then plain resort_town
          const loc = await getLocation(`${czName} airport`)
            || await getLocation(czName)
          if (!loc?.placeID) return null

          const slug = slugify(czName)
          const countrySlug = slugify(row.country)

          // Build a minimal dcPath from the DC response
          // loc.place = airport/city name in English
          const dcPlace = (loc.place || loc.location || czName)
            .toLowerCase()
            .replace(/\s*\(.*?\)/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')

          const dcCountry = enCtx.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          const dcPath = dcCountry ? `${dcCountry}/${dcPlace}` : dcPlace

          return {
            slug,
            name:         czName,
            country:      row.country,
            countrySlug,
            dcPath,
            dcSearchTerm: loc.place || czName,
            placeID:      loc.placeID,
            cityID:       loc.cityID,
            countryID:    loc.countryID,
            popular:      false,
            dynamic:      true,
          }
        })
      )
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value) results.push(r.value)
      }
    }

    cSet(cacheKey, results, ENRICH_CACHE_TTL)
    return res.json(results)
  } catch (err) {
    console.error('[car-rental] enriched-destinations error:', err.message || err)
    return res.json([])
  }
})

// ─── GET /api/car-rental/autocomplete?q=heraklion ────────────────────────────
router.get('/autocomplete', async (req, res) => {
  const { q } = req.query
  if (!q || q.length < 2) return res.json([])

  try {
    const url = `https://www.discovercars.com/en/search/autocomplete/${encodeURIComponent(q)}`
    const r = await fetch(url, { headers: DC_HEADERS, signal: AbortSignal.timeout(8_000) })
    if (!r.ok) return res.json([])
    const data = await r.json()
    return res.json(Array.isArray(data) ? data.slice(0, 8) : [])
  } catch (err) {
    console.error('[car-rental] autocomplete error:', err.message || err)
    return res.json([])
  }
})

module.exports = router
