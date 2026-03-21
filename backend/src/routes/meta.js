const express = require('express')
const router = express.Router()
const db = require('../db')

// GET /api/destinations
router.get('/destinations', (req, res) => {
  const rows = db.prepare(`
    SELECT h.country, h.destination, h.resort_town, COUNT(DISTINCT h.id) as hotel_count
    FROM hotels h
    INNER JOIN tours t ON t.hotel_id = h.id
    WHERE h.destination IS NOT NULL
    GROUP BY h.country, h.destination, h.resort_town
    ORDER BY h.country, h.destination, hotel_count DESC
  `).all()
  res.json(rows)
})

// GET /api/filters — available filter options
router.get('/filters', (req, res) => {
  const mealPlans = db.prepare(
    `SELECT DISTINCT meal_plan, COUNT(*) as count FROM tours WHERE meal_plan IS NOT NULL AND meal_plan != '' GROUP BY meal_plan ORDER BY count DESC`
  ).all()

  const priceRange = db.prepare(
    `SELECT MIN(t.price) as min, MAX(t.price) as max FROM tours t INNER JOIN hotels h ON h.id = t.hotel_id WHERE t.price > 0`
  ).get()

  const durations = db.prepare(
    `SELECT DISTINCT duration, COUNT(*) as count FROM tours WHERE duration IS NOT NULL GROUP BY duration ORDER BY duration ASC`
  ).all()

  const stars = db.prepare(
    `SELECT DISTINCT stars, COUNT(*) as count FROM hotels WHERE stars IS NOT NULL GROUP BY stars ORDER BY stars ASC`
  ).all()

  const transports = db.prepare(
    `SELECT DISTINCT transport, COUNT(*) as count FROM tours WHERE transport IS NOT NULL AND transport != '' GROUP BY transport ORDER BY count DESC`
  ).all()

  const { total_tours } = db.prepare(`SELECT COUNT(*) AS total_tours FROM tours`).get()

  const departureCities = db.prepare(
    `SELECT DISTINCT departure_city, COUNT(*) as count FROM tours WHERE departure_city IS NOT NULL AND departure_city != '' GROUP BY departure_city ORDER BY count DESC`
  ).all()

  res.json({ mealPlans, priceRange, durations, stars, transports, totalTours: total_tours, departureCities })
})

// GET /api/calendar-prices?date_from=2026-03-01&date_to=2026-05-31[&destination=xxx]
router.get('/calendar-prices', (req, res) => {
  try {
    const { date_from, date_to, destination } = req.query
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' })
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRe.test(date_from) || !dateRe.test(date_to)) return res.status(400).json({ error: 'Invalid date format' })

    const params = [date_from, date_to]
    const destJoin = destination ? 'INNER JOIN hotels h ON h.id = t.hotel_id' : ''
    const destCond = destination ? 'AND h.destination LIKE ?' : ''
    if (destination) params.push(`%${destination}%`)

    const rows = db.prepare(`
      SELECT t.departure_date AS date, MIN(t.price) AS min_price, COUNT(*) AS tour_count
      FROM tours t ${destJoin}
      WHERE t.departure_date >= ? AND t.departure_date <= ?
        AND t.price > 0 AND t.departure_date IS NOT NULL
        ${destCond}
      GROUP BY t.departure_date
      ORDER BY t.departure_date ASC
    `).all(params)

    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Database error' })
  }
})

module.exports = router
