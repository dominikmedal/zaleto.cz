const express = require('express')
const router = express.Router()
const db = require('../db')
const { metaCache } = require('../cache')

// Queue — max 1 concurrent Gemini request, 35s between calls (~1.7 RPM, safe under 2 RPM limit)
// queuedNames prevents the same destination being added multiple times
const queuedNames = new Set()
let aiQueue = Promise.resolve()
let queuePending = 0   // counts items currently waiting or being processed

function enqueue(name, fn) {
  queuedNames.add(name)
  queuePending++
  aiQueue = aiQueue
    .then(() => fn())
    .then(
      () => { queuedNames.delete(name); queuePending--; return new Promise(r => setTimeout(r, 35_000)) },
      (err) => {
        queuedNames.delete(name)
        queuePending--
        console.error('[ai] queue error:', err?.message ?? err)
        return new Promise(r => setTimeout(r, 35_000))
      },
    )
  return aiQueue
}

/**
 * Lists available Gemini models for the configured API key and logs them.
 * Call once at startup to diagnose model availability issues.
 */
async function logAvailableModels() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`)
    const data = await r.json()
    const names = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name)
    console.log('[ai] available models:', names.join(', ') || '(none)')
  } catch (e) {
    console.error('[ai] listModels error:', e.message)
  }
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
    `Odpověz POUZE validním JSON objektem, bez markdown bloků, bez dalšího textu.\n` +
    `JSON musí obsahovat tato pole:\n` +
    `1. "description": string — 2 odstavce oddělené \\n\\n, celkem 150–250 slov. Piš lákavě a přirozeně: proč jet, co zažít, podnebí.\n` +
    `2. "excursions": pole 6 objektů { "name": string, "description": string } — doporučené výlety nebo aktivity, každý s 1 větou popisu.\n` +
    `3. "best_time": string — 1–2 odstavce (oddělené \\n\\n) o nejlepší době pro návštěvu: měsíce, počasí, sezóna, tipy.\n` +
    `4. "places": pole 6 objektů { "name": string, "description": string } — nejzajímavější místa k objevení v destinaci.\n` +
    `5. "food": pole 6 objektů { "name": string, "description": string } — tradiční jídla a vyhlášené restaurace/pokrmy typické pro destinaci.\n` +
    `6. "trips": pole 6 objektů { "name": string, "description": string } — doporučené výlety z destinace (do okolí, jednodenní výlety).\n` +
    `Příklad: {"description":"...","excursions":[{"name":"Safari","description":"..."}],"best_time":"...","places":[{"name":"Akropolis","description":"..."}],"food":[{"name":"Moussaka","description":"..."}],"trips":[{"name":"Výlet na Santorini","description":"..."}]}`

  // Try models in order — cheapest first, skip ones unavailable to new users
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
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(25_000),
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const isUnavailable = response.status === 404 || (response.status === 400 && body.includes('no longer available'))
      if (isUnavailable) {
        console.log(`[ai] model ${model} unavailable, trying next...`)
        lastErr = new Error(`Gemini HTTP ${response.status}`)
        continue
      }
      console.error(`[ai] Gemini ${response.status} body:`, body.slice(0, 500))
      if (response.status === 429) throw new Error('Gemini HTTP 429')
      throw new Error(`Gemini HTTP ${response.status}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    if (candidate?.finishReason === 'MAX_TOKENS') {
      console.warn(`[ai] model ${model} hit MAX_TOKENS, trying next...`)
      lastErr = new Error('MAX_TOKENS')
      continue
    }
    let text = candidate?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini empty response')
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      console.error(`[ai] JSON parse error (${text.length} chars): ${e.message}`)
      throw e
    }
    return {
      description: parsed.description || null,
      excursions:  Array.isArray(parsed.excursions) ? parsed.excursions.slice(0, 8) : [],
      best_time:   parsed.best_time || null,
      places:      Array.isArray(parsed.places) ? parsed.places.slice(0, 6) : [],
      food:        Array.isArray(parsed.food) ? parsed.food.slice(0, 6) : [],
      trips:       Array.isArray(parsed.trips) ? parsed.trips.slice(0, 6) : [],
    }
  }

  throw lastErr || new Error('Gemini: no available model')
}

/**
 * Generates and stores AI content for a destination — fire-and-forget safe.
 * Generates only once — if a record exists in DB it is never regenerated.
 * Uses a global queue to avoid hitting Gemini rate limits.
 */
