const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const db      = require('../db')
const { metaCache } = require('../cache')

// Queue — staggered 40s between calls (shares Gemini key, starts 6 min after dest-ai)
let aiQueue    = Promise.resolve()
let queuePending = 0
const queuedSlugs = new Set()

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function enqueue(key, fn) {
  queuedSlugs.add(key)
  queuePending++
  aiQueue = aiQueue
    .then(() => fn())
    .then(
      () => { queuedSlugs.delete(key); queuePending--; return new Promise(r => setTimeout(r, 40_000)) },
      (err) => {
        queuedSlugs.delete(key)
        queuePending--
        console.error('[articles] queue error:', err?.message ?? err)
        return new Promise(r => setTimeout(r, 40_000))
      }
    )
}

async function generateArticleAI(topic) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const prompt =
    `Jsi redaktor cestovního portálu zaleto.cz. Generuješ obsah v češtině pro turisty.\n\n` +
    `Vytvoř cestovní článek na téma: "${topic}"\n` +
    `Odpověz POUZE validním JSON objektem, bez markdown bloků, bez dalšího textu.\n` +
    `JSON musí obsahovat tato pole:\n` +
    `1. "title": string — SEO název článku (max 70 znaků), lákavý, přirozený\n` +
    `2. "category": string — jedna z hodnot: "Průvodce" | "Inspirace" | "Tipy" | "Destinace"\n` +
    `3. "location": string — hlavní destinace (jedno slovo/kraj, např. "Maledivy", "Bali", "
    Japonsko"). Null pokud nelze určit.\n` +
    `4. "excerpt": string — 1–2 věty (max 160 znaků), shrnutí článku pro čtenáře\n` +
    `5. "content": string — celý článek 600–900 slov. Piš přirozeně, jako zkušený cestovatel. Nadpisy ## H2. Bohatý na klíčová slova pro SEO. Paragrafové odstavce odděluj \\n\\n.\n` +
    `6. "reading_time": number — odhadovaná doba čtení v minutách (1–10)\n` +
    `Příklad: {"title":"10 pláží na Maledivách","category":"Inspirace","location":"Maledivy","excerpt":"Krystalicky čistá voda...","content":"## Proč Maledivy\\n\\nMaledivy jsou...","reading_time":5}`

  const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
  let lastErr = null

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.75 },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const isUnavailable = response.status === 404 || (response.status === 400 && body.includes('no longer available'))
      if (isUnavailable) { lastErr = new Error(`HTTP ${response.status}`); continue }
      if (response.status === 429) throw new Error('Gemini HTTP 429')
      throw new Error(`Gemini HTTP ${response.status}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    if (candidate?.finishReason === 'MAX_TOKENS') { lastErr = new Error('MAX_TOKENS'); continue }
    let text = candidate?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini empty response')
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return JSON.parse(text)
  }
  throw lastErr || new Error('No Gemini model available')
}

async function generateAndStoreArticle(topic) {
  const key = slugify(topic.replace(/^[^:]+:\s*/, ''))
  if (queuedSlugs.has(key)) return

  const existing = await db.query('SELECT id FROM articles WHERE topic = ?', [topic])
  if (existing.rows.length > 0) return

  enqueue(key, async () => {
    const check = await db.query('SELECT id FROM articles WHERE topic = ?', [topic])
    if (check.rows.length > 0) return

    console.log(`[articles] → generuji: "${topic}"`)
    let result = null
    const backoffs = [60_000, 120_000, 240_000]
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        result = await generateArticleAI(topic)
        break
      } catch (e) {
        if (e.message?.includes('429')) {
          if (attempt <= 3) await new Promise(r => setTimeout(r, backoffs[attempt - 1]))
          else { setTimeout(() => generateAndStoreArticle(topic), 10 * 60_000); return }
        } else throw e
      }
    }
    if (!result) return

    // Ensure unique slug (append number if collision)
    let slug = slugify(result.title || key)
    const collision = await db.query('SELECT id FROM articles WHERE slug = ? AND topic != ?', [slug, topic])
    if (collision.rows.length > 0) slug = `${slug}-2`

    await db.query(
      `INSERT INTO articles (topic, slug, title, category, location, excerpt, content, reading_time, published_at, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON CONFLICT (topic) DO UPDATE SET
         slug         = EXCLUDED.slug,
         title        = EXCLUDED.title,
         category     = EXCLUDED.category,
         location     = EXCLUDED.location,
         excerpt      = EXCLUDED.excerpt,
         content      = EXCLUDED.content,
         reading_time = EXCLUDED.reading_time,
         generated_at = NOW()`,
      [topic, slug, result.title, result.category || 'Inspirace', result.location || null,
       result.excerpt || null, result.content || null, result.reading_time || 5]
    )

    // Invalidate list cache
    metaCache.invalidate()
    console.log(`[articles] ✓ hotovo: "${result.title}"`)
  })
}

async function generateMissingArticles() {
  try {
    const topicsPath = path.join(__dirname, '../../article_topics.txt')
    if (!fs.existsSync(topicsPath)) {
      console.log('[articles] article_topics.txt nenalezen, přeskakuji')
      return 0
    }

    const lines = fs.readFileSync(topicsPath, 'utf-8').split('\n')
    const topics = lines.map(l => l.trim()).filter(l => l && !l.startsWith('#'))

    if (topics.length === 0) { console.log('[articles] žádná témata'); return 0 }

    const existingR = await db.query('SELECT topic FROM articles')
    const existingTopics = new Set(existingR.rows.map(r => r.topic))
    const missing = topics.filter(t => !existingTopics.has(t))

    if (missing.length === 0) { console.log('[articles] všechny články již existují'); return 0 }
    console.log(`[articles] zahajuji generování ${missing.length} článků: ${missing.join(' | ')}`)
    for (const topic of missing) await generateAndStoreArticle(topic)
    return missing.length
  } catch (e) {
    console.error('[articles] generateMissingArticles error:', e.message)
    return 0
  }
}

// GET /api/articles
router.get('/', async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit)  || 9,  50)
    const offset   = Math.min(parseInt(req.query.offset) || 0, 500)
    const location = req.query.location ? String(req.query.location).trim() : null
    const cacheKey = `articles_${limit}_${offset}_${location ?? ''}`
    const cached = metaCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const r = location
      ? await db.query(
          `SELECT id, slug, title, category, location, excerpt, reading_time, published_at
           FROM articles
           WHERE LOWER(location) = LOWER(?)
           ORDER BY published_at DESC
           LIMIT ? OFFSET ?`,
          [location, limit, offset]
        )
      : await db.query(
          `SELECT id, slug, title, category, location, excerpt, reading_time, published_at
           FROM articles
           ORDER BY published_at DESC
           LIMIT ? OFFSET ?`,
          [limit, offset]
        )
    metaCache.set(cacheKey, r.rows)
    res.json(r.rows)
  } catch (e) {
    console.error('[articles] GET / error:', e.message)
    res.json([])
  }
})

// GET /api/articles/status
router.get('/status', (req, res) => {
  res.json({ pending: queuePending, queued: queuedSlugs.size })
})

// GET /api/articles/:slug
router.get('/:slug', async (req, res) => {
  const { slug } = req.params
  try {
    const cacheKey = `article_${slug}`
    const cached = metaCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const r = await db.query('SELECT * FROM articles WHERE slug = ?', [slug])
    if (!r.rows[0]) return res.status(404).json({ error: 'Not found' })
    metaCache.set(cacheKey, r.rows[0])
    res.json(r.rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/articles/generate
router.post('/generate', async (req, res) => {
  try {
    const count = await generateMissingArticles()
    res.json({ queued: count, pending: queuePending })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
module.exports.generateMissingArticles = generateMissingArticles
