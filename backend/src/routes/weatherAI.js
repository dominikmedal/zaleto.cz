const express = require('express')
const router = express.Router()
const db = require('../db')
const { metaCache } = require('../cache')

// Queue — max 1 concurrent Gemini request, 35s between calls (safe under rate limit)
const queuedNames = new Set()
let aiQueue = Promise.resolve()
let queuePending = 0

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
        console.error('[weather-ai] queue error:', err?.message ?? err)
        return new Promise(r => setTimeout(r, 35_000))
      },
    )
  return aiQueue
}

async function generateWeatherAI(name) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const prompt =
    `Jsi meteorolog a průvodce cestovního portálu zaleto.cz. Generuješ obsah v češtině pro turisty.\n\n` +
    `Vytvoř detailní klimatické informace pro turistickou destinaci "${name}".\n` +
    `Odpověz POUZE validním JSON objektem, bez markdown bloků, bez dalšího textu.\n` +
    `JSON musí obsahovat přesně tato pole:\n` +
    `1. "description": string — 2 odstavce oddělené \\n\\n, 120-180 slov o klimatu a typickém počasí.\n` +
    `2. "monthly_air": pole 12 čísel — průměrné maximální teploty vzduchu (°C) pro Leden–Prosinec.\n` +
    `3. "monthly_sea": pole 12 čísel NEBO null — průměrné teploty moře (°C) pro Leden–Prosinec. Null pokud není u moře.\n` +
    `4. "monthly_rain_days": pole 12 čísel — průměrný počet dní s dešťovými srážkami v měsíci.\n` +
    `5. "monthly_sun_hours": pole 12 čísel — průměrný denní počet hodin slunečního svitu.\n` +
    `6. "best_months": pole čísel 1-12 — nejlepší měsíce pro dovolenou (obvykle 4-7 měsíců).\n` +
    `7. "winter": string — 2-3 věty o počasí v zimě (prosinec–únor).\n` +
    `8. "spring": string — 2-3 věty o počasí na jaře (březen–květen).\n` +
    `9. "summer": string — 2-3 věty o letním počasí (červen–srpen).\n` +
    `10. "autumn": string — 2-3 věty o podzimním počasí (září–listopad).\n` +
    `11. "wind_info": string — 2-3 věty o typickém větru, jak ovlivňuje turisty.\n` +
    `12. "sea_info": string NEBO null — 2-3 věty o teplotě moře a sezóně koupání. Null pokud není u moře.\n` +
    `Příklad: {"description":"...\\n\\n...","monthly_air":[15,16,18,22,26,30,33,33,29,24,20,16],"monthly_sea":[17,16,16,17,19,23,26,26,25,22,20,18],"monthly_rain_days":[7,6,5,3,2,1,0,0,1,4,7,8],"monthly_sun_hours":[4,5,7,9,11,13,14,13,10,7,5,4],"best_months":[5,6,7,8,9,10],"winter":"Zima je mírná...","spring":"Jaro přináší...","summer":"Léto je horké...","autumn":"Podzim je...","wind_info":"V létě fouká...","sea_info":"Moře dosahuje..."}`

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
          generationConfig: { maxOutputTokens: 2048, temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(25_000),
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const isUnavailable = response.status === 404 || (response.status === 400 && body.includes('no longer available'))
      if (isUnavailable) {
        console.log(`[weather-ai] model ${model} unavailable, trying next...`)
        lastErr = new Error(`Gemini HTTP ${response.status}`)
        continue
      }
      if (response.status === 429) throw new Error('Gemini HTTP 429')
      throw new Error(`Gemini HTTP ${response.status}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    if (candidate?.finishReason === 'MAX_TOKENS') {
      lastErr = new Error('MAX_TOKENS')
      continue
    }
    let text = candidate?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini empty response')
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed
    try { parsed = JSON.parse(text) } catch (e) {
      console.error(`[weather-ai] JSON parse error: ${e.message}`)
      throw e
    }

    return {
      description:       parsed.description || null,
      monthly_air:       Array.isArray(parsed.monthly_air) ? parsed.monthly_air.slice(0, 12) : null,
      monthly_sea:       Array.isArray(parsed.monthly_sea) ? parsed.monthly_sea.slice(0, 12) : null,
      monthly_rain_days: Array.isArray(parsed.monthly_rain_days) ? parsed.monthly_rain_days.slice(0, 12) : null,
      monthly_sun_hours: Array.isArray(parsed.monthly_sun_hours) ? parsed.monthly_sun_hours.slice(0, 12) : null,
      best_months:       Array.isArray(parsed.best_months) ? parsed.best_months : [],
      winter:            parsed.winter || null,
      spring:            parsed.spring || null,
      summer:            parsed.summer || null,
      autumn:            parsed.autumn || null,
      wind_info:         parsed.wind_info || null,
      sea_info:          parsed.sea_info || null,
    }
  }

  throw lastErr || new Error('Gemini: no available model')
}

async function generateAndStore(name) {
  const r = await db.query('SELECT name FROM weather_ai WHERE name = ?', [name])
  if (r.rows.length > 0) return
  if (queuedNames.has(name)) return

  enqueue(name, async () => {
    const r2 = await db.query('SELECT name FROM weather_ai WHERE name = ?', [name])
    if (r2.rows.length > 0) return

    console.log(`[weather-ai] → generuji: ${name} (${queuePending} ve frontě)`)
    let result = null
    const backoffs = [60_000, 120_000, 240_000]
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        result = await generateWeatherAI(name)
        break
      } catch (e) {
        if (e.message?.includes('429')) {
          if (attempt <= 3) {
            const wait = backoffs[attempt - 1]
            console.log(`[weather-ai] 429 rate limit, waiting ${wait / 1000}s (attempt ${attempt}/4): ${name}`)
            await new Promise(r => setTimeout(r, wait))
          } else {
            console.log(`[weather-ai] 429 exhausted, re-queuing after 10min: ${name}`)
            setTimeout(() => generateAndStore(name), 10 * 60_000)
            return
          }
        } else {
          throw e
        }
      }
    }
    if (!result) { console.log(`[weather-ai] skipped (no result): ${name}`); return }

    await db.query(
      `INSERT INTO weather_ai
         (name, description, monthly_air, monthly_sea, monthly_rain_days, monthly_sun_hours,
          best_months, winter, spring, summer, autumn, wind_info, sea_info, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (name) DO UPDATE SET
         description       = EXCLUDED.description,
         monthly_air       = EXCLUDED.monthly_air,
         monthly_sea       = EXCLUDED.monthly_sea,
         monthly_rain_days = EXCLUDED.monthly_rain_days,
         monthly_sun_hours = EXCLUDED.monthly_sun_hours,
         best_months       = EXCLUDED.best_months,
         winter            = EXCLUDED.winter,
         spring            = EXCLUDED.spring,
         summer            = EXCLUDED.summer,
         autumn            = EXCLUDED.autumn,
         wind_info         = EXCLUDED.wind_info,
         sea_info          = EXCLUDED.sea_info,
         generated_at      = NOW()`,
      [
        name,
        result.description,
        JSON.stringify(result.monthly_air),
        result.monthly_sea ? JSON.stringify(result.monthly_sea) : null,
        JSON.stringify(result.monthly_rain_days),
        JSON.stringify(result.monthly_sun_hours),
        JSON.stringify(result.best_months),
        result.winter,
        result.spring,
        result.summer,
        result.autumn,
        result.wind_info,
        result.sea_info,
      ]
    )

    metaCache.set(`weather_ai_${name}`, result)
    console.log(`[weather-ai] ✓ hotovo: ${name} (${queuePending - 1} zbývá)`)
  })
}

async function generateMissingWeatherAI() {
  try {
    const r = await db.query(`
      SELECT DISTINCT country, destination FROM hotels
      WHERE country IS NOT NULL
    `)

    const names = new Set()
    for (const row of r.rows) {
      if (row.country) names.add(row.country.trim())
      if (row.destination) {
        const parts = row.destination.split('/')
        const region = parts.length >= 2 ? parts[1].trim() : parts[0].trim()
        if (region && !/safari|bike|trek|plus|sport|aktivní/i.test(region)) {
          names.add(region)
        }
      }
    }

    const existingR = await db.query(`SELECT name FROM weather_ai WHERE description IS NOT NULL`)
    const existing = new Set(existingR.rows.map(r => r.name))
    const missing = [...names].filter(n => !existing.has(n))

    if (missing.length === 0) {
      console.log('[weather-ai] všechny destinace mají klimatická data, přeskakuji')
      return 0
    }
    console.log(`[weather-ai] zahajuji generování pro ${missing.length} destinací: ${missing.join(', ')}`)
    for (const name of missing) await generateAndStore(name)
    return missing.length
  } catch (e) {
    console.error('[weather-ai] generateMissingWeatherAI error:', e.message)
    return 0
  }
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/weather-ai/status
router.get('/status', (req, res) => {
  res.json({ pending: queuePending, queued_names: queuedNames.size })
})

// POST /api/weather-ai/generate — spustí generování chybějících dat
router.post('/generate', async (req, res) => {
  try {
    const count = await generateMissingWeatherAI()
    res.json({ queued: count ?? 0, pending: queuePending })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/weather-ai/location/:name — průměrné souřadnice pro destinaci z hotels tabulky
router.get('/location/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name)
  try {
    const r = await db.query(
      `SELECT ROUND(AVG(latitude)::numeric, 4)  AS lat,
              ROUND(AVG(longitude)::numeric, 4) AS lon
       FROM hotels
       WHERE (country = ? OR destination ILIKE ? OR resort_town = ?)
         AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [name, `%${name}%`, name]
    )
    const row = r.rows[0]
    if (row?.lat && row?.lon) return res.json({ lat: parseFloat(row.lat), lon: parseFloat(row.lon) })
    res.json({ lat: null, lon: null })
  } catch {
    res.json({ lat: null, lon: null })
  }
})

