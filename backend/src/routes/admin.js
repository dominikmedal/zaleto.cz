/**
 * admin.js — Admin API pro zaleto.cz
 *
 * Chráněno Bearer tokenem (env: ADMIN_PASSWORD).
 * Endpointy:
 *   POST   /api/admin/auth/login
 *   GET    /api/admin/stats
 *   GET    /api/admin/hotels
 *   PUT    /api/admin/hotels/:id
 *   DELETE /api/admin/hotels/:id
 *   GET    /api/admin/tours
 *   DELETE /api/admin/tours/:id
 *   GET    /api/admin/articles
 *   POST   /api/admin/articles
 *   PUT    /api/admin/articles/:id
 *   DELETE /api/admin/articles/:id
 *   GET    /api/admin/destinations
 *   PUT    /api/admin/destinations/:name
 *   GET    /api/admin/car-destinations
 *   POST   /api/admin/car-destinations
 *   PUT    /api/admin/car-destinations/:id
 *   DELETE /api/admin/car-destinations/:id
 *   POST   /api/admin/upload
 */

const express = require('express')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const db      = require('../db')
const { metaCache } = require('../cache')

const router = express.Router()

// ── Auth ─────────────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Zaleto123.'

function adminAuth(req, res, next) {
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).json({ error: 'Neautorizováno' })
  }
  next()
}

// ── File upload ───────────────────────────────────────────────────────────────

// On Railway: store in /data/uploads (persistent volume). Locally: backend/uploads/
const UPLOADS_DIR = process.env.UPLOADS_DIR
  || (process.env.NODE_ENV === 'production' ? '/data/uploads' : path.join(__dirname, '../../uploads'))
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true)
    else cb(new Error('Podporovány jsou pouze obrázky (JPEG, PNG, WebP)'))
  },
})

// ── Login ─────────────────────────────────────────────────────────────────────

router.post('/auth/login', (req, res) => {
  const { password } = req.body || {}
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true, token: ADMIN_PASSWORD })
  } else {
    res.status(401).json({ error: 'Nesprávné heslo' })
  }
})

router.get('/auth/check', adminAuth, (_req, res) => res.json({ ok: true }))

// ── Dashboard stats ───────────────────────────────────────────────────────────

