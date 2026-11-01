import { query, withClient } from './db'
import { hotelsCache, hotelDetailCache } from './cache'
import { MEAL_SQL } from './mealPlan'

export type Q = Record<string, string | undefined>

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

let statsPopulated: boolean | null = null
let statsCheckedAt = 0

function shiftDate(ymd: string, days: number) {
  const d = new Date(ymd)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function destClause(destination: string, conds: string[], params: unknown[]) {
  const dests = destination.split(',').map(s => s.trim()).filter(Boolean)
  if (!dests.length) return
  const one = '(h.destination ILIKE ? OR h.resort_town ILIKE ? OR h.country ILIKE ?)'
  conds.push(dests.length === 1 ? one : `(${dests.map(() => one).join(' OR ')})`)
  for (const d of dests) params.push(`%${d}%`, `%${d}%`, `%${d}%`)
}

// GET /api/hotels
export async function listHotels(q: Q) {
  const { known_total, ...queryForKey } = q
  const cacheKey = JSON.stringify(Object.entries(queryForKey).sort())
  const cached = hotelsCache.get(cacheKey)
  if (cached) return cached

  const {
    destination, date_from, date_to, date_flex, duration, min_price, max_price,
    stars, meal_plan, transport, tour_type, departure_city,
    sort = 'price_asc', page = '1', limit = '24', view,
  } = q

  const pageNum = Math.max(1, parseInt(page) || 1)
  const limitNum = Math.min(96, Math.max(1, parseInt(limit) || 24))
  const knownTotal = known_total ? parseInt(known_total) : null
  const offset = (pageNum - 1) * limitNum
  const flexDays = date_flex === '0' ? 0 : 3

  const hasTourFilters = date_from || date_to || duration || meal_plan || transport || departure_city

  const extraFields = view === 'list'
    ? ', h.description, h.amenities, h.distances, h.food_options, h.price_includes'
    : ', h.food_options, h.amenities'

  const fastOrderMap: Record<string, string> = {
    price_asc: 'min_price ASC', price_desc: 'min_price DESC', date_asc: 's.next_departure ASC',
    stars_desc: 'h.stars DESC, min_price ASC', name_asc: 'h.name ASC',
  }
  const slowOrderMap: Record<string, string> = { ...fastOrderMap, date_asc: 'next_departure ASC' }
  const fastOrderBy = fastOrderMap[sort] || 'min_price ASC'
  const slowOrderBy = slowOrderMap[sort] || 'min_price ASC'

  let total = 0
  let hotels: any[] = []

  if (!hasTourFilters) {
    // FAST PATH: pouze hotel_stats
    if (statsPopulated === null || Date.now() - statsCheckedAt > 5 * 60 * 1000) {
      const r = await query('SELECT COUNT(*) AS n FROM hotel_stats')
      statsPopulated = parseInt(r.rows[0].n) > 0
      statsCheckedAt = Date.now()
    }

    const whereConds = ['s.min_price IS NOT NULL', 's.next_departure >= CURRENT_DATE::text', '(h.canonical_slug IS NULL OR h.canonical_slug = h.slug)']
    const params: unknown[] = []
    if (destination) destClause(destination, whereConds, params)
    if (stars) {
      const arr = stars.split(',').map(Number).filter(Boolean)
      if (arr.length) { whereConds.push(`h.stars IN (${arr.map(() => '?').join(',')})`); params.push(...arr) }
    }
    if (tour_type === 'last_minute') whereConds.push('s.has_last_minute = 1')
    if (tour_type === 'first_minute') whereConds.push('s.has_first_minute = 1')
    if (min_price) { whereConds.push('s.min_price >= ?'); params.push(parseFloat(min_price)) }
    if (max_price) { whereConds.push('s.min_price <= ?'); params.push(parseFloat(max_price)) }
    const where = `WHERE ${whereConds.join(' AND ')}`

    if (statsPopulated) {
      const fastSql = `
        SELECT h.id, h.slug, h.agency, h.name, h.country, h.destination, h.resort_town,
               h.stars, h.review_score, h.thumbnail_url, h.photos, h.latitude, h.longitude
               ${extraFields},
               s.min_price, s.available_dates, s.next_departure, s.next_return_date,
               s.has_last_minute, s.has_first_minute
        FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
        ${where} ORDER BY ${fastOrderBy} LIMIT ? OFFSET ?`
      if (knownTotal !== null && pageNum > 1) total = knownTotal
      else {
        const cr = await query(`SELECT COUNT(*) AS total FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id ${where}`, params)
        total = parseInt(cr.rows[0].total)
      }
      hotels = (await query(fastSql, [...params, limitNum, offset])).rows
    } else {
      // Fallback (hotel_stats prázdná): live subquery
      const coalesceWhere = whereConds.map(c =>
        c.replace(/\bs\.min_price\b/g, 'COALESCE(s.min_price, sub.min_price)')
          .replace(/\bs\.has_last_minute\b/g, 'COALESCE(s.has_last_minute, sub.has_last_minute)')
          .replace(/\bs\.has_first_minute\b/g, 'COALESCE(s.has_first_minute, sub.has_first_minute)')
          .replace(/s\.next_departure >= CURRENT_DATE::text/, '(COALESCE(s.next_departure, sub.next_departure) >= CURRENT_DATE::text)')
          .replace(/s\.min_price IS NOT NULL/, '(s.min_price IS NOT NULL OR sub.min_price IS NOT NULL)'),
      ).join(' AND ')
      const liveSub = `(
        SELECT hotel_id, MIN(price) AS min_price, COUNT(*)::integer AS available_dates, MIN(departure_date) AS next_departure,
               MAX(COALESCE(is_last_minute, 0)) AS has_last_minute, MAX(COALESCE(is_first_minute, 0)) AS has_first_minute
        FROM tours WHERE price > 0 AND departure_date >= CURRENT_DATE::text GROUP BY hotel_id
      ) sub`
      const fallbackSql = `
        SELECT h.id, h.slug, h.agency, h.name, h.country, h.destination, h.resort_town,
               h.stars, h.review_score, h.thumbnail_url, h.photos, h.latitude, h.longitude
               ${extraFields},
               COALESCE(s.min_price, sub.min_price) AS min_price,
               COALESCE(s.available_dates, sub.available_dates) AS available_dates,
               COALESCE(s.next_departure, sub.next_departure) AS next_departure,
               s.next_return_date AS next_return_date,
               COALESCE(s.has_last_minute, sub.has_last_minute) AS has_last_minute,
               COALESCE(s.has_first_minute, sub.has_first_minute) AS has_first_minute
        FROM hotels h LEFT JOIN hotel_stats s ON s.hotel_id = h.id LEFT JOIN ${liveSub} ON sub.hotel_id = h.id
        WHERE ${coalesceWhere} ORDER BY ${fastOrderBy} LIMIT ? OFFSET ?`
      if (knownTotal !== null && pageNum > 1) total = knownTotal
      else {
        const cr = await query(`SELECT COUNT(*) AS total FROM hotels h LEFT JOIN hotel_stats s ON s.hotel_id = h.id LEFT JOIN ${liveSub} ON sub.hotel_id = h.id WHERE ${coalesceWhere}`, params)
        total = parseInt(cr.rows[0].total)
      }
      hotels = (await query(fallbackSql, [...params, limitNum, offset])).rows
    }
  } else {
    // SLOW PATH: GROUP BY přes tours
    const tourConds = ['t.price > 0']
    const tourParams: unknown[] = []
    const bothDates = !!(date_from && date_to)
    if (date_from) {
      if (bothDates && flexDays > 0) {
        tourConds.push('t.departure_date >= ? AND t.departure_date <= ?')
        tourParams.push(shiftDate(date_from, -flexDays), shiftDate(date_from, flexDays))
      } else if (bothDates) {
        tourConds.push('t.departure_date = ?'); tourParams.push(date_from)
      } else {
        tourConds.push('t.departure_date >= ?'); tourParams.push(date_from)
      }
    } else {
      tourConds.push('t.departure_date >= CURRENT_DATE::text')
    }

    const hotelConds = ['(h.canonical_slug IS NULL OR h.canonical_slug = h.slug)']
    const mainParams: unknown[] = []
    if (destination) destClause(destination, hotelConds, mainParams)
    if (stars) {
      const arr = stars.split(',').map(Number).filter(Boolean)
      if (arr.length) { hotelConds.push(`h.stars IN (${arr.map(() => '?').join(',')})`); mainParams.push(...arr) }
    }

    if (date_to) {
      if (bothDates && flexDays > 0) {
        tourConds.push('t.return_date >= ? AND t.return_date <= ?')
        tourParams.push(shiftDate(date_to, -flexDays), shiftDate(date_to, flexDays))
      } else if (bothDates) {
        tourConds.push('t.return_date = ?'); tourParams.push(date_to)
      } else {
        tourConds.push('t.return_date <= ?'); tourParams.push(date_to)
      }
    }
    if (duration) {
      const arr = duration.split(',').map(Number).filter(Boolean)
      if (arr.length) { tourConds.push(`t.duration IN (${arr.map(() => '?').join(',')})`); tourParams.push(...arr) }
    }
    if (meal_plan) {
      const arr = meal_plan.split(',').filter(Boolean)
      if (arr.length) {
        const parts = arr.map(mp => MEAL_SQL[mp]).filter(Boolean)
        if (parts.length) tourConds.push(`(${parts.join(' OR ')})`)
        else { tourConds.push(`t.meal_plan IN (${arr.map(() => '?').join(',')})`); tourParams.push(...arr) }
      }
    }
    if (transport) { tourConds.push('t.transport ILIKE ?'); tourParams.push(`${transport}%`) }
    if (departure_city) {
      const cities = departure_city.split(',').filter(Boolean)
      if (cities.length === 1) { tourConds.push('t.departure_city = ?'); tourParams.push(cities[0]) }
      else if (cities.length > 1) { tourConds.push(`t.departure_city IN (${cities.map(() => '?').join(',')})`); tourParams.push(...cities) }
    }
    if (tour_type === 'last_minute') tourConds.push('t.is_last_minute = 1')
    if (tour_type === 'first_minute') tourConds.push('t.is_first_minute = 1')

    const havingConds: string[] = []
    const havingParams: unknown[] = []
    if (min_price) { havingConds.push('MIN(t.price) >= ?'); havingParams.push(parseFloat(min_price)) }
    if (max_price) { havingConds.push('MIN(t.price) <= ?'); havingParams.push(parseFloat(max_price)) }

    const hotelWhereClause = hotelConds.length ? `AND ${hotelConds.join(' AND ')}` : ''
    const having = havingConds.length ? `HAVING ${havingConds.join(' AND ')}` : ''
    const cteParams = [...tourParams, ...havingParams]
    const dataParams = [...cteParams, ...mainParams, limitNum, offset]

    const cteCore = `
      WITH agg AS MATERIALIZED (
        SELECT COALESCE(h2.canonical_slug, h2.slug) AS cslug,
               MIN(t.price) AS min_price, COUNT(*)::integer AS available_dates,
               MIN(t.departure_date) AS next_departure, MIN(t.return_date) AS next_return_date,
               MAX(t.is_last_minute) AS has_last_minute, MAX(t.is_first_minute) AS has_first_minute
        FROM tours t INNER JOIN hotels h2 ON h2.id = t.hotel_id
        WHERE ${tourConds.join(' AND ')}
        GROUP BY COALESCE(h2.canonical_slug, h2.slug)
        ${having}
      )`
    const hotelCols = `
      h.id, h.slug, h.agency, h.name, h.country, h.destination, h.resort_town,
      h.stars, h.review_score, h.thumbnail_url, h.photos, h.latitude, h.longitude
      ${extraFields},
      agg.min_price, agg.available_dates, agg.next_departure, agg.next_return_date,
      agg.has_last_minute, agg.has_first_minute`
    const fromJoin = `FROM hotels h INNER JOIN agg ON agg.cslug = h.slug WHERE 1=1 ${hotelWhereClause}`

    if (knownTotal !== null && pageNum > 1) {
      total = knownTotal
      hotels = (await query(`${cteCore} SELECT ${hotelCols} ${fromJoin} ORDER BY ${slowOrderBy} LIMIT ? OFFSET ?`, dataParams)).rows
    } else {
      const hr = await query(`${cteCore} SELECT ${hotelCols}, COUNT(*) OVER() AS _total ${fromJoin} ORDER BY ${slowOrderBy} LIMIT ? OFFSET ?`, dataParams)
      total = parseInt(hr.rows[0]?._total ?? 0)
      hotels = hr.rows.map(({ _total, ...h }) => h)
    }
  }

  const result = {
    hotels,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum), hasMore: offset + hotels.length < total },
  }
  if (hotels.length > 0) hotelsCache.set(cacheKey, result)
  return result
}