// GET /api/weather-ai/:name — vrátí klimatická data (nebo prázdný objekt)
router.get('/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name)
  try {
    const cacheKey = `weather_ai_${name}`
    const cached = metaCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const dbR = await db.query(
      `SELECT description, monthly_air, monthly_sea, monthly_rain_days, monthly_sun_hours,
              best_months, winter, spring, summer, autumn, wind_info, sea_info
       FROM weather_ai WHERE name = ?`,
      [name]
    )
    const row = dbR.rows[0]
    if (row) {
      const result = {
        description:       row.description,
        monthly_air:       row.monthly_air       ? JSON.parse(row.monthly_air) : null,
        monthly_sea:       row.monthly_sea       ? JSON.parse(row.monthly_sea) : null,
        monthly_rain_days: row.monthly_rain_days ? JSON.parse(row.monthly_rain_days) : null,
        monthly_sun_hours: row.monthly_sun_hours ? JSON.parse(row.monthly_sun_hours) : null,
        best_months:       row.best_months       ? JSON.parse(row.best_months) : [],
        winter:   row.winter,
        spring:   row.spring,
        summer:   row.summer,
        autumn:   row.autumn,
        wind_info: row.wind_info,
        sea_info:  row.sea_info,
      }
      metaCache.set(cacheKey, result)
      return res.set('X-Cache', 'HIT').json(result)
    }

    // Trigger background generation if not found
    generateAndStore(name).catch(() => {})
    res.json({
      description: null, monthly_air: null, monthly_sea: null,
      monthly_rain_days: null, monthly_sun_hours: null, best_months: [],
      winter: null, spring: null, summer: null, autumn: null,
      wind_info: null, sea_info: null,
    })
  } catch (err) {
    console.error('GET /weather-ai error:', err.message)
    res.json({ description: null, monthly_air: null, monthly_sea: null, best_months: [] })
  }
})

module.exports = router
module.exports.generateMissingWeatherAI = generateMissingWeatherAI
