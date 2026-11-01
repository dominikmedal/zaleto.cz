import { query } from './db'
import { ensureAutomationSchema } from './automationDb'
import { searchUnsplash, registerDownload } from './unsplash'
import { metaCache } from './cache'
import { HttpError, type Q } from './hotels'

// ─── Články ────────────────────────────────────────────────────────────────

/** Soubory z /uploads/ zůstaly na Railway volume – bez nich použijeme fotku destinace. */
function fixUpload<T extends { custom_image_url?: string | null }>(a: T): T {
  return a.custom_image_url?.startsWith('/uploads/') ? { ...a, custom_image_url: null } : a
}

const ARTICLE_LIST_COLS = 'id, slug, title, category, location, excerpt, reading_time, published_at, custom_image_url, custom_image_credit, custom_image_credit_url'

export async function listArticles(q: Q) {
  const limit = Math.min(parseInt(q.limit ?? '') || 9, 50)
  const offset = Math.min(parseInt(q.offset ?? '') || 0, 500)
  const location = q.location?.trim() || null
  const key = `articles_${limit}_${offset}_${location ?? ''}`
  const cached = metaCache.get(key)
  if (cached) return cached
  try {
    await ensureAutomationSchema()
    const r = location
      ? await query(`SELECT ${ARTICLE_LIST_COLS} FROM articles WHERE status = 'published' AND LOWER(location) = LOWER(?) ORDER BY published_at DESC LIMIT ? OFFSET ?`, [location, limit, offset])
      : await query(`SELECT ${ARTICLE_LIST_COLS} FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?`, [limit, offset])
    const rows = r.rows.map(fixUpload)
    metaCache.set(key, rows)
    return rows
  } catch (e) {
    console.error('[articles] list error:', (e as Error).message)
    return []
  }
}

export async function getArticle(slug: string) {
  const key = `article_${slug}`
  const cached = metaCache.get(key)
  if (cached) return cached
  await ensureAutomationSchema()
  const r = await query(`SELECT * FROM articles WHERE slug = ? AND status = 'published'`, [slug])
  if (!r.rows[0]) throw new HttpError(404, 'Not found')
  const row = fixUpload(r.rows[0])
  metaCache.set(key, row)
  return row
}

export async function articleSlugs() {
  const cached = metaCache.get('article_slugs')
  if (cached) return cached
  await ensureAutomationSchema()
  const r = await query(`SELECT slug, published_at FROM articles WHERE status = 'published' ORDER BY published_at DESC`)
  metaCache.set('article_slugs', r.rows)
  return r.rows
}

// ─── Fotky destinací (Pexels) ──────────────────────────────────────────────

const DEST_EN: Record<string, string> = {
  'Egypt': 'Egypt beach Red Sea', 'Řecko': 'Greece travel island', 'Turecko': 'Turkey beach resort',
  'Španělsko': 'Spain travel beach', 'Thajsko': 'Thailand beach tropical', 'Maldivky': 'Maldives beach overwater',
  'Dubaj': 'Dubai skyline luxury', 'Chorvatsko': 'Croatia coast Adriatic', 'Tunisko': 'Tunisia beach Mediterranean',
  'Itálie': 'Italy travel coast', 'Kypr': 'Cyprus beach Mediterranean', 'Portugalsko': 'Portugal travel coast',
  'Bulharsko': 'Bulgaria Black Sea beach', 'Maroko': 'Morocco travel medina', 'Mexiko': 'Mexico beach Caribbean',
  'Malta': 'Malta island Mediterranean', 'Dominikánská republika': 'Dominican Republic beach Caribbean',
  'Francie': 'France travel Riviera', 'Gran Canaria': 'Gran Canaria beach Canary Islands',
  'Tenerife': 'Tenerife beach Canary Islands', 'Kréta': 'Crete Greece beach',
  'Rhodos': 'Rhodes Greece island', 'Korfu': 'Corfu Greece island', 'Zakynthos': 'Zakynthos Greece Navagio',
  'Hurghada': 'Hurghada Red Sea beach', 'Sharm el Sheikh': 'Sharm el Sheikh Red Sea',
  'Antalya': 'Antalya Turkey beach resort', 'Bodrum': 'Bodrum Turkey coast',
  'Side': 'Side Turkey beach ancient', 'Alanya': 'Alanya Turkey beach castle',
  'Spojené arabské emiráty': 'UAE Abu Dhabi beach', 'Srí Lanka': 'Sri Lanka beach tropical',
  'Bali': 'Bali Indonesia beach temple', 'Vietnam': 'Vietnam beach Ha Long',
  'Kefalonie': 'Kefalonia Greece beach', 'Santorini': 'Santorini Greece sunset',
  'Mykonos': 'Mykonos Greece beach', 'Lefkada': 'Lefkada Greece beach',
  'Halkidiki': 'Halkidiki Greece beach', 'Kos': 'Kos Greece beach island',
  'Lanzarote': 'Lanzarote Canary Islands', 'Fuerteventura': 'Fuerteventura beach Canary',
  'Mallorca': 'Mallorca Spain beach', 'Ibiza': 'Ibiza Spain beach',
  'Kapverdské ostrovy': 'Cape Verde beach island', 'Zanzibar': 'Zanzibar Tanzania beach',
  'Mauricius': 'Mauritius beach island', 'Seychely': 'Seychelles beach paradise',
}
const STALE_DAYS = 3650 // původní fotky se nepřepisují

