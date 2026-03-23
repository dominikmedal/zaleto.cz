const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '../../data/zaleto.db')

const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 10000')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS hotels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    agency TEXT NOT NULL DEFAULT 'Fischer',
    name TEXT NOT NULL,
    country TEXT,
    destination TEXT,
    resort_town TEXT,
    stars INTEGER,
    description TEXT,
    thumbnail_url TEXT,
    amenities TEXT,
    food_options TEXT,
    price_includes TEXT,
    latitude REAL,
    longitude REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    agency TEXT NOT NULL DEFAULT 'Fischer',
    departure_date TEXT,
    return_date TEXT,
    duration INTEGER,
    price REAL NOT NULL,
    transport TEXT,
    meal_plan TEXT,
    adults INTEGER DEFAULT 2,
    room_code TEXT,
    url TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_tours_hotel ON tours(hotel_id);
  CREATE INDEX IF NOT EXISTS idx_tours_departure ON tours(departure_date);
  CREATE INDEX IF NOT EXISTS idx_tours_price ON tours(price);
  CREATE INDEX IF NOT EXISTS idx_hotels_slug ON hotels(slug);
  CREATE INDEX IF NOT EXISTS idx_hotels_destination ON hotels(destination);
  CREATE INDEX IF NOT EXISTS idx_hotels_country ON hotels(country);
  CREATE INDEX IF NOT EXISTS idx_tours_covering ON tours(hotel_id, price, departure_date, id);
`)

// Runtime migrations — add columns that may be missing from older DB
const hotelCols = db.pragma('table_info(hotels)').map(c => c.name)
const addIfMissing = (col, def) => {
  if (!hotelCols.includes(col)) db.exec(`ALTER TABLE hotels ADD COLUMN ${col} ${def}`)
}
addIfMissing('photos',              'TEXT')
addIfMissing('review_score',        'REAL')
addIfMissing('tags',                'TEXT')
addIfMissing('distances',           'TEXT')
addIfMissing('place_id',            'TEXT')
addIfMissing('reviews_fetched_at',  'TEXT')
addIfMissing('api_config',          'TEXT')
addIfMissing('canonical_slug',      'TEXT')

// Indexes added after column migrations so canonical_slug exists
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_hotels_canonical_slug ON hotels(canonical_slug);
  CREATE INDEX IF NOT EXISTS idx_tours_hotel_date      ON tours(hotel_id, departure_date);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS destination_photos (
    name       TEXT PRIMARY KEY,
    photo_url  TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hotel_id        INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    source          TEXT NOT NULL DEFAULT 'google',
    author_name     TEXT,
    author_photo    TEXT,
    rating          INTEGER,
    text            TEXT,
    review_date     TEXT,
    language        TEXT,
    cached_at       TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_reviews_hotel ON reviews(hotel_id);
`)

module.exports = db
