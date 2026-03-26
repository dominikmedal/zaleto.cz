const express = require('express')
const router = express.Router()
const db = require('../db')
const { metaCache } = require('../cache')

// GET /api/destinations
router.get('/destinations', async (req, res) => {
  const cached = metaCache.get('destinations')
  if (cached) return res.json(cached)

  try {
    const r = await db.query(`
      SELECT h.country, h.destination, h.resort_town, COUNT(DISTINCT h.id)::integer AS hotel_count
      FROM hotels h
      INNER JOIN hotel_stats s ON s.hotel_id = h.id
      WHERE h.destination IS NOT NULL
      GROUP BY h.country, h.destination, h.resort_town
      ORDER BY h.country, h.destination, hotel_count DESC
    `)
    metaCache.set('destinations', r.rows)
    res.json(r.rows)
  } catch (err) {
    console.error('GET /destinations error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/filters — available filter options
router.get('/filters', async (req, res) => {
  const cached = metaCache.get('filters')
  if (cached) return res.json(cached)

  try {
    const [mealR, priceR, durR, starsR, transR, totalR, cityR] = await Promise.all([
      db.query(`SELECT meal_plan, COUNT(*)::integer AS count FROM tours WHERE meal_plan IS NOT NULL AND meal_plan != '' GROUP BY meal_plan ORDER BY count DESC`),
      db.query(`SELECT MIN(min_price) AS min, MAX(max_price) AS max FROM hotel_stats WHERE min_price > 0`),
      db.query(`SELECT duration, COUNT(*)::integer AS count FROM tours WHERE duration IS NOT NULL GROUP BY duration ORDER BY duration ASC`),
      db.query(`SELECT stars, COUNT(*)::integer AS count FROM hotels WHERE stars IS NOT NULL GROUP BY stars ORDER BY stars ASC`),
      db.query(`SELECT transport, COUNT(*)::integer AS count FROM tours WHERE transport IS NOT NULL AND transport != '' GROUP BY transport ORDER BY count DESC`),
      db.query(`SELECT COUNT(*)::integer AS total_tours FROM tours`),
      db.query(`SELECT departure_city, COUNT(*)::integer AS count FROM tours WHERE departure_city IS NOT NULL AND departure_city != '' GROUP BY departure_city ORDER BY count DESC`),
    ])

    const result = {
      mealPlans:      mealR.rows,
      priceRange:     priceR.rows[0],
      durations:      durR.rows,
      stars:          starsR.rows,
      transports:     transR.rows,
      totalTours:     totalR.rows[0].total_tours,
      departureCities: cityR.rows,
    }
    metaCache.set('filters', result)
    res.json(result)
  } catch (err) {
    console.error('GET /filters error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

// GET /api/calendar-prices?date_from=2026-03-01&date_to=2026-05-31[&destination=xxx]
router.get('/calendar-prices', async (req, res) => {
  try {
    const { date_from, date_to, destination } = req.query
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' })
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRe.test(date_from) || !dateRe.test(date_to)) return res.status(400).json({ error: 'Invalid date format' })

    const calKey = `cal_${date_from}_${date_to}_${destination || ''}`
    const cached = metaCache.get(calKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const params = [date_from, date_to]
    const destJoin = destination ? 'INNER JOIN hotels h ON h.id = t.hotel_id' : ''
    const destCond = destination ? 'AND h.destination ILIKE ?' : ''
    if (destination) params.push(`%${destination}%`)

    const r = await db.query(`
      SELECT t.departure_date AS date, MIN(t.price) AS min_price, COUNT(*)::integer AS tour_count
      FROM tours t ${destJoin}
      WHERE t.departure_date >= ? AND t.departure_date <= ?
        AND t.price > 0 AND t.departure_date IS NOT NULL
        ${destCond}
      GROUP BY t.departure_date
      ORDER BY t.departure_date ASC
    `, params)

    metaCache.set(calKey, r.rows)
    res.set('X-Cache', 'MISS').json(r.rows)
  } catch (err) {
    console.error('GET /calendar-prices error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

module.exports = router
