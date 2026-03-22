const express = require('express')
const router = express.Router()
const db = require('../db')

// GET /api/hotels
router.get('/', (req, res) => {
  try {
    const {
      destination, date_from, date_to,
      adults, duration, min_price, max_price,
      stars, meal_plan, transport, tour_type, departure_city,
      sort = 'price_asc', page = '1', limit = '24', view,
    } = req.query

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(96, Math.max(1, parseInt(limit) || 24))
    const offset = (pageNum - 1) * limitNum

    // Build filter conditions
    const hotelConds = []
    const tourConds = ['t.price > 0']
    const mainParams = []
    const tourParams = []

    if (destination) {
      const dests = String(destination).split(',').map(s => s.trim()).filter(Boolean)
      if (dests.length === 1) {
        hotelConds.push('(h.destination LIKE ? OR h.resort_town LIKE ? OR h.country LIKE ?)')
        mainParams.push(`%${dests[0]}%`, `%${dests[0]}%`, `%${dests[0]}%`)
      } else if (dests.length > 1) {
        const orClauses = dests.map(() => '(h.destination LIKE ? OR h.resort_town LIKE ? OR h.country LIKE ?)').join(' OR ')
        hotelConds.push(`(${orClauses})`)
        for (const d of dests) mainParams.push(`%${d}%`, `%${d}%`, `%${d}%`)
      }
    }

    if (stars) {
      const arr = String(stars).split(',').map(Number).filter(Boolean)
      if (arr.length) {
        hotelConds.push(`h.stars IN (${arr.map(() => '?').join(',')})`)
        mainParams.push(...arr)
      }
    }

    if (date_from) { tourConds.push('t.departure_date >= ?'); tourParams.push(date_from) }
    if (date_to)   { tourConds.push('t.departure_date <= ?'); tourParams.push(date_to) }

    if (duration) {
      const arr = String(duration).split(',').map(Number).filter(Boolean)
      if (arr.length) {
        tourConds.push(`t.duration IN (${arr.map(() => '?').join(',')})`)
        tourParams.push(...arr)
      }
    }

    if (meal_plan) {
      const arr = String(meal_plan).split(',').filter(Boolean)
      if (arr.length) {
        tourConds.push(`t.meal_plan IN (${arr.map(() => '?').join(',')})`)
        tourParams.push(...arr)
      }
    }

    if (transport) {
      tourConds.push('t.transport LIKE ?')
      tourParams.push(`%${transport}%`)
    }

    if (departure_city) {
      const cities = String(departure_city).split(',').filter(Boolean)
      if (cities.length === 1) {
        tourConds.push('t.departure_city = ?')
        tourParams.push(cities[0])
      } else if (cities.length > 1) {
        tourConds.push(`t.departure_city IN (${cities.map(() => '?').join(',')})`)
        tourParams.push(...cities)
      }
    }

    if (tour_type === 'last_minute')  { tourConds.push('t.is_last_minute = 1') }
    if (tour_type === 'first_minute') { tourConds.push('t.is_first_minute = 1') }

    const havingConds = []
    if (min_price) { havingConds.push('min_price >= ?') }
    if (max_price) { havingConds.push('min_price <= ?') }

    const hotelWhere = hotelConds.length ? `AND ${hotelConds.join(' AND ')}` : ''
    const tourWhere  = tourConds.length  ? `AND ${tourConds.join(' AND ')}`  : ''
    const having     = havingConds.length ? `HAVING ${havingConds.join(' AND ')}` : ''

    const orderMap = {
      price_asc:  'min_price ASC',
      price_desc: 'min_price DESC',
      stars_desc: 'h.stars DESC, min_price ASC',
      name_asc:   'h.name ASC',
    }
    const orderBy = orderMap[sort] || 'min_price ASC'

    // tourParams must come BEFORE mainParams: JOIN clause (tourWhere) appears before WHERE (hotelWhere) in SQL
    const allParams = [...tourParams, ...mainParams]
    const havingParams = []
    if (min_price) havingParams.push(parseFloat(min_price))
    if (max_price) havingParams.push(parseFloat(max_price))

    const extraFields = view === 'list'
      ? ', h.description, h.amenities, h.distances, h.food_options, h.price_includes'
      : ', h.food_options, h.amenities'

    const sql = `
      SELECT
        h.id, h.slug, h.agency, h.name, h.country, h.destination, h.resort_town,
        h.stars, h.review_score, h.thumbnail_url, h.photos, h.latitude, h.longitude
        ${extraFields},
        MIN(t.price) AS min_price,
        COUNT(t.id) AS available_dates,
        MIN(t.departure_date) AS next_departure,
        MAX(t.is_last_minute) AS has_last_minute,
        MAX(t.is_first_minute) AS has_first_minute
      FROM hotels h
      INNER JOIN tours t ON t.hotel_id = h.id ${tourWhere}
      WHERE 1=1 ${hotelWhere}
      GROUP BY h.id
      ${having}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `

    const countSql = `
      SELECT COUNT(*) AS total FROM (
        SELECT h.id, MIN(t.price) AS min_price
        FROM hotels h
        INNER JOIN tours t ON t.hotel_id = h.id ${tourWhere}
        WHERE 1=1 ${hotelWhere}
        GROUP BY h.id
        ${having}
      )
    `

    const allParamsWithHaving = [...allParams, ...havingParams]
    const { total } = db.prepare(countSql).get(allParamsWithHaving)
    const hotels = db.prepare(sql).all([...allParamsWithHaving, limitNum, offset])

    res.json({
      hotels,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    })
  } catch (err) {
    console.error('GET /api/hotels error:', err)
    res.status(500).json({ error: 'Database error', details: err.message })
  }
})

