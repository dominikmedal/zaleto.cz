const express = require('express')
const router = express.Router({ mergeParams: true })
const db = require('../db')
const { toursCache } = require('../cache')

// GET /api/hotels/:slug/tours  — available dates for a hotel
router.get('/', async (req, res) => {
  try {
    const { slug } = req.params
    const { date_from, date_to, duration, meal_plan, sort = 'date_asc', limit, offset } = req.query

    const cacheKey = `${slug}_${JSON.stringify(req.query)}`
    const cached = toursCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const hotelR = await db.query('SELECT id, canonical_slug FROM hotels WHERE slug = ?', [slug])
    const hotel = hotelR.rows[0]
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })

    // Multi-agency: gather all hotel_ids via canonical_slug
    const canonicalSlug = hotel.canonical_slug || null
    let hotelIds
    if (canonicalSlug) {
      const r = await db.query('SELECT id FROM hotels WHERE canonical_slug = ?', [canonicalSlug])
      hotelIds = r.rows.map(r => r.id)
    } else {
      hotelIds = [hotel.id]
    }
    if (hotelIds.length === 0) return res.json({ tours: [], total: 0 })

    const conds = [
      `hotel_id IN (${hotelIds.map(() => '?').join(',')})`,
      "departure_date >= CURRENT_DATE::text",
      'price > 0',
    ]
    const params = [...hotelIds]

    if (date_from) { conds.push('departure_date >= ?'); params.push(date_from) }
    if (date_to)   { conds.push('departure_date <= ?'); params.push(date_to) }

    if (duration) {
      const arr = String(duration).split(',').map(Number).filter(Boolean)
      if (arr.length) { conds.push(`duration IN (${arr.map(() => '?').join(',')})`); params.push(...arr) }
    }
    if (meal_plan) {
      const arr = String(meal_plan).split(',').filter(Boolean)
      if (arr.length) { conds.push(`meal_plan IN (${arr.map(() => '?').join(',')})`); params.push(...arr) }
    }
    if (req.query.departure_city) {
      const cities = String(req.query.departure_city).split(',').filter(Boolean)
      if (cities.length) { conds.push(`departure_city IN (${cities.map(() => '?').join(',')})`); params.push(...cities) }
    }

    const orderMap = { price_asc: 'price ASC', price_desc: 'price DESC', date_asc: 'departure_date ASC' }
    const orderBy = orderMap[sort] || 'departure_date ASC'
    const where = `WHERE ${conds.join(' AND ')}`

    const countR = await db.query(`SELECT COUNT(*) AS n FROM tours ${where}`, params)
    const total = parseInt(countR.rows[0].n)

    const limitNum  = Math.min(500, Math.max(1, parseInt(limit) || 300))
    const offsetNum = offset ? Math.max(0, parseInt(offset) || 0) : 0

    const cols = 'id, hotel_id, agency, departure_date, return_date, duration, price, transport, meal_plan, adults, departure_city, url, is_last_minute, is_first_minute'
    const pagination = `LIMIT ${limitNum} OFFSET ${offsetNum}`

    const toursR = await db.query(
      `SELECT ${cols} FROM tours ${where} ORDER BY ${orderBy} ${pagination}`,
      params
    )
    const tours = toursR.rows

    const result = { tours, total, hasMore: limitNum ? (offsetNum + tours.length) < total : false }
    toursCache.set(cacheKey, result)
    res.set('X-Cache', 'MISS').json(result)
  } catch (err) {
    console.error('GET /tours error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

module.exports = router