// GET /api/hotels/geo
export async function hotelsGeo(q: Q) {
  const { sw_lat, sw_lng, ne_lat, ne_lng } = q
  if (!sw_lat || !sw_lng || !ne_lat || !ne_lng) throw new HttpError(400, 'sw_lat, sw_lng, ne_lat, ne_lng required')
  const key = `geo_${sw_lat}_${sw_lng}_${ne_lat}_${ne_lng}`
  const cached = hotelsCache.get(key)
  if (cached) return cached
  const r = await query(`
    SELECT h.id, h.slug, h.name, h.stars, h.thumbnail_url, h.latitude, h.longitude, s.min_price, s.next_departure
    FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
    WHERE h.latitude BETWEEN ? AND ? AND h.longitude BETWEEN ? AND ? AND s.min_price IS NOT NULL
    LIMIT 200`, [parseFloat(sw_lat), parseFloat(ne_lat), parseFloat(sw_lng), parseFloat(ne_lng)])
  hotelsCache.set(key, r.rows)
  return r.rows
}

// GET /api/hotels/nearby
export async function nearbyHotels(q: Q) {
  const { lat, lon, exclude, limit = '12' } = q
  if (!exclude) throw new HttpError(400, 'exclude required')
  const key = `nearby_${exclude}_${limit}`
  const cached = hotelDetailCache.get(key)
  if (cached) return cached

  const limitNum = Math.min(30, Math.max(1, parseInt(limit) || 12))
  const latF = parseFloat(lat ?? '')
  const lonF = parseFloat(lon ?? '')
  let rows: any[]
  if (!isNaN(latF) && !isNaN(lonF)) {
    rows = (await query(`
      SELECT h.slug, h.name, h.stars, h.thumbnail_url, h.latitude, h.longitude,
             h.destination, h.country, h.agency, h.review_score, s.min_price, s.next_departure,
             ROUND(CAST(SQRT(POWER((h.latitude - $1) * 111.32, 2) + POWER((h.longitude - $2) * 71.5, 2)) AS numeric), 1) AS distance_km
      FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
      WHERE h.slug != $3 AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
        AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL
      ORDER BY distance_km ASC LIMIT $4`, [latF, lonF, exclude, limitNum])).rows
  } else {
    const hr = await query('SELECT destination FROM hotels WHERE slug = $1', [exclude])
    const destination = hr.rows[0]?.destination
    if (!destination) return []
    rows = (await query(`
      SELECT h.slug, h.name, h.stars, h.thumbnail_url, h.latitude, h.longitude,
             h.destination, h.country, h.agency, h.review_score, s.min_price, s.next_departure
      FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
      WHERE h.slug != $1 AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text AND h.destination = $2
      ORDER BY s.min_price ASC LIMIT $3`, [exclude, destination, limitNum])).rows
  }
  hotelDetailCache.set(key, rows)
  return rows
}