// GET /api/hotels/geo — lightweight geo data for map view (all matching hotels with coords)
router.get('/geo', (req, res) => {
  try {
    const { destination, stars, date_from, date_to, duration, min_price, max_price, meal_plan, transport } = req.query

    const hotelConds = ['h.latitude IS NOT NULL', 'h.longitude IS NOT NULL']
    const tourConds  = ['t.price > 0']
    const mainParams = []
    const tourParams = []

    if (destination) {
      const dests = String(destination).split(',').map(s => s.trim()).filter(Boolean)
      if (dests.length === 1) {
        hotelConds.push('(h.destination LIKE ? OR h.resort_town LIKE ? OR h.country LIKE ?)')
        mainParams.push(`%${dests[0]}%`, `%${dests[0]}%`, `%${dests[0]}%`)
      } else if (dests.length > 1) {
        const orClauses = dests.map(() => '(h.destination LIKE ? OR h.resort_town LIKE ? OR h.country LIKE ?)').join(' OR ')
        hotelConds.push(`(${orClauses})`)
        for (const d of dests) mainParams.push(`%${d}%`, `%${d}%`, `%${d}%`)
      }
    }

    if (stars) {
      const arr = String(stars).split(',').map(Number).filter(Boolean)
      if (arr.length) { hotelConds.push(`h.stars IN (${arr.map(() => '?').join(',')})`); mainParams.push(...arr) }
    }

    if (date_from) { tourConds.push('t.departure_date >= ?'); tourParams.push(date_from) }
    if (date_to)   { tourConds.push('t.departure_date <= ?'); tourParams.push(date_to) }

    if (duration) {
      const arr = String(duration).split(',').map(Number).filter(Boolean)
      if (arr.length) { tourConds.push(`t.duration IN (${arr.map(() => '?').join(',')})`); tourParams.push(...arr) }
    }

    if (meal_plan) {
      const arr = String(meal_plan).split(',').filter(Boolean)
      if (arr.length) { tourConds.push(`t.meal_plan IN (${arr.map(() => '?').join(',')})`); tourParams.push(...arr) }
    }

    if (transport) { tourConds.push('t.transport LIKE ?'); tourParams.push(`%${transport}%`) }

    const havingConds = []
    const havingParams = []
    if (min_price) { havingConds.push('min_price >= ?'); havingParams.push(parseFloat(min_price)) }
    if (max_price) { havingConds.push('min_price <= ?'); havingParams.push(parseFloat(max_price)) }

    const hotelWhere = `AND ${hotelConds.join(' AND ')}`
    const tourWhere  = tourConds.length ? `AND ${tourConds.join(' AND ')}` : ''
    const having     = havingConds.length ? `HAVING ${havingConds.join(' AND ')}` : ''

    const rows = db.prepare(`
      SELECT h.id, h.slug, h.name, h.stars, h.resort_town,
             h.latitude, h.longitude, MIN(t.price) AS min_price
      FROM hotels h
      INNER JOIN tours t ON t.hotel_id = h.id ${tourWhere}
      WHERE 1=1 ${hotelWhere}
      GROUP BY h.id
      ${having}
      ORDER BY min_price ASC
      LIMIT 2000
    `).all([...tourParams, ...mainParams, ...havingParams])

    res.json(rows)
  } catch (err) {
    console.error('GET /api/hotels/geo error:', err)
    res.status(500).json({ error: 'Database error', details: err.message })
  }
})

