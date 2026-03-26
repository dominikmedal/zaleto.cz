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
db.pragma('cache_size = -32000')      // 32 MB page cache (default ~2 MB)
db.pragma('temp_store = MEMORY')      // temp tabulky v RAM místo na disku
db.pragma('mmap_size = 268435456')    // 256 MB memory-mapped I/O
db.pragma('synchronous = NORMAL')     // bezpečné s WAL, rychlejší než FULL

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

addIfMissing('is_last_minute',  'INTEGER DEFAULT 0')
addIfMissing('is_first_minute', 'INTEGER DEFAULT 0')

// Indexes added after column migrations so canonical_slug exists
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_hotels_canonical_slug  ON hotels(canonical_slug);
  CREATE INDEX IF NOT EXISTS idx_tours_hotel_date       ON tours(hotel_id, departure_date);
  CREATE INDEX IF NOT EXISTS idx_tours_meal_plan        ON tours(meal_plan);
  CREATE INDEX IF NOT EXISTS idx_tours_transport        ON tours(transport);
  CREATE INDEX IF NOT EXISTS idx_tours_departure_city   ON tours(departure_city);
  CREATE INDEX IF NOT EXISTS idx_tours_duration         ON tours(duration);
`)

// Předpočítaná statistická tabulka — základ pro rychlé dotazy bez GROUP BY
db.exec(`
  CREATE TABLE IF NOT EXISTS hotel_stats (
    hotel_id        INTEGER PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
    min_price       REAL,
    max_price       REAL,
    available_dates INTEGER DEFAULT 0,
    next_departure  TEXT,
    has_last_minute  INTEGER DEFAULT 0,
    has_first_minute INTEGER DEFAULT 0,
    updated_at      TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_hotel_stats_price   ON hotel_stats(min_price);
  CREATE INDEX IF NOT EXISTS idx_hotel_stats_next_dep ON hotel_stats(next_departure);
`)

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tours_dep_price        ON tours(departure_date, price);
  CREATE INDEX IF NOT EXISTS idx_hotels_stars           ON hotels(stars);

  -- Covering index pro slow-path aggregaci (hotel-first): pro dané hotel_id skenuje
  -- departure_date range a čte price přímo z indexu bez přístupu do tabulky
  CREATE INDEX IF NOT EXISTS idx_tours_hotel_date_price ON tours(hotel_id, departure_date, price);

  -- Covering index pro date-first scany (bez destination filtru): skenuje date range,
  -- vrací hotel_id a price z indexu — eliminuje table lookup při GROUP BY
  CREATE INDEX IF NOT EXISTS idx_tours_date_hotel_price ON tours(departure_date, hotel_id, price);
`)

// Aktualizace statistik pro query planner — bez toho SQLite nemusí vybrat správný index
db.pragma('optimize')

// Migrace sloupců v tours (přidány skrz scraper, mohou chybět ve starém DB)
const tourCols = db.pragma('table_info(tours)').map(c => c.name)
const addTourIfMissing = (col, def) => {
  if (!tourCols.includes(col)) db.exec(`ALTER TABLE tours ADD COLUMN ${col} ${def}`)
}
addTourIfMissing('departure_city',  'TEXT')
addTourIfMissing('is_last_minute',  'INTEGER DEFAULT 0')
addTourIfMissing('is_first_minute', 'INTEGER DEFAULT 0')

// Mazání prošlých termínů — zmenší tabulku, zrychlí GROUP BY i indexy
// Ponechává 1 den buffer. Spouští se při startu, ale jen pokud je co smazat.
{
  const expired = db.prepare("SELECT COUNT(*) AS n FROM tours WHERE departure_date < date('now', '-1 day')").get().n
  if (expired > 0) {
    db.prepare("DELETE FROM tours WHERE departure_date < date('now', '-1 day')").run()
    db.exec('PRAGMA optimize')
  }
}

// Inicializace hotel_stats při prvním spuštění
const statsEmpty = db.prepare('SELECT COUNT(*) AS n FROM hotel_stats').get().n === 0
if (statsEmpty) {
  db.exec(`
    INSERT OR REPLACE INTO hotel_stats
      (hotel_id, min_price, max_price, available_dates, next_departure, has_last_minute, has_first_minute)
    SELECT
      hotel_id,
      MIN(price),
      MAX(price),
      COUNT(*),
      MIN(departure_date),
      MAX(COALESCE(is_last_minute, 0)),
      MAX(COALESCE(is_first_minute, 0))
    FROM tours
    WHERE price > 0 AND departure_date >= date('now')
    GROUP BY hotel_id
  `)
}

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
