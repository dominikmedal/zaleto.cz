const express = require('express')
const router = express.Router()
const db = require('../db')
const { metaCache } = require('../cache')

const STALE_DAYS = 90

/**
 * Generates AI description + excursions for a destination via OpenAI.
 * Returns { description, excursions } or throws.
 */
async function generateAI(name) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 1200,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'Jsi průvodce cestovního portálu zaleto.cz. Generuješ obsah v češtině pro turisty.',
        },
        {
          role: 'user',
          content:
            `Vytvoř obsah pro destinaci "${name}" pro cestovní portál zaleto.cz.\n` +
            `Vrať JSON objekt se dvěma poli:\n` +
            `1. "description": string — 2 odstavce oddělené \\n\\n, celkem 150–250 slov. Piš lákavě a přirozeně: proč jet, co zažít, podnebí, nejlepší roční doba.\n` +
            `2. "excursions": pole 8 objektů { "name": string, "emoji": string, "description": string } — doporučené výlety nebo aktivity v destinaci, každý s 1 větou popisu.\n` +
            `Příklad objektu excursions: { "name": "Safari v NP Amboseli", "emoji": "🦁", "description": "Nezapomenutelné setkání s africkou divočinou s výhledem na Kilimandžáro." }`,
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  })

  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}`)

  const data = await response.json()
  const parsed = JSON.parse(data.choices[0].message.content)
  return {
    description: parsed.description || null,
    excursions:  Array.isArray(parsed.excursions) ? parsed.excursions.slice(0, 8) : [],
  }
}

/**
 * Generates and stores AI content for a destination — fire-and-forget safe.
 * Checks DB first so it only generates when truly missing/stale.
 */
async function generateAndStore(name) {
  // Check if fresh content already exists
  const r = await db.query(
    `SELECT generated_at FROM destination_ai WHERE name = ?
     AND generated_at > NOW() - INTERVAL '${STALE_DAYS} days'`,
    [name]
  )
  if (r.rows.length > 0) return // already fresh

  const result = await generateAI(name)
  if (!result) return

  await db.query(
    `INSERT INTO destination_ai (name, description, excursions, generated_at)
     VALUES (?, ?, ?, NOW())
     ON CONFLICT (name) DO UPDATE
       SET description = EXCLUDED.description,
           excursions  = EXCLUDED.excursions,
           generated_at = EXCLUDED.generated_at`,
    [name, result.description, JSON.stringify(result.excursions)]
  )

  // Update in-memory cache
  metaCache.set(`ai_${name}`, result)
}

// GET /api/destination-ai/:name
router.get('/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name)

  try {
    // In-memory cache
    const cacheKey = `ai_${name}`
    const cached = metaCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    // DB cache
    const dbR = await db.query(
      'SELECT description, excursions, generated_at FROM destination_ai WHERE name = ?',
      [name]
    )
    const row = dbR.rows[0]
    if (row) {
      const ageDays = (Date.now() - new Date(row.generated_at).getTime()) / 86400000
      if (ageDays < STALE_DAYS) {
        const result = {
          description: row.description,
          excursions:  JSON.parse(row.excursions || '[]'),
        }
        metaCache.set(cacheKey, result)
        return res.set('X-Cache', 'HIT').json(result)
      }
    }

    // Generate fresh
    const result = await generateAI(name)
    if (!result) return res.json({ description: null, excursions: [] })

    await db.query(
      `INSERT INTO destination_ai (name, description, excursions, generated_at)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description,
             excursions  = EXCLUDED.excursions,
             generated_at = EXCLUDED.generated_at`,
      [name, result.description, JSON.stringify(result.excursions)]
    )

    metaCache.set(cacheKey, result)
    res.set('X-Cache', 'MISS').json(result)
  } catch (err) {
    console.error('GET /destination-ai error:', err.message)
    res.json({ description: null, excursions: [] })
  }
})

module.exports = router
module.exports.generateAndStore = generateAndStore