router.get('/stats', adminAuth, async (_req, res) => {
  try {
    const [hotels, tours, articles, destinations, photos] = await Promise.all([
      db.query('SELECT COUNT(*) AS n, COUNT(DISTINCT agency) AS agencies FROM hotels'),
      db.query("SELECT COUNT(*) AS n FROM tours WHERE departure_date >= CURRENT_DATE::text"),
      db.query('SELECT COUNT(*) AS n FROM articles'),
      db.query('SELECT COUNT(*) AS n FROM destination_photos'),
      db.query('SELECT COUNT(*) AS n FROM destination_photos WHERE photo_url LIKE ?', ['/uploads/%']),
    ])
    const [minPrice] = await Promise.all([
      db.query('SELECT MIN(min_price) AS v FROM hotel_stats WHERE min_price IS NOT NULL'),
    ])
    const recentHotels = await db.query(
      'SELECT id, slug, name, agency, country, stars, updated_at FROM hotels ORDER BY updated_at DESC LIMIT 8'
    )
    const recentArticles = await db.query(
      'SELECT id, slug, title, category, location, published_at FROM articles ORDER BY published_at DESC LIMIT 6'
    )
    res.json({
      hotels:       parseInt(hotels.rows[0].n),
      agencies:     parseInt(hotels.rows[0].agencies),
      tours:        parseInt(tours.rows[0].n),
      articles:     parseInt(articles.rows[0].n),
      destinations: parseInt(destinations.rows[0].n),
      customPhotos: parseInt(photos.rows[0].n),
      minPrice:     parseFloat(minPrice.rows[0].v) || null,
      recentHotels: recentHotels.rows,
      recentArticles: recentArticles.rows,
    })
  } catch (e) {
    console.error('[admin] stats error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── Hotels ────────────────────────────────────────────────────────────────────

router.get('/hotels', adminAuth, async (req, res) => {
  try {
    const { q = '', agency = '', page = '1', limit = '50' } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const params = []
    const conds  = []

    if (q) {
      conds.push(`(h.name ILIKE ? OR h.slug ILIKE ? OR h.country ILIKE ? OR h.resort_town ILIKE ?)`)
      const like = `%${q}%`
      params.push(like, like, like, like)
    }
    if (agency) { conds.push('h.agency = ?'); params.push(agency) }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT h.id, h.slug, h.name, h.agency, h.country, h.destination, h.resort_town,
                h.stars, h.thumbnail_url, h.review_score,
                s.min_price, s.available_dates, s.next_departure, h.updated_at
         FROM hotels h
         LEFT JOIN hotel_stats s ON s.hotel_id = h.id
         ${where}
         ORDER BY h.updated_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      ),
      db.query(`SELECT COUNT(*) AS n FROM hotels h ${where}`, params),
    ])
    res.json({ hotels: rows.rows, total: parseInt(total.rows[0].n), page: parseInt(page), limit: parseInt(limit) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/hotels', adminAuth, async (req, res) => {
  try {
    const { name, agency = 'Ruční', country, destination, resort_town, stars, thumbnail_url, description } = req.body
    if (!name) return res.status(400).json({ error: 'name je povinné' })
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
      + '-' + Date.now().toString(36)
    await db.query(
      `INSERT INTO hotels (slug, name, agency, country, destination, resort_town, stars, thumbnail_url, description, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [slug, name, agency, country ?? null, destination ?? null, resort_town ?? null,
       stars ?? null, thumbnail_url ?? null, description ?? null]
    )
    res.json({ ok: true, slug })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/hotels/:id', adminAuth, async (req, res) => {
  try {
    const { name, agency, country, destination, resort_town, stars, thumbnail_url, description } = req.body
    await db.query(
      `UPDATE hotels SET
         name         = COALESCE(?, name),
         agency       = COALESCE(?, agency),
         country      = COALESCE(?, country),
         destination  = COALESCE(?, destination),
         resort_town  = COALESCE(?, resort_town),
         stars        = COALESCE(?, stars),
         thumbnail_url = COALESCE(?, thumbnail_url),
         description  = COALESCE(?, description),
         updated_at   = NOW()
       WHERE id = ?`,
      [name ?? null, agency ?? null, country ?? null, destination ?? null, resort_town ?? null,
       stars ?? null, thumbnail_url ?? null, description ?? null, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/hotels/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM tours WHERE hotel_id = ?', [req.params.id])
    await db.query('DELETE FROM hotel_stats WHERE hotel_id = ?', [req.params.id])
    await db.query('DELETE FROM hotels WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Tours ─────────────────────────────────────────────────────────────────────

router.get('/tours', adminAuth, async (req, res) => {
  try {
    const { q = '', agency = '', page = '1', limit = '50' } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const params = []
    const conds  = ["t.departure_date >= CURRENT_DATE::text"]

    if (q) {
      conds.push(`(h.name ILIKE ? OR h.country ILIKE ?)`)
      const like = `%${q}%`
      params.push(like, like)
    }
    if (agency) { conds.push('t.agency = ?'); params.push(agency) }

    const where = `WHERE ${conds.join(' AND ')}`
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT t.id, t.agency, t.departure_date, t.return_date, t.duration,
                t.price, t.transport, t.meal_plan, t.adults, t.departure_city,
                h.name AS hotel_name, h.country, h.resort_town, h.slug AS hotel_slug
         FROM tours t
         JOIN hotels h ON h.id = t.hotel_id
         ${where}
         ORDER BY t.departure_date ASC, t.price ASC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      ),
      db.query(
        `SELECT COUNT(*) AS n FROM tours t JOIN hotels h ON h.id = t.hotel_id ${where}`,
        params
      ),
    ])
    res.json({ tours: rows.rows, total: parseInt(total.rows[0].n), page: parseInt(page), limit: parseInt(limit) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/tours', adminAuth, async (req, res) => {
  try {
    const { hotel_id, agency = 'Ruční', departure_date, return_date, duration, price,
            transport, meal_plan, adults = 2, departure_city, url } = req.body
    if (!hotel_id || !departure_date || !price) return res.status(400).json({ error: 'hotel_id, departure_date a price jsou povinné' })
    const tourUrl = url || `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await db.query(
      `INSERT INTO tours (hotel_id, agency, departure_date, return_date, duration, price, transport, meal_plan, adults, departure_city, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [hotel_id, agency, departure_date, return_date ?? null, duration ?? null, price,
       transport ?? null, meal_plan ?? null, adults, departure_city ?? null, tourUrl]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/tours/:id', adminAuth, async (req, res) => {
  try {
    const { departure_date, return_date, duration, price, transport, meal_plan, adults, departure_city, agency } = req.body
    await db.query(
      `UPDATE tours SET
         departure_date = COALESCE(?, departure_date),
         return_date    = COALESCE(?, return_date),
         duration       = COALESCE(?, duration),
         price          = COALESCE(?, price),
         transport      = COALESCE(?, transport),
         meal_plan      = COALESCE(?, meal_plan),
         adults         = COALESCE(?, adults),
         departure_city = COALESCE(?, departure_city),
         agency         = COALESCE(?, agency),
         updated_at     = NOW()
       WHERE id = ?`,
      [departure_date ?? null, return_date ?? null, duration ?? null, price ?? null,
       transport ?? null, meal_plan ?? null, adults ?? null, departure_city ?? null,
       agency ?? null, req.params.id]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/tours/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM tours WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Articles ──────────────────────────────────────────────────────────────────

router.get('/articles', adminAuth, async (req, res) => {
  try {
    const { q = '', page = '1', limit = '50' } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const params = []
    const conds  = []
    if (q) {
      conds.push(`(title ILIKE ? OR topic ILIKE ? OR location ILIKE ?)`)
      const like = `%${q}%`
      params.push(like, like, like)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT id, slug, topic, title, category, location, excerpt, reading_time,
                custom_image_url, published_at, generated_at
         FROM articles ${where}
         ORDER BY published_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      ),
      db.query(`SELECT COUNT(*) AS n FROM articles ${where}`, params),
    ])
    res.json({ articles: rows.rows, total: parseInt(total.rows[0].n) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/articles', adminAuth, async (req, res) => {
  try {
    const { title, topic, excerpt, content, category, location, reading_time, custom_image_url } = req.body
    if (!title) return res.status(400).json({ error: 'title je povinné' })
    const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
      + '-' + Date.now().toString(36)
    const topicVal = topic || title
    await db.query(
      `INSERT INTO articles (topic, slug, title, category, location, excerpt, content, reading_time, custom_image_url, published_at, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [topicVal, slug, title, category ?? null, location ?? null, excerpt ?? null,
       content ?? null, reading_time ?? 5, custom_image_url ?? null]
    )
    metaCache.deletePrefix('articles_')
    metaCache.delete('article_slugs')
    res.json({ ok: true, slug })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/articles/:id', adminAuth, async (req, res) => {
  try {
    const { title, excerpt, content, category, location, reading_time, custom_image_url } = req.body
    await db.query(
      `UPDATE articles SET
         title            = COALESCE(?, title),
         excerpt          = COALESCE(?, excerpt),
         content          = COALESCE(?, content),
         category         = COALESCE(?, category),
         location         = COALESCE(?, location),
         reading_time     = COALESCE(?, reading_time),
         custom_image_url = ?
       WHERE id = ?`,
      [title ?? null, excerpt ?? null, content ?? null, category ?? null,
       location ?? null, reading_time ?? null, custom_image_url ?? null, req.params.id]
    )
    // Invalidate backend cache for this article + article lists
    const slugRow = await db.query('SELECT slug FROM articles WHERE id = ?', [req.params.id])
    if (slugRow.rows[0]) metaCache.delete(`article_${slugRow.rows[0].slug}`)
    metaCache.deletePrefix('articles_')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/articles/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM articles WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Destinations ──────────────────────────────────────────────────────────────

router.get('/destinations', adminAuth, async (req, res) => {
  try {
    const { q = '', page = '1', limit = '50' } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const params = []
    const conds  = []
    if (q) { conds.push('dp.name ILIKE ?'); params.push(`%${q}%`) }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT dp.name, dp.photo_url, dp.updated_at,
                ai.description IS NOT NULL AS has_ai
         FROM destination_photos dp
         LEFT JOIN destination_ai ai ON ai.name = dp.name
         ${where}
         ORDER BY dp.name ASC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      ),
      db.query(`SELECT COUNT(*) AS n FROM destination_photos dp ${where}`, params),
    ])
    res.json({ destinations: rows.rows, total: parseInt(total.rows[0].n) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.put('/destinations/:name', adminAuth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const { photo_url } = req.body
    if (!photo_url) return res.status(400).json({ error: 'photo_url je povinné' })
    await db.query(
      `INSERT INTO destination_photos (name, photo_url, updated_at)
       VALUES (?, ?, NOW())
       ON CONFLICT (name) DO UPDATE SET photo_url = EXCLUDED.photo_url, updated_at = NOW()`,
      [name, photo_url]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Car destinations ──────────────────────────────────────────────────────────

// Ensure table exists on first use
async function ensureCarDestinationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS car_destinations (
      id           SERIAL PRIMARY KEY,
      slug         VARCHAR(120) UNIQUE NOT NULL,
      name         VARCHAR(255) NOT NULL,
      country      VARCHAR(100) NOT NULL,
      country_slug VARCHAR(100) NOT NULL,
      dc_path      VARCHAR(255) NOT NULL DEFAULT '',
      dc_search_term VARCHAR(255) NOT NULL DEFAULT '',
      popular      BOOLEAN NOT NULL DEFAULT FALSE,
      active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

router.get('/car-destinations', adminAuth, async (req, res) => {
  try {
    await ensureCarDestinationsTable()
    const { q = '', page = '1', limit = '50' } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)
    const params = []
    const conds  = []
    if (q) {
      conds.push('(name ILIKE ? OR country ILIKE ? OR slug ILIKE ?)')
      const like = `%${q}%`
      params.push(like, like, like)
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT id, slug, name, country, country_slug, dc_path, dc_search_term, popular, active, updated_at
         FROM car_destinations ${where}
         ORDER BY country ASC, name ASC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      ),
      db.query(`SELECT COUNT(*) AS n FROM car_destinations ${where}`, params),
    ])
    res.json({ destinations: rows.rows, total: parseInt(total.rows[0].n) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/car-destinations', adminAuth, async (req, res) => {
  try {
    await ensureCarDestinationsTable()
    const { slug, name, country, country_slug, dc_path = '', dc_search_term = '', popular = false } = req.body
    if (!slug || !name || !country || !country_slug) {
      return res.status(400).json({ error: 'slug, name, country, country_slug jsou povinné' })
    }
    const { rows } = await db.query(
      `INSERT INTO car_destinations (slug, name, country, country_slug, dc_path, dc_search_term, popular)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [slug, name, country, country_slug, dc_path, dc_search_term, popular]
    )
    res.json({ ok: true, id: rows[0].id })
  } catch (e) {
    if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
      return res.status(409).json({ error: `Slug "${req.body.slug}" již existuje` })
    }
    res.status(500).json({ error: e.message })
  }
})

router.put('/car-destinations/:id', adminAuth, async (req, res) => {
  try {
    await ensureCarDestinationsTable()
    const { slug, name, country, country_slug, dc_path, dc_search_term, popular, active } = req.body
    await db.query(
      `UPDATE car_destinations
       SET slug = COALESCE(?, slug),
           name = COALESCE(?, name),
           country = COALESCE(?, country),
           country_slug = COALESCE(?, country_slug),
           dc_path = COALESCE(?, dc_path),
           dc_search_term = COALESCE(?, dc_search_term),
           popular = COALESCE(?, popular),
           active = COALESCE(?, active),
           updated_at = NOW()
       WHERE id = ?`,
      [slug ?? null, name ?? null, country ?? null, country_slug ?? null,
       dc_path ?? null, dc_search_term ?? null,
       popular != null ? popular : null, active != null ? active : null,
       req.params.id]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/car-destinations/:id', adminAuth, async (req, res) => {
  try {
    await ensureCarDestinationsTable()
    await db.query('DELETE FROM car_destinations WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Image upload ──────────────────────────────────────────────────────────────

router.post('/upload', adminAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Žádný soubor' })
    const ext      = path.extname(req.file.originalname).toLowerCase() || '.jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    const filepath = path.join(UPLOADS_DIR, filename)
    fs.writeFileSync(filepath, req.file.buffer)
    // Store relative path — frontend prepends NEXT_PUBLIC_API_URL
    res.json({ ok: true, url: `/uploads/${filename}`, filename })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
module.exports.UPLOADS_DIR = UPLOADS_DIR