async function generateAndStore(name) {
  // Skip if already exists in DB with a valid description
  const r = await db.query(
    'SELECT description FROM destination_ai WHERE name = ?', [name]
  )
  if (r.rows.length > 0 && (r.rows[0].description?.length ?? 0) >= 50) return

  // Skip if already waiting in queue
  if (queuedNames.has(name)) return

  enqueue(name, async () => {
    // Re-check inside queue — another enqueued call may have already generated it
    const r2 = await db.query(
      'SELECT description FROM destination_ai WHERE name = ?', [name]
    )
    if (r2.rows.length > 0 && (r2.rows[0].description?.length ?? 0) >= 50) return

    console.log(`[ai] → generuji: ${name} (${queuePending} ve frontě)`)
    let result = null
    // Exponential backoff: 60s → 120s → 240s between 429 retries
    const backoffs = [60_000, 120_000, 240_000]
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        result = await generateAI(name)
        break
      } catch (e) {
        if (e.message?.includes('429')) {
          if (attempt <= 3) {
            const wait = backoffs[attempt - 1]
            console.log(`[ai] 429 rate limit, waiting ${wait / 1000}s (attempt ${attempt}/4): ${name}`)
            await new Promise(r => setTimeout(r, wait))
          } else {
            // All retries exhausted — re-enqueue after 10 minutes instead of discarding
            console.log(`[ai] 429 exhausted, re-queuing after 10min: ${name}`)
            setTimeout(() => generateAndStore(name), 10 * 60_000)
            return
          }
        } else {
          throw e
        }
      }
    }
    if (!result) { console.log(`[ai] skipped (no result): ${name}`); return }

    await db.query(
      `INSERT INTO destination_ai (name, description, excursions, best_time, places, food, trips, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (name) DO UPDATE SET
         description = EXCLUDED.description,
         excursions  = EXCLUDED.excursions,
         best_time   = EXCLUDED.best_time,
         places      = EXCLUDED.places,
         food        = EXCLUDED.food,
         trips       = EXCLUDED.trips,
         generated_at = NOW()`,
      [
        name,
        result.description,
        JSON.stringify(result.excursions),
        result.best_time,
        JSON.stringify(result.places),
        JSON.stringify(result.food),
        JSON.stringify(result.trips),
      ]
    )

    metaCache.set(`ai_${name}`, result)
    console.log(`[ai] ✓ hotovo: ${name} (${queuePending - 1} zbývá)`)
  })
}

/**
 * Finds all distinct destinations in hotels table that have no AI description
 * and enqueues generation for each. Called after scraping completes.
 */
async function generateMissingAI() {
  try {
    await logAvailableModels()

    // Collect real geographic names the same way the frontend resolves them:
    // country, region (destination.split('/')[1] or [0]), resort_town
    const r = await db.query(`
      SELECT DISTINCT country, destination, resort_town FROM hotels
      WHERE country IS NOT NULL OR destination IS NOT NULL OR resort_town IS NOT NULL
    `)

    const names = new Set()
    for (const row of r.rows) {
      if (row.country) names.add(row.country.trim())
      if (row.destination) {
        const parts = row.destination.split('/')
        const region = parts.length >= 2 ? parts[1].trim() : parts[0].trim()
        // Skip non-geographic strings (tour type categories)
        if (region && !/safari|bike|trek|plus|sport|aktivní/i.test(region)) {
          names.add(region)
        }
      }
      if (row.resort_town) names.add(row.resort_town.trim())
    }

    // Filter out names already in DB with a valid description (>= 50 chars)
    const existingR = await db.query(
      `SELECT name FROM destination_ai WHERE description IS NOT NULL AND LENGTH(description) >= 50`
    )
    const existing = new Set(existingR.rows.map(r => r.name))
    const missing = [...names].filter(n => !existing.has(n))

    if (missing.length === 0) { console.log('[ai] všechny destinace mají popis, přeskakuji'); return 0 }
    console.log(`[ai] zahajuji generování pro ${missing.length} destinací: ${missing.join(', ')}`)
    for (const name of missing) {
      await generateAndStore(name)
    }
    return missing.length
  } catch (e) {
    console.error('[ai] generateMissingAI error:', e.message)
    return 0
  }
}

// GET /api/destination-ai/status — vrátí počet destinací čekajících ve frontě
router.get('/status', (req, res) => {
  res.json({ pending: queuePending, queued_names: queuedNames.size })
})

// POST /api/destination-ai/generate — spustí generování chybějících popisků a vrátí počet zařazených
router.post('/generate', async (req, res) => {
  try {
    const count = await generateMissingAI()
    res.json({ queued: count ?? 0, pending: queuePending })
  } catch (e) {
    console.error('[ai] /generate error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

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
      'SELECT description, excursions, best_time, places, food, trips FROM destination_ai WHERE name = ?',
      [name]
    )
    const row = dbR.rows[0]
    if (row) {
      const result = {
        description: row.description,
        excursions:  JSON.parse(row.excursions || '[]'),
        best_time:   row.best_time || null,
        places:      JSON.parse(row.places || '[]'),
        food:        JSON.parse(row.food || '[]'),
        trips:       JSON.parse(row.trips || '[]'),
      }
      metaCache.set(cacheKey, result)
      return res.set('X-Cache', 'HIT').json(result)
    }

    res.json({ description: null, excursions: [], best_time: null, places: [], food: [], trips: [] })
  } catch (err) {
    console.error('GET /destination-ai error:', err.message)
    res.json({ description: null, excursions: [] })
  }
})

module.exports = router
module.exports.generateAndStore = generateAndStore
module.exports.generateMissingAI = generateMissingAI
