import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { put } from '@vercel/blob'
import { query } from './db'
import { metaCache } from './cache'
import { searchUnsplash, registerDownload } from './unsplash'

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AdminResult = { status: number; body: unknown }
const ok = (body: unknown = { ok: true }): AdminResult => ({ status: 200, body })
const fail = (status: number, error: string): AdminResult => ({ status, body: { error } })

// ── Auth ────────────────────────────────────────────────────────────────────
// Heslo se nikdy neukládá v prohlížeči: klient dostane HMAC token odvozený z hesla.
// Bez ADMIN_PASSWORD admin nefunguje (žádné výchozí heslo).

function expectedToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return null
  return createHmac('sha256', pw).update('zaleto-admin-v1').digest('hex')
}
function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
export function isAuthorized(authHeader: string | null): boolean {
  const exp = expectedToken()
  if (!exp) return false
  return safeEqual(authHeader ?? '', `Bearer ${exp}`)
}
function login(body: any): AdminResult {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) return fail(503, 'ADMIN_PASSWORD není nastavená')
  if (typeof body?.password === 'string' && safeEqual(body.password, pw)) return ok({ ok: true, token: expectedToken() })
  return fail(401, 'Nesprávné heslo')
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const n = (v: unknown) => (v === undefined ? null : v)
const int = (v: string | null | undefined, d: number) => parseInt(v ?? '') || d
const slugOf = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80) + '-' + Date.now().toString(36)

function paging(sp: URLSearchParams) {
  const page = Math.max(1, int(sp.get('page'), 1))
  const limit = Math.min(200, Math.max(1, int(sp.get('limit'), 50)))
  return { page, limit, offset: (page - 1) * limit }
}

function afterArticleChange(slug?: string) {
  metaCache.deletePrefix('articles_')
  metaCache.delete('article_slugs')
  if (slug) metaCache.delete(`article_${slug}`)
  try { revalidateTag('articles'); if (slug) { revalidateTag(`article-${slug}`); revalidatePath(`/clanky/${slug}`) } revalidatePath('/clanky') } catch { /* mimo request kontext */ }
}

async function ensureCarDestinationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS car_destinations (
      id SERIAL PRIMARY KEY, slug VARCHAR(120) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL,
      country VARCHAR(100) NOT NULL, country_slug VARCHAR(100) NOT NULL,
      dc_path VARCHAR(255) NOT NULL DEFAULT '', dc_search_term VARCHAR(255) NOT NULL DEFAULT '',
      popular BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
}

// ── Router ──────────────────────────────────────────────────────────────────
/**
 * Rozdělí /api/admin/<segments> na stejné endpointy jako původní Express router.
 * `file` je předaný jen u POST /upload (multipart).
 */
