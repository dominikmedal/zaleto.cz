const express = require('express')
const router = express.Router()
const db = require('../db')
const { hotelsCache, hotelDetailCache } = require('../cache')

// Používáme hotel_stats jako primární zdroj (bez drahého GROUP BY na 3.9M termínech).
// Hodnota se zkontroluje při startu a po invalidaci cache.
let statsPopulated = db.prepare('SELECT COUNT(*) AS n FROM hotel_stats').get().n > 0

// GET /api/hotels
router.get('/', (req, res) => {
  try {
    // Cache lookup — klíč bez known_total (ten neovlivňuje výsledek, jen COUNT skip)
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

    // Určí, zda lze použít fast path (hotel_stats) — bez filtrů na úrovni termínů
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
      // ── FAST PATH: pouze hotel_stats (13K řádků) bez JOIN na 3.9M tours ──────
      // hotel_stats je plněna scrapery. Pokud je prázdná (první spuštění bez run_all.py),
      // fallback na pomalou cestu.
      if (!statsPopulated) {
        const n = db.prepare('SELECT COUNT(*) AS n FROM hotel_stats').get().n
        statsPopulated = n > 0
      }

      const whereConds = ['s.min_price IS NOT NULL', "s.next_departure >= date('now')"]
      const params = []

      if (destination) {
        const dests = String(destination).split(',').map(s => s.trim()).filter(Boolean)
        if (dests.length === 1) {
          whereConds.push('(h.destination LIKE ? OR h.resort_town LIKE ? OR h.country LIKE ?)')
          params.push(`%${dests[0]}%`, `%${dests[0]}%`, `%${dests[0]}%`)
        } else {
          const orClauses = dests.map(() => '(h.destination LIKE ? OR h.resort_town LIKE ? OR h.country LIKE ?)').join(' OR ')
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
        // ── Stats-only path: INNER JOIN hotel_stats — žádný subquery přes tours ──
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
        total = (knownTotal !== null && pageNum > 1)
          ? knownTotal
          : db.prepare(`SELECT COUNT(*) AS total FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id ${where}`).get(params).total

        hotels = db.prepare(fastSql).all([...params, limitNum, offset])

      } else {
        // ── Fallback (hotel_stats prázdná): COALESCE s live subquery ─────────
        const coalesceWhere = whereConds.map(c =>
          c.replace(/\bs\.min_price\b/g, 'COALESCE(s.min_price, sub.min_price)')
           .replace(/\bs\.has_last_minute\b/g,  'COALESCE(s.has_last_minute,  sub.has_last_minute)')
           .replace(/\bs\.has_first_minute\b/g, 'COALESCE(s.has_first_minute, sub.has_first_minute)')
           .replace(/\bs\.next_departure >= date\('now'\)/, "(COALESCE(s.next_departure, sub.next_departure) >= date('now'))")
           .replace(/\bs\.min_price IS NOT NULL/, '(s.min_price IS NOT NULL OR sub.min_price IS NOT NULL)')
        ).join(' AND ')

        const liveSub = `(
          SELECT hotel_id,
            MIN(price) AS min_price, COUNT(*) AS available_dates, MIN(departure_date) AS next_departure,
            MAX(COALESCE(is_last_minute,  0)) AS has_last_minute,
            MAX(COALESCE(is_first_minute, 0)) AS has_first_minute
          FROM tours WHERE price > 0 AND departure_date >= date('now')
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
        total = (knownTotal !== null && pageNum > 1)
          ? knownTotal
          : db.prepare(`SELECT COUNT(*) AS total FROM hotels h LEFT JOIN hotel_stats s ON s.hotel_id = h.id LEFT JOIN ${liveSub} ON sub.hotel_id = h.id WHERE ${coalesceWhere}`).get(params).total

        hotels = db.prepare(fallbackSql).all([...params, limitNum, offset])
      }

    } else {
      // ── SLOW PATH: GROUP BY přes tours (tour-level filtry) ───────────────
      const hotelConds = []
      const tourConds = ['t.price > 0', "t.departure_date >= date('now')"]
      const mainParams = []
      const tourParams = []

      if (destination) {
        const dests = String(destination).split(',').map(s => s.trim()).filter(Boolean)
        if (dests.length === 1) {
          hotelConds.push('(h.destination LIKE ? OR h.resort_town LIKE ? OR h.country LIKE ?)')
          mainParams.push(`%${dests[0]}%`, `%${dests[0]}%`, `%${dests[0]}%`)
        } else {
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

      const hotelWhere = hotelConds.length ? `AND ${hotelConds.join(' AND ')}` : ''
      const tourWhere  = `AND ${tourConds.join(' AND ')}`
      const having     = havingConds.length ? `HAVING ${havingConds.join(' AND ')}` : ''

      const allParams = [...tourParams, ...mainParams]
      const allParamsWithHaving = [...allParams, ...havingParams]

      const slowSql = `
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

      total = (knownTotal !== null && pageNum > 1)
        ? knownTotal
        : db.prepare(countSql).get(allParamsWithHaving).total

      hotels = db.prepare(slowSql).all([...allParamsWithHaving, limitNum, offset])
    }

    const result = {
      hotels,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum),
      },
    }

    hotelsCache.set(cacheKey, result)
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
    res.set('X-Cache', 'MISS')
    res.json(result)
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

    const cacheKey = `nearby_${lat}_${lon}_${exclude || ''}_${limit}`
    const cached = hotelDetailCache.get(cacheKey)
    if (cached) return res.json(cached)
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
    hotelDetailCache.set(cacheKey, rows)
    res.json(rows)
  } catch (err) {
    console.error('GET /api/hotels/nearby error:', err)
    res.status(500).json({ error: 'Database error', details: err.message })
  }
})

