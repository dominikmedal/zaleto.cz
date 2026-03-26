const express = require('express')
const router = express.Router()
const db = require('../db')
const { hotelsCache, hotelDetailCache } = require('../cache')

// Lazy-initialised — set after first DB check or cache invalidation
let statsPopulated = null

// GET /api/hotels
router.get('/', async (req, res) => {
  try {
    // Cache lookup — klíč bez known_total
    const { known_total, ...queryForKey } = req.query
    const cacheKey = JSON.stringify(queryForKey)
    const cached = hotelsCache.get(cacheKey)
    if (cached) {
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
      res.set('X-Cache', 'HIT')
      return res.json(cached)
    }

    const {
      destination, date_from, date_to,
      adults, duration, min_price, max_price,
      stars, meal_plan, transport, tour_type, departure_city,
      sort = 'price_asc', page = '1', limit = '24', view,
    } = req.query

    const pageNum  = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(96, Math.max(1, parseInt(limit) || 24))
    const knownTotal = known_total ? parseInt(known_total) : null
    const offset = (pageNum - 1) * limitNum

    const hasTourFilters = date_from || date_to || duration || meal_plan || transport || departure_city

    const extraFields = view === 'list'
      ? ', h.description, h.amenities, h.distances, h.food_options, h.price_includes'
      : ', h.food_options, h.amenities'

    const orderMap = {
      price_asc:  'min_price ASC',
      price_desc: 'min_price DESC',
      stars_desc: 'h.stars DESC, min_price ASC',
      name_asc:   'h.name ASC',
    }
    const orderBy = orderMap[sort] || 'min_price ASC'

    let total, hotels

    if (!hasTourFilters) {
      // ── FAST PATH: pouze hotel_stats (13K řádků) bez JOIN na miliony tours ──
      if (statsPopulated === null) {
        const r = await db.query('SELECT COUNT(*) AS n FROM hotel_stats')
        statsPopulated = parseInt(r.rows[0].n) > 0
      }

      const whereConds = ['s.min_price IS NOT NULL', "s.next_departure >= CURRENT_DATE::text"]
      const params = []

      if (destination) {
        const dests = String(destination).split(',').map(s => s.trim()).filter(Boolean)
        if (dests.length === 1) {
          whereConds.push('(h.destination ILIKE ? OR h.resort_town ILIKE ? OR h.country ILIKE ?)')
          params.push(`%${dests[0]}%`, `%${dests[0]}%`, `%${dests[0]}%`)
        } else {
          const orClauses = dests.map(() => '(h.destination ILIKE ? OR h.resort_town ILIKE ? OR h.country ILIKE ?)').join(' OR ')
          whereConds.push(`(${orClauses})`)
          for (const d of dests) params.push(`%${d}%`, `%${d}%`, `%${d}%`)
        }
      }

      if (stars) {
        const arr = String(stars).split(',').map(Number).filter(Boolean)
        if (arr.length) { whereConds.push(`h.stars IN (${arr.map(() => '?').join(',')})`); params.push(...arr) }
      }

      if (tour_type === 'last_minute')  { whereConds.push('s.has_last_minute = 1') }
      if (tour_type === 'first_minute') { whereConds.push('s.has_first_minute = 1') }

      if (min_price) { whereConds.push('s.min_price >= ?'); params.push(parseFloat(min_price)) }
      if (max_price) { whereConds.push('s.min_price <= ?'); params.push(parseFloat(max_price)) }

      const where = `WHERE ${whereConds.join(' AND ')}`

      if (statsPopulated) {
        const fastSql = `
          SELECT
            h.id, h.slug, h.agency, h.name, h.country, h.destination, h.resort_town,
            h.stars, h.review_score, h.thumbnail_url, h.photos, h.latitude, h.longitude
            ${extraFields},
            s.min_price, s.available_dates, s.next_departure,
            s.has_last_minute, s.has_first_minute
          FROM hotels h
          INNER JOIN hotel_stats s ON s.hotel_id = h.id
          ${where}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `
        if (knownTotal !== null && pageNum > 1) {
          total = knownTotal
        } else {
          const cr = await db.query(
            `SELECT COUNT(*) AS total FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id ${where}`,
            params
          )
          total = parseInt(cr.rows[0].total)
        }
        const hr = await db.query(fastSql, [...params, limitNum, offset])
        hotels = hr.rows

      } else {
        // ── Fallback (hotel_stats prázdná): COALESCE s live subquery ─────────
        const coalesceWhere = whereConds.map(c =>
          c.replace(/\bs\.min_price\b/g, 'COALESCE(s.min_price, sub.min_price)')
           .replace(/\bs\.has_last_minute\b/g,  'COALESCE(s.has_last_minute,  sub.has_last_minute)')
           .replace(/\bs\.has_first_minute\b/g, 'COALESCE(s.has_first_minute, sub.has_first_minute)')
           .replace(/s\.next_departure >= CURRENT_DATE::text/, "(COALESCE(s.next_departure, sub.next_departure) >= CURRENT_DATE::text)")
           .replace(/s\.min_price IS NOT NULL/, '(s.min_price IS NOT NULL OR sub.min_price IS NOT NULL)')
        ).join(' AND ')

        const liveSub = `(
          SELECT hotel_id,
            MIN(price) AS min_price, COUNT(*)::integer AS available_dates, MIN(departure_date) AS next_departure,
            MAX(COALESCE(is_last_minute,  0)) AS has_last_minute,
            MAX(COALESCE(is_first_minute, 0)) AS has_first_minute
          FROM tours WHERE price > 0 AND departure_date >= CURRENT_DATE::text
          GROUP BY hotel_id
        ) sub`

        const fallbackSql = `
          SELECT h.id, h.slug, h.agency, h.name, h.country, h.destination, h.resort_town,
            h.stars, h.review_score, h.thumbnail_url, h.photos, h.latitude, h.longitude
            ${extraFields},
            COALESCE(s.min_price, sub.min_price)               AS min_price,
            COALESCE(s.available_dates, sub.available_dates)   AS available_dates,
            COALESCE(s.next_departure, sub.next_departure)     AS next_departure,
            COALESCE(s.has_last_minute, sub.has_last_minute)   AS has_last_minute,
            COALESCE(s.has_first_minute, sub.has_first_minute) AS has_first_minute
          FROM hotels h
          LEFT JOIN hotel_stats s ON s.hotel_id = h.id
          LEFT JOIN ${liveSub} ON sub.hotel_id = h.id
          WHERE ${coalesceWhere}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?
        `
        if (knownTotal !== null && pageNum > 1) {
          total = knownTotal
        } else {
          const cr = await db.query(
            `SELECT COUNT(*) AS total FROM hotels h LEFT JOIN hotel_stats s ON s.hotel_id = h.id LEFT JOIN ${liveSub} ON sub.hotel_id = h.id WHERE ${coalesceWhere}`,
            params
          )
          total = parseInt(cr.rows[0].total)
        }
        const hr = await db.query(fallbackSql, [...params, limitNum, offset])
        hotels = hr.rows
      }

    } else {
      // ── SLOW PATH: GROUP BY přes tours (tour-level filtry) ───────────────
      // date_from supersedes CURRENT_DATE
      const tourConds = ['t.price > 0', date_from ? 't.departure_date >= ?' : 't.departure_date >= CURRENT_DATE::text']
      const tourParams = []
      if (date_from) tourParams.push(date_from)

      const hotelConds = []
      const mainParams = []

      if (destination) {
        const dests = String(destination).split(',').map(s => s.trim()).filter(Boolean)
        if (dests.length === 1) {
          hotelConds.push('(h.destination ILIKE ? OR h.resort_town ILIKE ? OR h.country ILIKE ?)')
          mainParams.push(`%${dests[0]}%`, `%${dests[0]}%`, `%${dests[0]}%`)
        } else {
          const orClauses = dests.map(() => '(h.destination ILIKE ? OR h.resort_town ILIKE ? OR h.country ILIKE ?)').join(' OR ')
          hotelConds.push(`(${orClauses})`)
          for (const d of dests) mainParams.push(`%${d}%`, `%${d}%`, `%${d}%`)
        }
      }

      if (stars) {
        const arr = String(stars).split(',').map(Number).filter(Boolean)
        if (arr.length) { hotelConds.push(`h.stars IN (${arr.map(() => '?').join(',')})`); mainParams.push(...arr) }
      }

      if (date_to) { tourConds.push('t.departure_date <= ?'); tourParams.push(date_to) }

      if (duration) {
        const arr = String(duration).split(',').map(Number).filter(Boolean)
        if (arr.length) { tourConds.push(`t.duration IN (${arr.map(() => '?').join(',')})`); tourParams.push(...arr) }
      }

      if (meal_plan) {
        const arr = String(meal_plan).split(',').filter(Boolean)
        if (arr.length) { tourConds.push(`t.meal_plan IN (${arr.map(() => '?').join(',')})`); tourParams.push(...arr) }
      }

      if (transport) { tourConds.push('t.transport ILIKE ?'); tourParams.push(`%${transport}%`) }

      if (departure_city) {
        const cities = String(departure_city).split(',').filter(Boolean)
        if (cities.length === 1) { tourConds.push('t.departure_city = ?'); tourParams.push(cities[0]) }
        else if (cities.length > 1) { tourConds.push(`t.departure_city IN (${cities.map(() => '?').join(',')})`); tourParams.push(...cities) }
      }

      if (tour_type === 'last_minute')  { tourConds.push('t.is_last_minute = 1') }
      if (tour_type === 'first_minute') { tourConds.push('t.is_first_minute = 1') }

      const havingConds = []
      const havingParams = []
      if (min_price) { havingConds.push('min_price >= ?'); havingParams.push(parseFloat(min_price)) }
      if (max_price) { havingConds.push('min_price <= ?'); havingParams.push(parseFloat(max_price)) }

      // Unified WHERE: tour conditions first (so param order matches tourParams, then mainParams)
      const allConds = [...tourConds, ...hotelConds]
      const allParams = [...tourParams, ...mainParams]
      const whereClause = `WHERE ${allConds.join(' AND ')}`
      const having = havingConds.length ? `HAVING ${havingConds.join(' AND ')}` : ''

      // In PG, GROUP BY h.id works when h is the real hotels table (functional dependency on PK)
      const slowSql = `
        SELECT h.id, h.slug, h.agency, h.name, h.country, h.destination, h.resort_town,
               h.stars, h.review_score, h.thumbnail_url, h.photos, h.latitude, h.longitude
               ${extraFields},
          MIN(t.price) AS min_price, COUNT(t.id)::integer AS available_dates,
          MIN(t.departure_date) AS next_departure,
          MAX(t.is_last_minute) AS has_last_minute, MAX(t.is_first_minute) AS has_first_minute
        FROM hotels h
        INNER JOIN tours t ON t.hotel_id = h.id
        ${whereClause}
        GROUP BY h.id ${having} ORDER BY ${orderBy} LIMIT ? OFFSET ?
      `
      const countSql = `
        SELECT COUNT(*) AS total FROM (
          SELECT h.id, MIN(t.price) AS min_price
          FROM hotels h INNER JOIN tours t ON t.hotel_id = h.id
          ${whereClause}
          GROUP BY h.id ${having}
        ) AS count_sub
      `
      const slowParams = [...allParams, ...havingParams]

      if (knownTotal !== null && pageNum > 1) {
        total = knownTotal
      } else {
        const cr = await db.query(countSql, slowParams)
        total = parseInt(cr.rows[0].total)
      }
      const hr = await db.query(slowSql, [...slowParams, limitNum, offset])
      hotels = hr.rows
    }

    const hasMore = offset + hotels.length < total
    const result = {
      hotels,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore,
      },
    }

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    hotelsCache.set(cacheKey, result)
    res.set('X-Cache', 'MISS').json(result)
  } catch (err) {
    console.error('GET /hotels error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/hotels/geo  — bounding-box search for map view
router.get('/geo', async (req, res) => {
  try {
    const { sw_lat, sw_lng, ne_lat, ne_lng } = req.query
    if (!sw_lat || !sw_lng || !ne_lat || !ne_lng) return res.status(400).json({ error: 'sw_lat, sw_lng, ne_lat, ne_lng required' })

    const cacheKey = `geo_${sw_lat}_${sw_lng}_${ne_lat}_${ne_lng}`
    const cached = hotelsCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const r = await db.query(`
      SELECT h.id, h.slug, h.name, h.stars, h.thumbnail_url, h.latitude, h.longitude,
             s.min_price, s.next_departure
      FROM hotels h
      INNER JOIN hotel_stats s ON s.hotel_id = h.id
      WHERE h.latitude  BETWEEN ? AND ?
        AND h.longitude BETWEEN ? AND ?
        AND s.min_price IS NOT NULL
      LIMIT 200
    `, [parseFloat(sw_lat), parseFloat(ne_lat), parseFloat(sw_lng), parseFloat(ne_lng)])

    hotelsCache.set(cacheKey, r.rows)
    res.set('X-Cache', 'MISS').json(r.rows)
  } catch (err) {
    console.error('GET /hotels/geo error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/hotels/nearby?slug=xxx&limit=6
router.get('/nearby', async (req, res) => {
  try {
    const { slug, limit = '6' } = req.query
    if (!slug) return res.status(400).json({ error: 'slug required' })

    const cacheKey = `nearby_${slug}_${limit}`
    const cached = hotelDetailCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const hr = await db.query('SELECT latitude, longitude, destination FROM hotels WHERE slug = ?', [slug])
    const hotel = hr.rows[0]
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })

    const limitNum = Math.min(20, Math.max(1, parseInt(limit) || 6))

    let rows
    if (hotel.latitude && hotel.longitude) {
      const r = await db.query(`
        SELECT h.id, h.slug, h.name, h.stars, h.thumbnail_url, h.latitude, h.longitude,
               h.destination, h.country, h.review_score,
               s.min_price, s.next_departure,
               (ABS(h.latitude - ?) + ABS(h.longitude - ?)) AS dist
        FROM hotels h
        INNER JOIN hotel_stats s ON s.hotel_id = h.id
        WHERE h.slug != ? AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
          AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL
        ORDER BY dist ASC
        LIMIT ?
      `, [hotel.latitude, hotel.longitude, slug, limitNum])
      rows = r.rows
    } else {
      const r = await db.query(`
        SELECT h.id, h.slug, h.name, h.stars, h.thumbnail_url, h.latitude, h.longitude,
               h.destination, h.country, h.review_score,
               s.min_price, s.next_departure
        FROM hotels h
        INNER JOIN hotel_stats s ON s.hotel_id = h.id
        WHERE h.slug != ? AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
          AND h.destination = ?
        ORDER BY s.min_price ASC
        LIMIT ?
      `, [slug, hotel.destination, limitNum])
      rows = r.rows
    }

    hotelDetailCache.set(cacheKey, rows)
    res.set('X-Cache', 'MISS').json(rows)
  } catch (err) {
    console.error('GET /hotels/nearby error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/hotels/slugs  — all slugs for sitemap
router.get('/slugs', async (req, res) => {
  try {
    const cached = hotelDetailCache.get('slugs')
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const r = await db.query(`
      SELECT h.slug, h.updated_at
      FROM hotels h
      INNER JOIN hotel_stats s ON s.hotel_id = h.id
      WHERE s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
      ORDER BY h.slug ASC
    `)

    hotelDetailCache.set('slugs', r.rows)
    res.set('X-Cache', 'MISS').json(r.rows)
  } catch (err) {
    console.error('GET /hotels/slugs error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/hotels/search?q=xxx
router.get('/search', async (req, res) => {
  try {
    const { q, limit = '10' } = req.query
    if (!q || String(q).trim().length < 2) return res.json([])

    const cacheKey = `search_${q}_${limit}`
    const cached = hotelsCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const term = `%${String(q).trim()}%`
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10))

    const r = await db.query(`
      SELECT h.id, h.slug, h.name, h.destination, h.country, h.stars, h.thumbnail_url, s.min_price
      FROM hotels h
      INNER JOIN hotel_stats s ON s.hotel_id = h.id
      WHERE (h.name ILIKE ? OR h.destination ILIKE ? OR h.resort_town ILIKE ?)
        AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
      ORDER BY s.min_price ASC
      LIMIT ?
    `, [term, term, term, limitNum])

    hotelsCache.set(cacheKey, r.rows)
    res.set('X-Cache', 'MISS').json(r.rows)
  } catch (err) {
    console.error('GET /hotels/search error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/hotels/:slug/reviews
router.get('/:slug/reviews', async (req, res) => {
  try {
    const { slug } = req.params
    const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY

    const hotelR = await db.query('SELECT id, name, place_id, reviews_fetched_at FROM hotels WHERE slug = ?', [slug])
    const hotel = hotelR.rows[0]
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })

    // Return cached reviews if fetched within 30 days
    if (hotel.reviews_fetched_at) {
      const age = (Date.now() - new Date(hotel.reviews_fetched_at).getTime()) / 86400000
      if (age < 30) {
        const rr = await db.query('SELECT * FROM reviews WHERE hotel_id = ? ORDER BY rating DESC', [hotel.id])
        if (rr.rows.length > 0) {
          return res.json({ reviews: rr.rows, source: 'cache' })
        }
      }
    }

    if (!GOOGLE_API_KEY) return res.json({ reviews: [], source: 'none' })

    // Find or confirm place_id via Places API
    let placeId = hotel.place_id
    if (!placeId) {
      const searchRes = await fetch(
        `https://places.googleapis.com/v1/places:searchText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName',
          },
          body: JSON.stringify({ textQuery: `hotel ${hotel.name}` }),
        }
      )
      if (!searchRes.ok) return res.json({ reviews: [], source: 'none' })
      const searchData = await searchRes.json()
      placeId = searchData.places?.[0]?.id
      if (!placeId) return res.json({ reviews: [], source: 'none' })
    }

    // Fetch place details + reviews
    const detailRes = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
        },
      }
    )
    if (!detailRes.ok) return res.json({ reviews: [], source: 'none' })
    const detail = await detailRes.json()

    const newReviews = (detail.reviews || []).map(r => ({
      hotel_id:     hotel.id,
      author_name:  r.authorAttribution?.displayName || 'Anonymní',
      author_photo: r.authorAttribution?.photoUri || null,
      rating:       r.rating,
      text:         r.text?.text || '',
      review_date:  r.publishTime ? r.publishTime.split('T')[0] : null,
      language:     r.originalText?.languageCode || r.text?.languageCode || null,
    }))

    // Save in a transaction
    const client = await db.pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM reviews WHERE hotel_id = $1', [hotel.id])
      for (const r of newReviews) {
        await client.query(
          `INSERT INTO reviews (hotel_id, source, author_name, author_photo, rating, text, review_date, language)
           VALUES ($1, 'google', $2, $3, $4, $5, $6, $7)`,
          [r.hotel_id, r.author_name, r.author_photo, r.rating, r.text, r.review_date, r.language]
        )
      }
      await client.query(
        'UPDATE hotels SET place_id = $1, reviews_fetched_at = NOW() WHERE id = $2',
        [placeId, hotel.id]
      )
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    const savedR = await db.query('SELECT * FROM reviews WHERE hotel_id = ? ORDER BY rating DESC', [hotel.id])
    res.json({
      reviews:        savedR.rows,
      overall_rating: detail.rating || null,
      total_ratings:  detail.userRatingCount || null,
      source:         'google',
    })
  } catch (err) {
    console.error('GET /reviews error:', err)
    res.status(500).json({ error: 'Failed to fetch reviews', details: err.message })
  }
})

// GET /api/hotels/:slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const cached = hotelDetailCache.get(`hotel_${slug}`)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const hr = await db.query('SELECT * FROM hotels WHERE slug = ?', [slug])
    const hotel = hr.rows[0]
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })

    const canonicalSlug = hotel.canonical_slug || null
    let statsR
    if (canonicalSlug) {
      statsR = await db.query(`
        SELECT MIN(t.price) AS min_price, MAX(t.price) AS max_price,
               COUNT(*)::integer AS total_dates, MAX(t.updated_at) AS tours_updated_at
        FROM tours t JOIN hotels h ON h.id = t.hotel_id
        WHERE h.canonical_slug = ? AND t.departure_date >= CURRENT_DATE::text
      `, [canonicalSlug])
    } else {
      statsR = await db.query(`
        SELECT MIN(price) AS min_price, MAX(price) AS max_price,
               COUNT(*)::integer AS total_dates, MAX(updated_at) AS tours_updated_at
        FROM tours WHERE hotel_id = ? AND departure_date >= CURRENT_DATE::text
      `, [hotel.id])
    }
    const stats = statsR.rows[0]

    // Pokud hotel není od Fischeru, preferuj Fischerův popis
    let description = hotel.description
    if (canonicalSlug && hotel.agency !== 'Fischer') {
      const fr = await db.query(
        `SELECT description FROM hotels WHERE canonical_slug = ? AND agency = 'Fischer' AND description IS NOT NULL LIMIT 1`,
        [canonicalSlug]
      )
      if (fr.rows[0]?.description) description = fr.rows[0].description
    }

    const result = { ...hotel, description, ...stats }
    hotelDetailCache.set(`hotel_${slug}`, result)
    res.set('X-Cache', 'MISS').json(result)
  } catch (err) {
    res.status(500).json({ error: 'Database error' })
  }
})

// Voláno z /api/cache/invalidate — scraper mohl aktualizovat hotel_stats
async function resetStats() {
  const r = await db.query('SELECT COUNT(*) AS n FROM hotel_stats')
  statsPopulated = parseInt(r.rows[0].n) > 0
}

module.exports = router
module.exports.resetStats = resetStats