async function pexelsPhoto(term: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  try {
    const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(term)}&per_page=3&orientation=landscape`, { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const data = await r.json()
    return data.photos?.[0]?.src?.large2x ?? data.photos?.[0]?.src?.large ?? null
  } catch { return null }
}

/** Fotka hotelu z dané destinace (data z CK) – záloha pro místa bez původní fotky. */
async function hotelPhoto(name: string): Promise<string | null> {
  try {
    const r = await query(
      `SELECT h.thumbnail_url FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id
       WHERE h.thumbnail_url IS NOT NULL AND s.min_price IS NOT NULL
         AND (h.country = ? OR h.resort_town = ? OR h.destination ILIKE ?)
       ORDER BY h.review_score DESC NULLS LAST, h.stars DESC NULLS LAST LIMIT 1`,
      [name, name, `%${name}%`],
    )
    return r.rows[0]?.thumbnail_url ?? null
  } catch { return null }
}

const missingUntil = new Map<string, number>()
const creditCache = new Map<string, { credit: string; creditUrl: string | null }>()

/** Pořadí: uložená původní fotka → Pexels (je-li klíč) → fotka hotelu z destinace. */
export async function destinationPhoto(name: string): Promise<{ url: string | null; credit?: string | null; creditUrl?: string | null }> {
  const key = `photo_${name}`
  const cached = metaCache.get(key)
  if (cached !== null && cached !== undefined) return { url: cached as string, ...(creditCache.get(name) ?? {}) }
  if ((missingUntil.get(name) ?? 0) > Date.now()) return { url: null }
  try {
    const row = (await query('SELECT photo_url, photo_credit, photo_credit_url FROM destination_photos WHERE name = ?', [name])).rows[0]
    const usable = row?.photo_url && !String(row.photo_url).startsWith('/uploads/') && !/wikimedia\.org/.test(row.photo_url)
    if (usable) {
      metaCache.set(key, row.photo_url)
      if (row.photo_credit) creditCache.set(name, { credit: row.photo_credit, creditUrl: row.photo_credit_url })
      return { url: row.photo_url, credit: row.photo_credit ?? null, creditUrl: row.photo_credit_url ?? null }
    }
    const fromPexels = await pexelsPhoto(DEST_EN[name] ?? `${name} travel beach`)
    if (fromPexels) {
      await query(
        `INSERT INTO destination_photos (name, photo_url, updated_at) VALUES (?, ?, NOW())
         ON CONFLICT (name) DO UPDATE SET photo_url = EXCLUDED.photo_url, updated_at = EXCLUDED.updated_at`,
        [name, fromPexels],
      )
      metaCache.set(key, fromPexels)
      return { url: fromPexels }
    }
    const fromHotel = await hotelPhoto(name)
    if (fromHotel) { metaCache.set(key, fromHotel); return { url: fromHotel } }
    missingUntil.set(name, Date.now() + 10 * 60_000)
    return { url: null }
  } catch (e) {
    console.error('destination-photo error:', (e as Error).message)
    return { url: null }
  }
}

// ─── AI obsah destinací (čtení) ────────────────────────────────────────────

const EMPTY_DEST_AI = { description: null, excursions: [], best_time: null, places: [], food: [], trips: [] }

const parseJson = (s: string | null | undefined) => { try { return JSON.parse(s || '[]') } catch { return [] } }

export async function destinationAI(name: string) {
  const key = `ai_${name}`
  const cached = metaCache.get(key)
  if (cached) return cached
  try {
    const row = (await query('SELECT description, excursions, best_time, places, food, trips FROM destination_ai WHERE name = ?', [name])).rows[0]
    if (!row) return EMPTY_DEST_AI
    const result = {
      description: row.description,
      excursions: parseJson(row.excursions),
      best_time: row.best_time || null,
      places: parseJson(row.places),
      food: parseJson(row.food),
      trips: parseJson(row.trips),
    }
    metaCache.set(key, result)
    return result
  } catch (e) {
    console.error('destination-ai error:', (e as Error).message)
    return EMPTY_DEST_AI
  }
}

// ─── Počasí (čtení) ────────────────────────────────────────────────────────

const EMPTY_WEATHER = {
  description: null, monthly_air: null, monthly_sea: null, monthly_rain_days: null, monthly_sun_hours: null,
  best_months: [], winter: null, spring: null, summer: null, autumn: null, wind_info: null, sea_info: null,
}
const parseOrNull = (s: string | null | undefined) => { if (!s) return null; try { return JSON.parse(s) } catch { return null } }

export async function weatherAI(name: string) {
  const key = `weather_ai_${name}`
  const cached = metaCache.get(key)
  if (cached) return cached
  try {
    const row = (await query(
      `SELECT description, monthly_air, monthly_sea, monthly_rain_days, monthly_sun_hours,
              best_months, winter, spring, summer, autumn, wind_info, sea_info
       FROM weather_ai WHERE name = ?`, [name])).rows[0]
    if (!row) return EMPTY_WEATHER
    const result = {
      description: row.description,
      monthly_air: parseOrNull(row.monthly_air),
      monthly_sea: parseOrNull(row.monthly_sea),
      monthly_rain_days: parseOrNull(row.monthly_rain_days),
      monthly_sun_hours: parseOrNull(row.monthly_sun_hours),
      best_months: parseOrNull(row.best_months) ?? [],
      winter: row.winter, spring: row.spring, summer: row.summer, autumn: row.autumn,
      wind_info: row.wind_info, sea_info: row.sea_info,
    }
    metaCache.set(key, result)
    return result
  } catch (e) {
    console.error('weather-ai error:', (e as Error).message)
    return EMPTY_WEATHER
  }
}

export async function weatherLocation(name: string) {
  try {
    const row = (await query(
      `SELECT ROUND(AVG(latitude)::numeric, 4) AS lat, ROUND(AVG(longitude)::numeric, 4) AS lon
       FROM hotels WHERE (country = ? OR destination ILIKE ? OR resort_town = ?)
         AND latitude IS NOT NULL AND longitude IS NOT NULL`, [name, `%${name}%`, name])).rows[0]
    if (row?.lat && row?.lon) return { lat: parseFloat(row.lat), lon: parseFloat(row.lon) }
  } catch { /* ignore */ }
  return { lat: null, lon: null }
}

// ─── Půjčovna aut – AI obsah (čtení) ───────────────────────────────────────

const EMPTY_CAR_AI = {
  name: null, country: null, intro: null, fuel_info: null, driving_rules: null, price_overview: null,
  best_car_types: null, trip_tips: [], faq: [], practical_tips: [], car_examples: [], airport_info: null, monthly_prices: null,
}

export async function carRentalAI(slug: string) {
  const key = `car_rental_ai_${slug}`
  const cached = metaCache.get(key)
  if (cached) return cached
  try {
    const row = (await query(
      `SELECT name, country, intro, fuel_info, driving_rules, price_overview, best_car_types,
              trip_tips, faq, practical_tips, car_examples, airport_info, monthly_prices
       FROM car_rental_ai WHERE slug = ?`, [slug])).rows[0]
    if (!row) return EMPTY_CAR_AI
    const result = {
      name: row.name, country: row.country, intro: row.intro, fuel_info: row.fuel_info,
      driving_rules: row.driving_rules, price_overview: row.price_overview, best_car_types: row.best_car_types,
      trip_tips: parseOrNull(row.trip_tips) ?? [],
      faq: parseOrNull(row.faq) ?? [],
      practical_tips: parseOrNull(row.practical_tips) ?? [],
      car_examples: parseOrNull(row.car_examples) ?? [],
      airport_info: parseOrNull(row.airport_info),
      monthly_prices: parseOrNull(row.monthly_prices),
    }
    metaCache.set(key, result)
    return result
  } catch (e) {
    console.error('[car-rental-ai] error:', (e as Error).message)
    return EMPTY_CAR_AI
  }
}

// ─── Fotky nejlepších hotelů podle země (okénka destinací) ───────────────

/**
 * Pro každou zemi vrátí fotku nejlépe hodnoceného hotelu s aktuálním termínem
 * (nejdřív hodnocení hostů, pak hvězdičky, pak cena).
 */
export async function bestHotelPhotos(countries: string[]): Promise<Record<string, string>> {
  if (countries.length === 0) return {}
  const key = `best_hotel_photos_${countries.join('|')}`
  const cached = metaCache.get(key) as Record<string, string> | null
  if (cached) return cached
  try {
    const r = await query(
      `SELECT DISTINCT ON (h.country) h.country, h.thumbnail_url
       FROM hotels h JOIN hotel_stats s ON s.hotel_id = h.id
       WHERE h.country = ANY($1) AND h.thumbnail_url IS NOT NULL
         AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
         AND (h.canonical_slug IS NULL OR h.canonical_slug = h.slug)
       ORDER BY h.country, h.review_score DESC NULLS LAST, h.stars DESC NULLS LAST, s.min_price ASC`,
      [countries],
    )
    const out: Record<string, string> = {}
    for (const row of r.rows) out[row.country] = row.thumbnail_url
    metaCache.set(key, out)
    return out
  } catch (e) {
    console.error('bestHotelPhotos error:', (e as Error).message)
    return {}
  }
}

// ─── Galerie fotek destinace (Unsplash) ─────────────────────────────────────

export interface GalleryPhoto { url: string; credit: string; creditUrl: string; alt: string | null }

let galleryReady: Promise<void> | null = null
const galleryRetryAt = new Map<string, number>()

/**
 * Několik fotek destinace z Unsplash. Při prvním zobrazení se vyhledají, uloží do databáze (vč. autorů)
 * a pak se už Unsplash nevolá (klíč v demo režimu má limit 50 dotazů za hodinu). Fotky se hotlinkují z CDN Unsplash,
 * u každého je autor a odkaz; použití se hlásí přes download_location, jak vyžadují pravidla API.
 */
export async function destinationGallery(name: string, country?: string | null, exclude: (string | null | undefined)[] = [], count = 6): Promise<GalleryPhoto[]> {
  const key = `gallery_${name}`
  const cached = metaCache.get(key)
  if (cached) return cached as GalleryPhoto[]
  if (!process.env.UNSPLASH_ACCESS_KEY) return []
  try {
    galleryReady ??= query(`CREATE TABLE IF NOT EXISTS destination_gallery (
      name TEXT PRIMARY KEY, photos JSONB NOT NULL DEFAULT '[]', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).then(() => undefined)
    await galleryReady
    const row = (await query<{ photos: GalleryPhoto[] }>('SELECT photos FROM destination_gallery WHERE name = ?', [name])).rows[0]
    if (row) { metaCache.set(key, row.photos); return row.photos }
    if ((galleryRetryAt.get(name) ?? 0) > Date.now()) return []

    const base = DEST_EN[name] ?? (country && country !== name ? `${name} ${country}` : name)
    const skip = new Set(exclude.filter((u): u is string => !!u).map(u => u.split('?')[0]))
    const seen = new Set<string>()
    const picked: (GalleryPhoto & { download: string })[] = []
    for (const q of [`${base} travel`, base]) {
      for (const h of await searchUnsplash(q)) {
        const id = h.url.split('?')[0]
        if (picked.length >= count) break
        if (h.width < 2000 || h.width / h.height < 1.2 || skip.has(id) || seen.has(id)) continue
        seen.add(id)
        picked.push({ url: h.url, credit: h.credit, creditUrl: h.creditUrl, alt: h.alt, download: h.downloadLocation })
      }
      if (picked.length >= count) break
    }
    if (picked.length < 3) { galleryRetryAt.set(name, Date.now() + 30 * 60_000); return [] } // příliš málo vhodných fotek: zkusíme později
    await Promise.all(picked.map(p => registerDownload(p.download)))
    const photos: GalleryPhoto[] = picked.map(({ download: _d, ...p }) => p)
    await query(`INSERT INTO destination_gallery (name, photos) VALUES (?, ?) ON CONFLICT (name) DO NOTHING`, [name, JSON.stringify(photos)])
    metaCache.set(key, photos)
    return photos
  } catch (e) {
    console.error('destination-gallery error:', (e as Error).message)
    galleryRetryAt.set(name, Date.now() + 10 * 60_000) // např. vyčerpaný limit Unsplash
    return []
  }
}
