const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

// Converts ? placeholders → $1, $2, ... for PostgreSQL
function query(text, params = []) {
  let i = 0
  const sql = text.replace(/\?/g, () => `$${++i}`)
  return pool.query(sql, params)
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hotels (
      id              SERIAL PRIMARY KEY,
      slug            TEXT UNIQUE NOT NULL,
      agency          TEXT NOT NULL DEFAULT 'Fischer',
      name            TEXT NOT NULL,
      country         TEXT,
      destination     TEXT,
      resort_town     TEXT,
      stars           INTEGER,
      description     TEXT,
      thumbnail_url   TEXT,
      amenities       TEXT,
      food_options    TEXT,
      price_includes  TEXT,
      latitude        REAL,
      longitude       REAL,
      photos          TEXT,
      review_score    REAL,
      tags            TEXT,
      distances       TEXT,
      place_id        TEXT,
      reviews_fetched_at TEXT,
      api_config      TEXT,
      canonical_slug  TEXT,
      is_last_minute  INTEGER DEFAULT 0,
      is_first_minute INTEGER DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tours (
      id              SERIAL PRIMARY KEY,
      hotel_id        INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      agency          TEXT NOT NULL DEFAULT 'Fischer',
      departure_date  TEXT,
      return_date     TEXT,
      duration        INTEGER,
      price           REAL NOT NULL,
      transport       TEXT,
      meal_plan       TEXT,
      adults          INTEGER DEFAULT 2,
      room_code       TEXT,
      price_single    REAL,
      url_single      TEXT,
      url             TEXT UNIQUE NOT NULL,
      departure_city  TEXT,
      is_last_minute  INTEGER DEFAULT 0,
      is_first_minute INTEGER DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS hotel_stats (
      hotel_id         INTEGER PRIMARY KEY REFERENCES hotels(id) ON DELETE CASCADE,
      min_price        REAL,
      max_price        REAL,
      available_dates  INTEGER DEFAULT 0,
      next_departure   TEXT,
      has_last_minute  INTEGER DEFAULT 0,
      has_first_minute INTEGER DEFAULT 0,
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS destination_photos (
      name       TEXT PRIMARY KEY,
      photo_url  TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id           SERIAL PRIMARY KEY,
      hotel_id     INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
      source       TEXT NOT NULL DEFAULT 'google',
      author_name  TEXT,
      author_photo TEXT,
      rating       INTEGER,
      text         TEXT,
      review_date  TEXT,
      language     TEXT,
      cached_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_tours_hotel            ON tours(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_tours_departure        ON tours(departure_date);
    CREATE INDEX IF NOT EXISTS idx_tours_price            ON tours(price);
    CREATE INDEX IF NOT EXISTS idx_hotels_slug            ON hotels(slug);
    CREATE INDEX IF NOT EXISTS idx_hotels_destination     ON hotels(destination);
    CREATE INDEX IF NOT EXISTS idx_hotels_country         ON hotels(country);
    CREATE INDEX IF NOT EXISTS idx_tours_covering         ON tours(hotel_id, price, departure_date, id);
    CREATE INDEX IF NOT EXISTS idx_hotels_canonical_slug  ON hotels(canonical_slug);
    CREATE INDEX IF NOT EXISTS idx_tours_hotel_date       ON tours(hotel_id, departure_date);
    CREATE INDEX IF NOT EXISTS idx_tours_meal_plan        ON tours(meal_plan);
    CREATE INDEX IF NOT EXISTS idx_tours_transport        ON tours(transport);
    CREATE INDEX IF NOT EXISTS idx_tours_departure_city   ON tours(departure_city);
    CREATE INDEX IF NOT EXISTS idx_tours_duration         ON tours(duration);
    CREATE INDEX IF NOT EXISTS idx_hotel_stats_price      ON hotel_stats(min_price);
    CREATE INDEX IF NOT EXISTS idx_hotel_stats_next_dep   ON hotel_stats(next_departure);
    CREATE INDEX IF NOT EXISTS idx_tours_dep_price        ON tours(departure_date, price);
    CREATE INDEX IF NOT EXISTS idx_hotels_stars           ON hotels(stars);
    CREATE INDEX IF NOT EXISTS idx_tours_hotel_date_price ON tours(hotel_id, departure_date, price);
    CREATE INDEX IF NOT EXISTS idx_tours_date_hotel_price ON tours(departure_date, hotel_id, price);
    CREATE INDEX IF NOT EXISTS idx_reviews_hotel          ON reviews(hotel_id);
  `)

  // Populate hotel_stats on first run if empty
  await pool.query(`
    INSERT INTO hotel_stats
      (hotel_id, min_price, max_price, available_dates, next_departure, has_last_minute, has_first_minute)
    SELECT
      hotel_id,
      MIN(price),
      MAX(price),
      COUNT(*)::integer,
      MIN(departure_date),
      MAX(COALESCE(is_last_minute, 0)),
      MAX(COALESCE(is_first_minute, 0))
    FROM tours
    WHERE price > 0 AND departure_date >= CURRENT_DATE::text
    GROUP BY hotel_id
    ON CONFLICT (hotel_id) DO NOTHING
  `)

  console.log('[db] schema OK')
}

async function runMaintenance() {
  try {
    const r = await pool.query(`
      SELECT COUNT(*) AS n FROM tours WHERE departure_date < CURRENT_DATE::text
    `)
    const expired = parseInt(r.rows[0].n)
    if (expired > 0) {
      await pool.query(`DELETE FROM tours WHERE departure_date < CURRENT_DATE::text`)
      console.log(`[db] deleted ${expired} expired tours`)
    }
  } catch (e) {
    console.error('[db] cleanup error:', e.message)
  }
}

module.exports = { query, pool, initSchema, runMaintenance }
