const express = require('express')
const router = express.Router({ mergeParams: true })
const db = require('../db')

// GET /api/hotels/:slug/tours  — all available dates for a hotel
router.get('/', (req, res) => {
  try {
    const { slug } = req.params
    const { date_from, date_to, adults, duration, meal_plan, sort = 'price_asc' } = req.query

    const hotel = db.prepare('SELECT id, canonical_slug FROM hotels WHERE slug = ?').get(slug)
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })

    // Multi-agency: pokud canonical_slug existuje, načti termíny od všech CK s tímto slugem.
    // Fallback na hotel_id pokud canonical_slug ještě není nastaven (před prvním run_all.py).
    const canonicalSlug = hotel.canonical_slug || null
    const conds = canonicalSlug
      ? [`hotel_id IN (SELECT id FROM hotels WHERE canonical_slug = ?)`, "departure_date >= date('now')"]
      : ['hotel_id = ?', "departure_date >= date('now')"]
    const params = [canonicalSlug || hotel.id]

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
      if (cities.length) {
        conds.push(`departure_city IN (${cities.map(() => '?').join(',')})`)
        params.push(...cities)
      }
    }

    const orderMap = { price_asc: 'price ASC', price_desc: 'price DESC', date_asc: 'departure_date ASC' }
    const orderBy = orderMap[sort] || 'departure_date ASC'

    const tours = db.prepare(
      `SELECT * FROM tours WHERE ${conds.join(' AND ')} ORDER BY ${orderBy}`
    ).all(...params)

    res.json({ tours })
  } catch (err) {
    res.status(500).json({ error: 'Database error' })
  }
})

module.exports = router