export async function handleAdmin(
  method: string, segments: string[], sp: URLSearchParams, body: any, authHeader: string | null, file?: File | null,
): Promise<AdminResult> {
  const [res, id] = segments
  const key = `${method} ${segments.length === 2 && res !== 'auth' ? `${res}/:id` : segments.join('/')}`

  if (key === 'POST auth/login') return login(body)
  if (!isAuthorized(authHeader)) return fail(401, 'Neautorizováno')
  if (key === 'GET auth/check') return ok()

  try {
    switch (key) {
      case 'GET stats': {
        const [hotels, tours, articles, destinations, photos, minPrice, recentHotels, recentArticles] = await Promise.all([
          query('SELECT COUNT(*) AS n, COUNT(DISTINCT agency) AS agencies FROM hotels'),
          query('SELECT COUNT(*) AS n FROM tours WHERE departure_date >= CURRENT_DATE::text'),
          query('SELECT COUNT(*) AS n FROM articles'),
          query('SELECT COUNT(*) AS n FROM destination_photos'),
          query("SELECT COUNT(*) AS n FROM destination_photos WHERE photo_url NOT LIKE 'http%'"),
          query('SELECT MIN(min_price) AS v FROM hotel_stats WHERE min_price IS NOT NULL'),
          query('SELECT id, slug, name, agency, country, stars, updated_at FROM hotels ORDER BY updated_at DESC LIMIT 8'),
          query('SELECT id, slug, title, category, location, published_at FROM articles ORDER BY published_at DESC LIMIT 6'),
        ])
        return ok({
          hotels: parseInt(hotels.rows[0].n), agencies: parseInt(hotels.rows[0].agencies),
          tours: parseInt(tours.rows[0].n), articles: parseInt(articles.rows[0].n),
          destinations: parseInt(destinations.rows[0].n), customPhotos: parseInt(photos.rows[0].n),
          minPrice: parseFloat(minPrice.rows[0].v) || null,
          recentHotels: recentHotels.rows, recentArticles: recentArticles.rows,
        })
      }

      // ── Hotels ──
      case 'GET hotels': {
        const { page, limit, offset } = paging(sp)
        const q = sp.get('q') ?? '', agency = sp.get('agency') ?? ''
        const params: unknown[] = [], conds: string[] = []
        if (q) { conds.push('(h.name ILIKE ? OR h.slug ILIKE ? OR h.country ILIKE ? OR h.resort_town ILIKE ?)'); const l = `%${q}%`; params.push(l, l, l, l) }
        if (agency) { conds.push('h.agency = ?'); params.push(agency) }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
        const [rows, total] = await Promise.all([
          query(`SELECT h.id, h.slug, h.name, h.agency, h.country, h.destination, h.resort_town, h.stars, h.thumbnail_url, h.review_score,
                        s.min_price, s.available_dates, s.next_departure, h.updated_at
                 FROM hotels h LEFT JOIN hotel_stats s ON s.hotel_id = h.id ${where}
                 ORDER BY h.updated_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
          query(`SELECT COUNT(*) AS n FROM hotels h ${where}`, params),
        ])
        return ok({ hotels: rows.rows, total: parseInt(total.rows[0].n), page, limit })
      }
      case 'POST hotels': {
        const { name, agency = 'Ruční', country, destination, resort_town, stars, thumbnail_url, description } = body ?? {}
        if (!name) return fail(400, 'name je povinné')
        const slug = slugOf(name)
        await query(`INSERT INTO hotels (slug, name, agency, country, destination, resort_town, stars, thumbnail_url, description, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [slug, name, agency, n(country), n(destination), n(resort_town), n(stars), n(thumbnail_url), n(description)])
        return ok({ ok: true, slug })
      }
      case 'PUT hotels/:id': {
        const b = body ?? {}
        await query(`UPDATE hotels SET name = COALESCE(?, name), agency = COALESCE(?, agency), country = COALESCE(?, country),
                       destination = COALESCE(?, destination), resort_town = COALESCE(?, resort_town), stars = COALESCE(?, stars),
                       thumbnail_url = COALESCE(?, thumbnail_url), description = COALESCE(?, description), updated_at = NOW()
                     WHERE id = ?`,
          [n(b.name), n(b.agency), n(b.country), n(b.destination), n(b.resort_town), n(b.stars), n(b.thumbnail_url), n(b.description), id])
        return ok()
      }
      case 'DELETE hotels/:id': {
        await query('DELETE FROM tours WHERE hotel_id = ?', [id])
        await query('DELETE FROM hotel_stats WHERE hotel_id = ?', [id])
        await query('DELETE FROM hotels WHERE id = ?', [id])
        return ok()
      }

      // ── Tours ──
      case 'GET tours': {
        const { page, limit, offset } = paging(sp)
        const q = sp.get('q') ?? '', agency = sp.get('agency') ?? ''
        const params: unknown[] = [], conds = ['t.departure_date >= CURRENT_DATE::text']
        if (q) { conds.push('(h.name ILIKE ? OR h.country ILIKE ?)'); const l = `%${q}%`; params.push(l, l) }
        if (agency) { conds.push('t.agency = ?'); params.push(agency) }
        const where = `WHERE ${conds.join(' AND ')}`
        const [rows, total] = await Promise.all([
          query(`SELECT t.id, t.agency, t.departure_date, t.return_date, t.duration, t.price, t.transport, t.meal_plan, t.adults, t.departure_city,
                        h.name AS hotel_name, h.country, h.resort_town, h.slug AS hotel_slug
                 FROM tours t JOIN hotels h ON h.id = t.hotel_id ${where}
                 ORDER BY t.departure_date ASC, t.price ASC LIMIT ? OFFSET ?`, [...params, limit, offset]),
          query(`SELECT COUNT(*) AS n FROM tours t JOIN hotels h ON h.id = t.hotel_id ${where}`, params),
        ])
        return ok({ tours: rows.rows, total: parseInt(total.rows[0].n), page, limit })
      }
      case 'POST tours': {
        const { hotel_id, agency = 'Ruční', departure_date, return_date, duration, price, transport, meal_plan, adults = 2, departure_city, url } = body ?? {}
        if (!hotel_id || !departure_date || !price) return fail(400, 'hotel_id, departure_date a price jsou povinné')
        const tourUrl = url || `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`
        await query(`INSERT INTO tours (hotel_id, agency, departure_date, return_date, duration, price, transport, meal_plan, adults, departure_city, url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [hotel_id, agency, departure_date, n(return_date), n(duration), price, n(transport), n(meal_plan), adults, n(departure_city), tourUrl])
        return ok()
      }
      case 'PUT tours/:id': {
        const b = body ?? {}
        await query(`UPDATE tours SET departure_date = COALESCE(?, departure_date), return_date = COALESCE(?, return_date),
                       duration = COALESCE(?, duration), price = COALESCE(?, price), transport = COALESCE(?, transport),
                       meal_plan = COALESCE(?, meal_plan), adults = COALESCE(?, adults), departure_city = COALESCE(?, departure_city),
                       agency = COALESCE(?, agency), updated_at = NOW()
                     WHERE id = ?`,
          [n(b.departure_date), n(b.return_date), n(b.duration), n(b.price), n(b.transport), n(b.meal_plan), n(b.adults), n(b.departure_city), n(b.agency), id])
        return ok()
      }
      case 'DELETE tours/:id':
        await query('DELETE FROM tours WHERE id = ?', [id])
        return ok()

      // ── Articles ──
      case 'GET articles': {
        const { limit, offset } = paging(sp)
        const q = sp.get('q') ?? ''
        const params: unknown[] = []
        let where = ''
        if (q) { where = 'WHERE (title ILIKE ? OR topic ILIKE ? OR location ILIKE ?)'; const l = `%${q}%`; params.push(l, l, l) }
        const [rows, total] = await Promise.all([
          query(`SELECT id, slug, topic, title, category, location, excerpt, reading_time, custom_image_url, published_at, generated_at
                 FROM articles ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
          query(`SELECT COUNT(*) AS n FROM articles ${where}`, params),
        ])
        return ok({ articles: rows.rows, total: parseInt(total.rows[0].n) })
      }
      case 'POST articles': {
        const { title, topic, excerpt, content, category, location, reading_time, custom_image_url } = body ?? {}
        if (!title) return fail(400, 'title je povinné')
        const slug = slugOf(title)
        await query(`INSERT INTO articles (topic, slug, title, category, location, excerpt, content, reading_time, custom_image_url, published_at, generated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [topic || title, slug, title, n(category), n(location), n(excerpt), n(content), reading_time ?? 5, n(custom_image_url)])
        afterArticleChange(slug)
        return ok({ ok: true, slug })
      }
      case 'PUT articles/:id': {
        const b = body ?? {}
        await query(`UPDATE articles SET title = COALESCE(?, title), excerpt = COALESCE(?, excerpt), content = COALESCE(?, content),
                       category = COALESCE(?, category), location = COALESCE(?, location), reading_time = COALESCE(?, reading_time),
                       custom_image_url = ? WHERE id = ?`,
          [n(b.title), n(b.excerpt), n(b.content), n(b.category), n(b.location), n(b.reading_time), n(b.custom_image_url), id])
        const slug = (await query('SELECT slug FROM articles WHERE id = ?', [id])).rows[0]?.slug
        afterArticleChange(slug)
        return ok()
      }
      case 'DELETE articles/:id': {
        const slug = (await query('SELECT slug FROM articles WHERE id = ?', [id])).rows[0]?.slug
        await query('DELETE FROM articles WHERE id = ?', [id])
        afterArticleChange(slug)
        return ok()
      }

      // ── Destinations ──
      case 'GET destinations': {
        const { limit, offset } = paging(sp)
        const q = sp.get('q') ?? ''
        const params: unknown[] = []
        let where = ''
        if (q) { where = 'WHERE dp.name ILIKE ?'; params.push(`%${q}%`) }
        const [rows, total] = await Promise.all([
          query(`SELECT dp.name, dp.photo_url, dp.updated_at, ai.description IS NOT NULL AS has_ai
                 FROM destination_photos dp LEFT JOIN destination_ai ai ON ai.name = dp.name
                 ${where} ORDER BY dp.name ASC LIMIT ? OFFSET ?`, [...params, limit, offset]),
          query(`SELECT COUNT(*) AS n FROM destination_photos dp ${where}`, params),
        ])
        return ok({ destinations: rows.rows, total: parseInt(total.rows[0].n) })
      }
      case 'PUT destinations/:id': {
        const name = decodeURIComponent(id)
        if (!body?.photo_url) return fail(400, 'photo_url je povinné')
        await query(`INSERT INTO destination_photos (name, photo_url, updated_at) VALUES (?, ?, NOW())
                     ON CONFLICT (name) DO UPDATE SET photo_url = EXCLUDED.photo_url, updated_at = NOW()`, [name, body.photo_url])
        metaCache.delete(`photo_${name}`)
        return ok()
      }

      // ── Car destinations ──
      case 'GET car-destinations': {
        await ensureCarDestinationsTable()
        const { limit, offset } = paging(sp)
        const q = sp.get('q') ?? ''
        const params: unknown[] = []
        let where = ''
        if (q) { where = 'WHERE (name ILIKE ? OR country ILIKE ? OR slug ILIKE ?)'; const l = `%${q}%`; params.push(l, l, l) }
        const [rows, total] = await Promise.all([
          query(`SELECT id, slug, name, country, country_slug, dc_path, dc_search_term, popular, active, updated_at
                 FROM car_destinations ${where} ORDER BY country ASC, name ASC LIMIT ? OFFSET ?`, [...params, limit, offset]),
          query(`SELECT COUNT(*) AS n FROM car_destinations ${where}`, params),
        ])
        return ok({ destinations: rows.rows, total: parseInt(total.rows[0].n) })
      }
      case 'POST car-destinations': {
        await ensureCarDestinationsTable()
        const { slug, name, country, country_slug, dc_path = '', dc_search_term = '', popular = false } = body ?? {}
        if (!slug || !name || !country || !country_slug) return fail(400, 'slug, name, country, country_slug jsou povinné')
        try {
          const { rows } = await query(`INSERT INTO car_destinations (slug, name, country, country_slug, dc_path, dc_search_term, popular)
                                        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`, [slug, name, country, country_slug, dc_path, dc_search_term, popular])
          return ok({ ok: true, id: rows[0].id })
        } catch (e) {
          const m = (e as Error).message ?? ''
          if (m.includes('unique') || m.includes('duplicate')) return fail(409, `Slug "${slug}" již existuje`)
          throw e
        }
      }
      case 'PUT car-destinations/:id': {
        await ensureCarDestinationsTable()
        const b = body ?? {}
        await query(`UPDATE car_destinations SET slug = COALESCE(?, slug), name = COALESCE(?, name), country = COALESCE(?, country),
                       country_slug = COALESCE(?, country_slug), dc_path = COALESCE(?, dc_path), dc_search_term = COALESCE(?, dc_search_term),
                       popular = COALESCE(?, popular), active = COALESCE(?, active), updated_at = NOW() WHERE id = ?`,
          [n(b.slug), n(b.name), n(b.country), n(b.country_slug), n(b.dc_path), n(b.dc_search_term), n(b.popular), n(b.active), id])
        return ok()
      }
      case 'DELETE car-destinations/:id':
        await ensureCarDestinationsTable()
        await query('DELETE FROM car_destinations WHERE id = ?', [id])
        return ok()

      // ── Unsplash: kandidáti a výběr fotky destinace ──
      case 'GET unsplash': {
        const q = (sp.get('q') ?? '').trim()
        if (q.length < 2) return ok({ hits: [] })
        try { return ok({ hits: await searchUnsplash(q, Math.max(1, int(sp.get('page'), 1))) }) }
        catch (e) { return fail(502, (e as Error).message) }
      }
      case 'POST unsplash/:id': {
        if (id !== 'pick') break
        const b = body ?? {}
        if (!b.name || typeof b.url !== 'string' || !b.url.startsWith('https://images.unsplash.com/')) return fail(400, 'name a url (Unsplash) jsou povinné')
        await query('ALTER TABLE destination_photos ADD COLUMN IF NOT EXISTS photo_credit text, ADD COLUMN IF NOT EXISTS photo_credit_url text')
        await query(`INSERT INTO destination_photos (name, photo_url, photo_credit, photo_credit_url, updated_at) VALUES (?, ?, ?, ?, NOW())
                     ON CONFLICT (name) DO UPDATE SET photo_url = EXCLUDED.photo_url, photo_credit = EXCLUDED.photo_credit,
                       photo_credit_url = EXCLUDED.photo_credit_url, updated_at = NOW()`,
          [b.name, b.url, n(b.credit), n(b.creditUrl)])
        if (typeof b.downloadLocation === 'string') await registerDownload(b.downloadLocation)
        metaCache.delete(`photo_${b.name}`)
        try { revalidateTag('api') } catch { /* mimo request kontext */ }
        return ok()
      }

      // ── Upload (Vercel Blob) ──
      case 'POST upload': {
        if (!file) return fail(400, 'Žádný soubor')
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return fail(400, 'Podporovány jsou pouze obrázky (JPEG, PNG, WebP, GIF)')
        if (file.size > 10 * 1024 * 1024) return fail(400, 'Soubor je větší než 10 MB')
        if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(503, 'BLOB_READ_WRITE_TOKEN není nastavený (Vercel Blob)')
        const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.jpg').toLowerCase()
        const blob = await put(`uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`, file, { access: 'public' })
        return ok({ ok: true, url: blob.url, filename: blob.pathname })
      }
    }
  } catch (e) {
    console.error('[admin]', key, (e as Error).message)
    return fail(500, (e as Error).message)
  }
  return fail(404, 'Not found')
}
