const express = require('express')
const router = express.Router()
const db = require('../db')
const { metaCache } = require('../cache')

// Simple queue — max 1 concurrent Gemini request, 1.5s between calls
let aiQueue = Promise.resolve()
function enqueue(fn) {
  aiQueue = aiQueue.then(() => fn()).then(
    () => new Promise(r => setTimeout(r, 1500)),
    () => new Promise(r => setTimeout(r, 1500)),
  )
  return aiQueue
}

/**
 * Generates AI description + excursions for a destination via Google Gemini.
 * Returns { description, excursions } or throws.
 */
async function generateAI(name) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const prompt =
    `Jsi průvodce cestovního portálu zaleto.cz. Generuješ obsah v češtině pro turisty.\n\n` +
    `Vytvoř obsah pro destinaci "${name}" pro cestovní portál zaleto.cz.\n` +
    `Vrať JSON objekt se dvěma poli:\n` +
    `1. "description": string — 2 odstavce oddělené \\n\\n, celkem 150–250 slov. Piš lákavě a přirozeně: proč jet, co zažít, podnebí, nejlepší roční doba.\n` +
    `2. "excursions": pole 8 objektů { "name": string, "emoji": string, "description": string } — doporučené výlety nebo aktivity v destinaci, každý s 1 větou popisu.\n` +
    `Příklad objektu excursions: { "name": "Safari v NP Amboseli", "emoji": "🦁", "description": "Nezapomenutelné setkání s africkou divočinou s výhledem na Kilimandžáro." }`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 1200,
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(25_000),
    }
  )

  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`)

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini empty response')
  const parsed = JSON.parse(text)
  return {
    description: parsed.description || null,
    excursions:  Array.isArray(parsed.excursions) ? parsed.excursions.slice(0, 8) : [],
  }
}

/**
 * Generates and stores AI content for a destination — fire-and-forget safe.
 * Generates only once — if a record exists in DB it is never regenerated.
 * Uses a global queue to avoid hitting Gemini rate limits.
 */
async function generateAndStore(name) {
  // Skip if already exists
  const r = await db.query(
    'SELECT name FROM destination_ai WHERE name = ?',
    [name]
  )
  if (r.rows.length > 0) return

  enqueue(async () => {
    // Re-check inside queue — another enqueued call may have already generated it
    const r2 = await db.query('SELECT name FROM destination_ai WHERE name = ?', [name])
    if (r2.rows.length > 0) return

    const result = await generateAI(name)
    if (!result) return

    await db.query(
      `INSERT INTO destination_ai (name, description, excursions, generated_at)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (name) DO NOTHING`,
      [name, result.description, JSON.stringify(result.excursions)]
    )

    metaCache.set(`ai_${name}`, result)
    console.log(`[ai] generated: ${name}`)
  })
}

/**
 * Finds all distinct destinations in hotels table that have no AI description
 * and enqueues generation for each. Called after scraping completes.
 */
async function generateMissingAI() {
  try {
    const r = await db.query(`
      SELECT DISTINCT destination FROM hotels
      WHERE destination IS NOT NULL
        AND destination NOT IN (SELECT name FROM destination_ai WHERE description IS NOT NULL)
    `)
    if (r.rows.length === 0) return
    console.log(`[ai] queuing ${r.rows.length} missing destinations`)
    for (const row of r.rows) {
      await generateAndStore(row.destination)
    }
  } catch (e) {
    console.error('[ai] generateMissingAI error:', e.message)
  }
}

// GET /api/destination-ai/:name — reads from DB/cache only, never generates on request
router.get('/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name)

  try {
    // In-memory cache
    const cacheKey = `ai_${name}`
    const cached = metaCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    // DB — serve whatever exists
    const dbR = await db.query(
      'SELECT description, excursions FROM destination_ai WHERE name = ?',
      [name]
    )
    const row = dbR.rows[0]
    if (row) {
      const result = {
        description: row.description,
        excursions:  JSON.parse(row.excursions || '[]'),
      }
      metaCache.set(cacheKey, result)
      return res.set('X-Cache', 'HIT').json(result)
    }

    res.json({ description: null, excursions: [] })
  } catch (err) {
    console.error('GET /destination-ai error:', err.message)
    res.json({ description: null, excursions: [] })
  }
})

module.exports = router
module.exports.generateAndStore = generateAndStore
module.exports.generateMissingAI = generateMissingAI
