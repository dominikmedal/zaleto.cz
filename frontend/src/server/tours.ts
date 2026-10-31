import { query } from './db'
import { toursCache, metaCache } from './cache'
import { normalizeMealPlan, MEAL_ORDER } from './mealPlan'
import { HttpError, type Q } from './hotels'

// GET /api/hotels/:slug/tours
export async function hotelTours(slug: string, q: Q) {
  const { date_from, date_to, duration, meal_plan, departure_city, sort = 'date_asc', limit, offset } = q
  const cacheKey = `${slug}_${JSON.stringify(Object.entries(q).sort())}`
  const cached = toursCache.get(cacheKey)
  if (cached) return cached

  const hotel = (await query('SELECT id, canonical_slug FROM hotels WHERE slug = ?', [slug])).rows[0]
  if (!hotel) throw new HttpError(404, 'Hotel not found')

  let hotelIds: number[]
  if (hotel.canonical_slug) {
    hotelIds = (await query('SELECT id FROM hotels WHERE canonical_slug = ?', [hotel.canonical_slug])).rows.map(r => r.id)
  } else hotelIds = [hotel.id]
  if (hotelIds.length === 0) return { tours: [], total: 0 }

  const conds = [`hotel_id IN (${hotelIds.map(() => '?').join(',')})`, 'departure_date >= CURRENT_DATE::text', 'price > 0']
  const params: unknown[] = [...hotelIds]
  if (date_from) { conds.push('departure_date >= ?'); params.push(date_from) }
  if (date_to) { conds.push('departure_date <= ?'); params.push(date_to) }
  if (duration) {
    const arr = duration.split(',').map(Number).filter(Boolean)
    if (arr.length) { conds.push(`duration IN (${arr.map(() => '?').join(',')})`); params.push(...arr) }
  }
  if (meal_plan) {
    const arr = meal_plan.split(',').filter(Boolean)
    if (arr.length) { conds.push(`meal_plan IN (${arr.map(() => '?').join(',')})`); params.push(...arr) }
  }
  if (departure_city) {
    const cities = departure_city.split(',').filter(Boolean)
    if (cities.length) { conds.push(`departure_city IN (${cities.map(() => '?').join(',')})`); params.push(...cities) }
  }

  const orderMap: Record<string, string> = { price_asc: 'price ASC', price_desc: 'price DESC', date_asc: 'departure_date ASC' }
  const orderBy = orderMap[sort] || 'departure_date ASC'
  const where = `WHERE ${conds.join(' AND ')}`
  const total = parseInt((await query(`SELECT COUNT(*) AS n FROM tours ${where}`, params)).rows[0].n)

  const limitNum = Math.min(500, Math.max(1, parseInt(limit ?? '') || 300))
  const offsetNum = offset ? Math.max(0, parseInt(offset) || 0) : 0
  const cols = 'id, hotel_id, agency, departure_date, return_date, duration, price, transport, meal_plan, adults, departure_city, url, is_last_minute, is_first_minute'
  const tours = (await query(`SELECT ${cols} FROM tours ${where} ORDER BY ${orderBy} LIMIT ${limitNum} OFFSET ${offsetNum}`, params)).rows

  const result = { tours, total, hasMore: offsetNum + tours.length < total }
  toursCache.set(cacheKey, result)
  return result
}

// GET /api/destinations
export async function listDestinations() {
  const cached = metaCache.get('destinations')
  if (cached) return cached
  let r = await query(`
    SELECT h.country, h.destination, h.resort_town, COUNT(DISTINCT h.id)::integer AS hotel_count
    FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
    WHERE h.destination IS NOT NULL AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
      AND (h.canonical_slug IS NULL OR h.canonical_slug = h.slug)
    GROUP BY h.country, h.destination, h.resort_town
    ORDER BY h.country, h.destination, hotel_count DESC`)
  if (r.rows.length === 0) {
    r = await query(`
      SELECT h.country, h.destination, h.resort_town, COUNT(DISTINCT h.id)::integer AS hotel_count
      FROM hotels h
      WHERE h.destination IS NOT NULL
        AND EXISTS (SELECT 1 FROM tours t WHERE t.hotel_id = h.id AND t.price > 0 AND t.departure_date >= CURRENT_DATE::text)
      GROUP BY h.country, h.destination, h.resort_town
      ORDER BY h.country, h.destination, hotel_count DESC`)
  }
  metaCache.set('destinations', r.rows)
  return r.rows
}