// GET /api/hotels/nearby?lat=X&lon=Y&exclude=slug&limit=6
router.get('/nearby', (req, res) => {
  try {
    const { lat, lon, exclude, limit = '6' } = req.query
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' })
    const limitNum = Math.min(12, Math.max(1, parseInt(limit) || 6))
    // Haversine approx in SQL using bounding box + distance sort
    const latF = parseFloat(lat)
    const lonF = parseFloat(lon)
    // SQLite has no trig functions — use Pythagorean approx on bounding box
    // 1° lat ≈ 111 km, 1° lon ≈ 111 * cos(lat) km
    const cosLat = Math.cos(latF * Math.PI / 180)
    const rows = db.prepare(`
      SELECT h.id, h.slug, h.name, h.country, h.resort_town, h.stars,
             h.thumbnail_url, h.latitude, h.longitude,
             MIN(t.price) AS min_price,
             SQRT(
               ((h.latitude - ?) * 111.0) * ((h.latitude - ?) * 111.0) +
               ((h.longitude - ?) * 111.0 * ?) * ((h.longitude - ?) * 111.0 * ?)
             ) AS distance_km
      FROM hotels h
      INNER JOIN tours t ON t.hotel_id = h.id AND t.price > 0
      WHERE h.latitude IS NOT NULL AND h.longitude IS NOT NULL
        AND h.slug != ?
        AND h.latitude BETWEEN ? AND ?
        AND h.longitude BETWEEN ? AND ?
      GROUP BY h.id
      ORDER BY distance_km ASC
      LIMIT ?
    `).all(
      latF, latF,
      lonF, cosLat, lonF, cosLat,
      exclude || '',
      latF - 1.5, latF + 1.5,
      lonF - 2, lonF + 2,
      limitNum
    )
    res.json(rows)
  } catch (err) {
    console.error('GET /api/hotels/nearby error:', err)
    res.status(500).json({ error: 'Database error', details: err.message })
  }
})