// GET /api/hotels/slugs
export async function hotelSlugs(q: Q) {
  const limitNum = q.limit ? Math.min(500, parseInt(q.limit) || 0) : null
  const key = limitNum ? `slugs_top_${limitNum}` : 'slugs'
  const cached = hotelDetailCache.get(key)
  if (cached) return cached
  const r = await query(`
    SELECT h.slug, h.updated_at FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
    WHERE s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
    ORDER BY s.min_price ASC ${limitNum ? `LIMIT ${limitNum}` : ''}`)
  hotelDetailCache.set(key, r.rows)
  return r.rows
}

// GET /api/hotels/search
export async function searchHotels(q: Q) {
  const { q: term0, limit = '10' } = q
  if (!term0 || term0.trim().length < 2) return []
  const key = `search_${term0}_${limit}`
  const cached = hotelsCache.get(key)
  if (cached) return cached
  const term = `%${term0.trim()}%`
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10))
  const r = await query(`
    SELECT h.id, h.slug, h.name, h.destination, h.country, h.resort_town, h.stars, h.thumbnail_url, s.min_price
    FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
    WHERE (h.name ILIKE ? OR h.destination ILIKE ? OR h.resort_town ILIKE ?)
      AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
    ORDER BY s.min_price ASC LIMIT ?`, [term, term, term, limitNum])
  hotelsCache.set(key, r.rows)
  return r.rows
}