// GET /api/filters
export async function listFilters() {
  const cached = metaCache.get('filters')
  if (cached) return cached
  const [mealR, priceR, durR, starsR, transR, totalR, cityR, hotelsR] = await Promise.all([
    query(`SELECT meal_plan, COUNT(*)::integer AS count FROM tours WHERE meal_plan IS NOT NULL AND meal_plan != '' GROUP BY meal_plan ORDER BY count DESC`),
    query(`SELECT COALESCE((SELECT MIN(min_price) FROM hotel_stats WHERE min_price > 0), (SELECT MIN(price) FROM tours WHERE price > 0)) AS min,
                  COALESCE((SELECT MAX(max_price) FROM hotel_stats WHERE max_price > 0), (SELECT MAX(price) FROM tours WHERE price > 0)) AS max`),
    query(`SELECT duration, COUNT(*)::integer AS count FROM tours WHERE duration IS NOT NULL GROUP BY duration ORDER BY duration ASC`),
    query(`SELECT stars, COUNT(*)::integer AS count FROM hotels WHERE stars IS NOT NULL GROUP BY stars ORDER BY stars ASC`),
    query(`SELECT transport, COUNT(*)::integer AS count FROM tours WHERE transport IS NOT NULL AND transport != '' GROUP BY transport ORDER BY count DESC`),
    query(`SELECT COUNT(*)::integer AS total_tours FROM tours WHERE price > 0 AND departure_date >= CURRENT_DATE::text`),
    query(`SELECT departure_city, COUNT(*)::integer AS count FROM tours WHERE departure_city IS NOT NULL AND departure_city != '' GROUP BY departure_city ORDER BY count DESC`),
    query(`SELECT COUNT(*)::integer AS total_hotels FROM hotel_stats s JOIN hotels h ON h.id = s.hotel_id WHERE s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text AND (h.canonical_slug IS NULL OR h.canonical_slug = h.slug)`),
  ])
  const mealCounts: Record<string, number> = {}
  for (const row of mealR.rows) {
    const c = normalizeMealPlan(row.meal_plan)
    if (!c) continue
    mealCounts[c] = (mealCounts[c] || 0) + row.count
  }
  const result = {
    mealPlans: MEAL_ORDER.filter(mp => mealCounts[mp] > 0).map(mp => ({ meal_plan: mp, count: mealCounts[mp] })),
    priceRange: priceR.rows[0],
    durations: durR.rows,
    stars: starsR.rows,
    transports: transR.rows,
    totalTours: totalR.rows[0].total_tours,
    departureCities: cityR.rows,
    totalHotels: hotelsR.rows[0].total_hotels,
  }
  metaCache.set('filters', result)
  return result
}

// GET /api/calendar-prices
export async function calendarPrices(q: Q) {
  const { date_from, date_to, destination } = q
  if (!date_from || !date_to) throw new HttpError(400, 'date_from and date_to required')
  const re = /^\d{4}-\d{2}-\d{2}$/
  if (!re.test(date_from) || !re.test(date_to)) throw new HttpError(400, 'Invalid date format')

  const key = `cal_${date_from}_${date_to}_${destination || ''}`
  const cached = metaCache.get(key)
  if (cached) return cached
  const params: unknown[] = [date_from, date_to]
  if (destination) params.push(`%${destination}%`)
  const r = await query(`
    SELECT t.departure_date AS date, MIN(t.price) AS min_price, COUNT(*)::integer AS tour_count
    FROM tours t ${destination ? 'INNER JOIN hotels h ON h.id = t.hotel_id' : ''}
    WHERE t.departure_date >= ? AND t.departure_date <= ? AND t.price > 0 AND t.departure_date IS NOT NULL
      ${destination ? 'AND h.destination ILIKE ?' : ''}
    GROUP BY t.departure_date ORDER BY t.departure_date ASC`, params)
  metaCache.set(key, r.rows)
  return r.rows
}