// GET /api/hotels/slugs — lightweight endpoint pro sitemap (všechny hotely s termíny)
// ?limit=N omezí počet výsledků (pro generateStaticParams), bez limitu vrátí vše (pro sitemap)
router.get('/slugs', (req, res) => {
  try {
    const limitNum = req.query.limit ? Math.max(1, parseInt(req.query.limit) || 0) : 0
    const cacheKey = `slugs_${limitNum}`
    const cached = hotelDetailCache.get(cacheKey)
    if (cached) return res.json(cached)

    const sql = `
      SELECT h.slug, h.updated_at
      FROM hotels h
      INNER JOIN hotel_stats s ON s.hotel_id = h.id
      ORDER BY s.min_price ASC
      ${limitNum ? `LIMIT ${limitNum}` : ''}
    `
    const rows = db.prepare(sql).all()
    hotelDetailCache.set(cacheKey, rows)
    res.json(rows)
  } catch (err) {
    console.error('GET /api/hotels/slugs error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/hotels/search?q=...
router.get('/search', (req, res) => {
  try {
    const q = String(req.query.q || '').trim()
    if (q.length < 2) return res.json([])

    const cacheKey = `search_${q.toLowerCase()}`
    const cached = hotelsCache.get(cacheKey)
    if (cached) return res.json(cached)

    // Deduplikace: hotely se stejným canonical_slug jsou jeden hotel od více CK.
    // Používáme INNER JOIN hotel_stats místo tours — 13K vs 3.9M řádků, ~10× rychlejší.
    const rows = db.prepare(`
      SELECT
        COALESCE(h.canonical_slug, h.slug) AS slug,
        MIN(h.name)          AS name,
        MIN(h.country)       AS country,
        MIN(h.resort_town)   AS resort_town,
        MAX(h.stars)         AS stars,
        MIN(h.thumbnail_url) AS thumbnail_url
      FROM hotels h
      INNER JOIN hotel_stats s ON s.hotel_id = h.id AND s.min_price IS NOT NULL
      WHERE h.name LIKE ?
      GROUP BY COALESCE(h.canonical_slug, h.slug)
      ORDER BY name ASC
      LIMIT 6
    `).all(`%${q}%`)
    hotelsCache.set(cacheKey, rows)
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
    const { slug } = req.params
    const cached = hotelDetailCache.get(`hotel_${slug}`)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const hotel = db.prepare('SELECT * FROM hotels WHERE slug = ?').get(slug)
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })

    // Multi-agency: agreguj přes canonical_slug pokud je nastaven,
    // jinak fallback na hotel_id (před prvním run_all.py).
    const canonicalSlug = hotel.canonical_slug || null
    const stats = canonicalSlug
      ? db.prepare(`
          SELECT MIN(t.price) AS min_price, MAX(t.price) AS max_price, COUNT(*) AS total_dates,
                 MAX(t.updated_at) AS tours_updated_at
          FROM tours t JOIN hotels h ON h.id = t.hotel_id
          WHERE h.canonical_slug = ? AND t.departure_date >= date('now')
        `).get(canonicalSlug)
      : db.prepare(`
          SELECT MIN(price) AS min_price, MAX(price) AS max_price, COUNT(*) AS total_dates,
                 MAX(updated_at) AS tours_updated_at
          FROM tours WHERE hotel_id = ? AND departure_date >= date('now')
        `).get(hotel.id)

    // Pokud hotel není od Fischeru, preferuj Fischerův popis (bývá kvalitnější)
    let description = hotel.description
    if (canonicalSlug && hotel.agency !== 'Fischer') {
      const fischer = db.prepare(
        `SELECT description FROM hotels WHERE canonical_slug = ? AND agency = 'Fischer' AND description IS NOT NULL LIMIT 1`
      ).get(canonicalSlug)
      if (fischer?.description) description = fischer.description
    }

    const result = { ...hotel, description, ...stats }
    hotelDetailCache.set(`hotel_${slug}`, result)
    res.set('X-Cache', 'MISS').json(result)
  } catch (err) {
    res.status(500).json({ error: 'Database error' })
  }
})

// Voláno z /api/cache/invalidate — scraper mohl aktualizovat hotel_stats
function resetStats() { statsPopulated = db.prepare('SELECT COUNT(*) AS n FROM hotel_stats').get().n > 0 }

module.exports = router
module.exports.resetStats = resetStats