// GET /api/hotels/:slug/reviews
export async function hotelReviews(slug: string) {
  const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY
  const hotel = (await query('SELECT id, name, place_id, reviews_fetched_at FROM hotels WHERE slug = ?', [slug])).rows[0]
  if (!hotel) throw new HttpError(404, 'Hotel not found')

  if (hotel.reviews_fetched_at) {
    const age = (Date.now() - new Date(hotel.reviews_fetched_at).getTime()) / 86400000
    if (age < 30) {
      const rr = await query('SELECT * FROM reviews WHERE hotel_id = ? ORDER BY rating DESC', [hotel.id])
      if (rr.rows.length > 0) return { reviews: rr.rows, source: 'cache' }
    }
  }
  if (!GOOGLE_API_KEY) return { reviews: [], source: 'none' }

  let placeId: string | undefined = hotel.place_id
  if (!placeId) {
    const sr = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName' },
      body: JSON.stringify({ textQuery: `hotel ${hotel.name}` }),
    })
    if (!sr.ok) return { reviews: [], source: 'none' }
    placeId = (await sr.json()).places?.[0]?.id
    if (!placeId) return { reviews: [], source: 'none' }
  }

  const dr = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews' },
  })
  if (!dr.ok) return { reviews: [], source: 'none' }
  const detail = await dr.json()

  const newReviews = (detail.reviews || []).map((r: any) => ({
    author_name: r.authorAttribution?.displayName || 'Anonymní',
    author_photo: r.authorAttribution?.photoUri || null,
    rating: r.rating,
    text: r.text?.text || '',
    review_date: r.publishTime ? r.publishTime.split('T')[0] : null,
    language: r.originalText?.languageCode || r.text?.languageCode || null,
  }))

  await withClient(async client => {
    await client.query('BEGIN')
    try {
      await client.query('DELETE FROM reviews WHERE hotel_id = $1', [hotel.id])
      for (const r of newReviews) {
        await client.query(
          `INSERT INTO reviews (hotel_id, source, author_name, author_photo, rating, text, review_date, language)
           VALUES ($1, 'google', $2, $3, $4, $5, $6, $7)`,
          [hotel.id, r.author_name, r.author_photo, r.rating, r.text, r.review_date, r.language],
        )
      }
      await client.query('UPDATE hotels SET place_id = $1, reviews_fetched_at = NOW() WHERE id = $2', [placeId, hotel.id])
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    }
  })

  const saved = await query('SELECT * FROM reviews WHERE hotel_id = ? ORDER BY rating DESC', [hotel.id])
  return { reviews: saved.rows, overall_rating: detail.rating || null, total_ratings: detail.userRatingCount || null, source: 'google' }
}