// GET /api/hotels/search?q=...
router.get('/search', (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 2) return res.json([])
    const rows = db.prepare(`
      SELECT h.slug, h.name, h.country, h.resort_town, h.stars, h.thumbnail_url
      FROM hotels h
      INNER JOIN tours t ON t.hotel_id = h.id AND t.price > 0
      WHERE h.name LIKE ?
      GROUP BY h.id
      ORDER BY h.name ASC
      LIMIT 6
    `).all(`%${q}%`)
    res.json(rows)
  } catch (err) {
    console.error('GET /api/hotels/search error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/hotels/:slug/reviews
router.get('/:slug/reviews', async (req, res) => {
  try {
    const hotel = db.prepare('SELECT id, name, resort_town, country, place_id, reviews_fetched_at FROM hotels WHERE slug = ?').get(req.params.slug)
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })

    // Return cached reviews if fresh (< 30 days)
    const cached = db.prepare('SELECT * FROM reviews WHERE hotel_id = ? ORDER BY rating DESC, review_date DESC').all(hotel.id)
    const fetchedAt = hotel.reviews_fetched_at ? new Date(hotel.reviews_fetched_at).getTime() : 0
    const cacheAge  = Date.now() - fetchedAt
    const CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

    if (cached.length > 0 && cacheAge < CACHE_TTL) {
      return res.json({ reviews: cached, overall_rating: null, total_ratings: null, source: 'cache' })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return res.json({ reviews: cached, overall_rating: null, total_ratings: null, source: 'none' })
    }

    // 1) Find place by hotel name + location
    const searchQuery = `${hotel.name} ${hotel.resort_town || hotel.country || ''}`
    const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount',
      },
      body: JSON.stringify({ textQuery: searchQuery, languageCode: 'cs' }),
    })
    const searchData = await searchRes.json()
    const placeId = searchData.places?.[0]?.id
    if (!placeId) {
      return res.json({ reviews: cached, overall_rating: null, total_ratings: null, source: 'not_found' })
    }

    // 2) Fetch place details incl. reviews
    const detailRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
      },
    })
    const detail = await detailRes.json()

    // 3) Cache in DB
    const deleteStmt = db.prepare('DELETE FROM reviews WHERE hotel_id = ?')
    const insertStmt = db.prepare(`
      INSERT INTO reviews (hotel_id, source, author_name, author_photo, rating, text, review_date, language)
      VALUES (?, 'google', ?, ?, ?, ?, ?, ?)
    `)
    const updateHotel = db.prepare("UPDATE hotels SET place_id = ?, reviews_fetched_at = datetime('now') WHERE id = ?")

    const newReviews = (detail.reviews || []).map(r => ({
      hotel_id:    hotel.id,
      source:      'google',
      author_name: r.authorAttribution?.displayName || 'Anonymní',
      author_photo: r.authorAttribution?.photoUri || null,
      rating:      r.rating,
      text:        r.text?.text || '',
      review_date: r.publishTime ? r.publishTime.split('T')[0] : null,
      language:    r.originalText?.languageCode || r.text?.languageCode || null,
    }))

    db.transaction(() => {
      deleteStmt.run(hotel.id)
      for (const r of newReviews) {
        insertStmt.run(r.hotel_id, r.author_name, r.author_photo, r.rating, r.text, r.review_date, r.language)
      }
      updateHotel.run(placeId, hotel.id)
    })()

    const savedReviews = db.prepare('SELECT * FROM reviews WHERE hotel_id = ? ORDER BY rating DESC').all(hotel.id)
    res.json({
      reviews:        savedReviews,
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
router.get('/:slug', (req, res) => {
  try {
    const hotel = db.prepare('SELECT * FROM hotels WHERE slug = ?').get(req.params.slug)
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })

    // Multi-agency: agreguj přes canonical_slug pokud je nastaven,
    // jinak fallback na hotel_id (před prvním run_all.py).
    const canonicalSlug = hotel.canonical_slug || null
    const stats = canonicalSlug
      ? db.prepare(`
          SELECT MIN(t.price) AS min_price, MAX(t.price) AS max_price, COUNT(*) AS total_dates
          FROM tours t JOIN hotels h ON h.id = t.hotel_id
          WHERE h.canonical_slug = ? AND t.departure_date >= date('now')
        `).get(canonicalSlug)
      : db.prepare(`
          SELECT MIN(price) AS min_price, MAX(price) AS max_price, COUNT(*) AS total_dates
          FROM tours WHERE hotel_id = ? AND departure_date >= date('now')
        `).get(hotel.id)

    res.json({ ...hotel, ...stats })
  } catch (err) {
    res.status(500).json({ error: 'Database error' })
  }
})

module.exports = router
