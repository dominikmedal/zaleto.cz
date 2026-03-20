#!/usr/bin/env node
/**
 * Import data from old tours.db into new zaleto.db
 * Usage: node backend/src/import.js <path-to-old-db>
 */
require('dotenv').config({ path: './backend/.env' })
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const OLD_DB_PATH = process.argv[2] || 'C:/cestovando-web/cestovando-web/zaleto-backend/tours.db'
const NEW_DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '../../data/zaleto.db')

if (!fs.existsSync(OLD_DB_PATH)) {
  console.error('Old DB not found:', OLD_DB_PATH)
  process.exit(1)
}

const dataDir = path.dirname(NEW_DB_PATH)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// Load new DB (will create schema via db.js)
process.env.DATABASE_PATH = NEW_DB_PATH
const newDb = require('./db')

const oldDb = new Database(OLD_DB_PATH, { readonly: true })

// Read all tours from old DB (all agencies)
const oldTours = oldDb.prepare(`
  SELECT * FROM tours
  WHERE hotel_name IS NOT NULL AND hotel_name != ''
  AND price > 0
  ORDER BY agency, hotel_name, departure_date
`).all()

console.log(`Found ${oldTours.length} tours in old DB`)

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const insertHotel = newDb.prepare(`
  INSERT OR IGNORE INTO hotels (slug, agency, name, country, destination, resort_town, stars, description, thumbnail_url, amenities, food_options, price_includes, latitude, longitude)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertTour = newDb.prepare(`
  INSERT OR IGNORE INTO tours (hotel_id, agency, departure_date, return_date, duration, price, transport, meal_plan, adults, url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const getHotel = newDb.prepare('SELECT id FROM hotels WHERE slug = ?')

let hotelCount = 0
let tourCount = 0
let errorCount = 0

const importAll = newDb.transaction(() => {
  // Group by hotel_name
  const hotelMap = new Map()
  for (const t of oldTours) {
    if (!hotelMap.has(t.hotel_name)) hotelMap.set(t.hotel_name, [])
    hotelMap.get(t.hotel_name).push(t)
  }

  for (const [hotelName, tours] of hotelMap) {
    const first = tours[0]
    let slug = slugify(hotelName)
    // Ensure uniqueness with hotel_stars or id
    let candidate = slug
    let suffix = 1
    while (getHotel.get(candidate) && suffix < 100) {
      candidate = `${slug}-${suffix++}`
    }
    slug = candidate

    // Extract country from destination path (e.g. "Italie / Toskánsko / ...")
    const destParts = (first.destination || '').split('/').map(s => s.trim()).filter(Boolean)
    const country = destParts[0] || null
    const destination = destParts[0] || first.destination || null

    try {
      // Combine location + description for hotel description
      const desc = [first.location, first.description].filter(Boolean).join('\n\n') || null
      insertHotel.run(
        slug, first.agency || 'Fischer', hotelName,
        country, destination, first.resort_town || null,
        first.hotel_stars || null, desc,
        first.thumbnail_url || null, first.amenities || null,
        first.food || null, first.price_includes || null,
        first.latitude || null, first.longitude || null
      )
      hotelCount++
    } catch (e) {
      errorCount++
    }

    const hotel = getHotel.get(slug)
    if (!hotel) continue

    for (const t of tours) {
      try {
        insertTour.run(
          hotel.id, t.agency || 'Fischer',
          t.departure_date ? t.departure_date.split('T')[0] : null,
          t.return_date ? t.return_date.split('T')[0] : null,
          t.duration || null, t.price, t.transport || null,
          t.meal_plan || null, 2, t.url
        )
        tourCount++
      } catch (e) {
        // Duplicate URL is OK
      }
    }
  }
})

importAll()

console.log(`Import complete:`)
console.log(`   Hotels: ${hotelCount}`)
console.log(`   Tours:  ${tourCount}`)
if (errorCount) console.log(`   Errors: ${errorCount}`)
console.log(`\nNew DB: ${NEW_DB_PATH}`)

oldDb.close()