// GET /api/hotels/:slug
export async function hotelDetail(slug: string) {
  const cached = hotelDetailCache.get(`hotel_${slug}`)
  if (cached) return cached

  const hotel = (await query('SELECT * FROM hotels WHERE slug = ?', [slug])).rows[0]
  if (!hotel) throw new HttpError(404, 'Hotel not found')

  const canonicalSlug: string | null = hotel.canonical_slug || null
  let statsR, descRows: any[]
  if (canonicalSlug) {
    ;[statsR, { rows: descRows }] = await Promise.all([
      query(`
        SELECT MIN(t.price) AS min_price, MAX(t.price) AS max_price, COUNT(*)::integer AS available_dates,
               MIN(t.departure_date) AS next_departure, MAX(t.updated_at) AS tours_updated_at
        FROM tours t JOIN hotels h ON h.id = t.hotel_id
        WHERE h.canonical_slug = ? AND t.price > 0 AND t.departure_date >= CURRENT_DATE::text`, [canonicalSlug]),
      query(`SELECT DISTINCT ON (agency) agency, description FROM hotels
             WHERE canonical_slug = ? AND description IS NOT NULL ORDER BY agency, length(description) DESC`, [canonicalSlug]),
    ])
  } else {
    statsR = await query(`
      SELECT MIN(price) AS min_price, MAX(price) AS max_price, COUNT(*)::integer AS available_dates,
             MIN(departure_date) AS next_departure, MAX(updated_at) AS tours_updated_at
      FROM tours WHERE hotel_id = ? AND price > 0 AND departure_date >= CURRENT_DATE::text`, [hotel.id])
    descRows = hotel.description ? [{ agency: hotel.agency, description: hotel.description }] : []
  }
  let stats = statsR.rows[0]

  if (!stats?.available_dates) {
    const fbId = canonicalSlug
      ? (await query('SELECT id FROM hotels WHERE slug = ?', [canonicalSlug])).rows[0]?.id ?? hotel.id
      : hotel.id
    const fb = await query('SELECT min_price, available_dates, next_departure, next_return_date FROM hotel_stats WHERE hotel_id = ?', [fbId])
    if (fb.rows[0]?.available_dates) stats = { ...stats, ...fb.rows[0] }
  }

  const fischer = descRows.find(r => r.agency === 'Fischer')
  const description = fischer?.description ?? hotel.description
  const result = { ...hotel, description, agencyDescriptions: descRows, ...stats }
  if (stats?.available_dates > 0) hotelDetailCache.set(`hotel_${slug}`, result)
  return result
}

export async function resetStats() {
  const r = await query('SELECT COUNT(*) AS n FROM hotel_stats')
  statsPopulated = parseInt(r.rows[0].n) > 0
}

// GET /api/hotels/map: všechny hotely destinace se souřadnicemi (bez stránkování, jen pole pro mapu)
export async function hotelsMap(q: Q) {
  const destination = q.destination
  if (!destination) throw new HttpError(400, 'destination required')
  const key = `map_${destination}`
  const cached = hotelsCache.get(key)
  if (cached) return cached
  const conds: string[] = ['h.latitude IS NOT NULL', 'h.longitude IS NOT NULL', 's.min_price IS NOT NULL']
  const params: unknown[] = []
  destClause(destination, conds, params)
  const r = await query(`
    SELECT h.slug, h.name, h.stars, h.resort_town, h.thumbnail_url, h.latitude, h.longitude, s.min_price
    FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
    WHERE ${conds.join(' AND ')}
    ORDER BY s.min_price ASC`, params)
  const out = { hotels: r.rows }
  hotelsCache.set(key, out)
  return out
}
