const express = require('express')
const router = express.Router()
const db = require('../db')
const { metaCache } = require('../cache')

// Queue — max 1 concurrent Gemini call, 35s between calls
const queuedSlugs = new Set()
let aiQueue = Promise.resolve()
let queuePending = 0

function enqueue(slug, fn) {
  queuedSlugs.add(slug)
  queuePending++
  aiQueue = aiQueue
    .then(() => fn())
    .then(
      () => { queuedSlugs.delete(slug); queuePending--; return new Promise(r => setTimeout(r, 35_000)) },
      (err) => {
        queuedSlugs.delete(slug)
        queuePending--
        console.error('[car-rental-ai] queue error:', err?.message ?? err)
        return new Promise(r => setTimeout(r, 35_000))
      },
    )
  return aiQueue
}

async function generateCarRentalAI(name, country) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const prompt =
    `Jsi expert na půjčování aut a průvodce cestovního portálu zaleto.cz. Generuješ obsah v češtině pro turisty.\n\n` +
    `Vytvoř komplexní průvodce půjčováním auta v destinaci "${name}" (${country}).\n` +
    `Odpověz POUZE validním JSON objektem, bez markdown bloků, bez dalšího textu.\n` +
    `JSON musí obsahovat přesně tato pole:\n` +
    `1. "intro": string — 3 odstavce oddělené \\n\\n (celkem 400–600 slov) o tom, proč si půjčit auto v ${name}, jaké jsou možnosti dopravy, co auto umožní zažít, co je specifické pro tuto destinaci.\n` +
    `2. "fuel_info": string — 2–3 odstavce o pohonných hmotách: ceny benzínu/nafty/LPG (přibližné €/litr pro ${country}), typy paliv dostupných na čerpacích stanicích, jak fungují tankování, tipy pro úsporu paliva.\n` +
    `3. "driving_rules": string — 2–3 odstavce o pravidlech silničního provozu v ${country}: rychlostní limity (obce, mimo obce, dálnice), alkohol za volantem, povinné vybavení vozidla, parkování v ${name}, mýtné/dálniční nálepky, specifika pro turisty.\n` +
    `4. "price_overview": string — 2 odstavce o cenách půjčení auta v ${name}: průměrné ceny podle kategorie (economy, compact, SUV, minivan) v €/den, sezónní rozdíly, co ovlivňuje cenu (věk řidiče, pojištění, kilometrový limit).\n` +
    `5. "best_car_types": string — 1–2 odstavce o doporučených typech aut pro ${name}: proč konkrétní typy aut jsou vhodné pro místní terén a aktivity.\n` +
    `6. "trip_tips": pole 4–5 objektů s tipy na výlety autem z ${name}. Každý objekt má: "title" (název výletu), "description" (2–3 věty popis), "distance_km" (číslo — vzdálenost v km), "duration_h" (číslo — délka výletu v hodinách).\n` +
    `7. "faq": pole 6–8 objektů s frequently asked questions. Každý objekt má: "question" (otázka), "answer" (2–4 věty odpověď). Typická témata: věk řidiče, řidičský průkaz, platba za auto, palivová politika, vrácení auta, pojištění, mezinárodní pojezd, navigace.\n` +
    `8. "practical_tips": pole 5–7 krátkých praktických tipů (string, každý 1 věta) pro půjčení auta v ${name}.\n` +
    `9. "car_examples": pole 5–6 objektů s příklady typických aut dostupných k půjčení. Každý objekt má: "name" (konkrétní model auta, např. "Škoda Fabia"), "category" (Economy/Compact/SUV/Minivan/Premium), "price_from_eur" (číslo — orientační cena €/den v hlavní sezóně), "seats" (číslo), "bags" (číslo — počet zavazadel), "transmission" (Manuál/Automat), "description" (1 věta proč se hodí pro ${name}). Uveď realistické modely dostupné v ${country}.\n` +
    `Příklad struktury (zkráceno): {"intro":"Para první...\\n\\nPara druhý...\\n\\nPara třetí...","fuel_info":"Palivo v ${country}...","driving_rules":"Rychlostní limity...","price_overview":"Průměrné ceny...","best_car_types":"Pro ${name}...","trip_tips":[{"title":"Výlet na hrad","description":"Krásná trasa...","distance_km":45,"duration_h":3}],"faq":[{"question":"Jaký věk řidiče?","answer":"Minimální věk..."}],"practical_tips":["Rezervujte auto předem..."],"car_examples":[{"name":"Škoda Fabia","category":"Economy","price_from_eur":18,"seats":5,"bags":2,"transmission":"Manuál","description":"Ideální pro..."}]}`

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
          generationConfig: { maxOutputTokens: 8192, temperature: 0.5 },
        }),
        signal: AbortSignal.timeout(45_000),
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const isUnavailable = response.status === 404 || (response.status === 400 && body.includes('no longer available'))
      if (isUnavailable) {
        console.log(`[car-rental-ai] model ${model} unavailable, trying next...`)
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
      console.error(`[car-rental-ai] JSON parse error: ${e.message}`)
      throw e
    }

    return {
      intro:          parsed.intro          || null,
      fuel_info:      parsed.fuel_info      || null,
      driving_rules:  parsed.driving_rules  || null,
      price_overview: parsed.price_overview || null,
      best_car_types: parsed.best_car_types || null,
      trip_tips:      Array.isArray(parsed.trip_tips)    ? parsed.trip_tips    : [],
      faq:            Array.isArray(parsed.faq)           ? parsed.faq          : [],
      practical_tips: Array.isArray(parsed.practical_tips) ? parsed.practical_tips : [],
      car_examples:   Array.isArray(parsed.car_examples) ? parsed.car_examples : [],
    }
  }

  throw lastErr || new Error('Gemini: no available model')
}

async function generateAndStore(slug, name, country) {
  const r = await db.query('SELECT slug FROM car_rental_ai WHERE slug = ?', [slug])
  if (r.rows.length > 0) return
  if (queuedSlugs.has(slug)) return

  enqueue(slug, async () => {
    const r2 = await db.query('SELECT slug FROM car_rental_ai WHERE slug = ?', [slug])
    if (r2.rows.length > 0) return

    console.log(`[car-rental-ai] → generuji: ${name} (${country}) [${queuePending} ve frontě]`)
    let result = null
    const backoffs = [60_000, 120_000, 240_000]
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        result = await generateCarRentalAI(name, country)
        break
      } catch (e) {
        if (e.message?.includes('429')) {
          if (attempt <= 3) {
            const wait = backoffs[attempt - 1]
            console.log(`[car-rental-ai] 429 rate limit, waiting ${wait / 1000}s (attempt ${attempt}/4): ${name}`)
            await new Promise(r => setTimeout(r, wait))
          } else {
            console.log(`[car-rental-ai] 429 exhausted, re-queuing after 10min: ${name}`)
            setTimeout(() => generateAndStore(slug, name, country), 10 * 60_000)
            return
          }
        } else {
          throw e
        }
      }
    }
    if (!result) { console.log(`[car-rental-ai] skipped (no result): ${name}`); return }

    await db.query(
      `INSERT INTO car_rental_ai
         (slug, name, country, intro, fuel_info, driving_rules, price_overview,
          best_car_types, trip_tips, faq, practical_tips, car_examples, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         name           = EXCLUDED.name,
         country        = EXCLUDED.country,
         intro          = EXCLUDED.intro,
         fuel_info      = EXCLUDED.fuel_info,
         driving_rules  = EXCLUDED.driving_rules,
         price_overview = EXCLUDED.price_overview,
         best_car_types = EXCLUDED.best_car_types,
         trip_tips      = EXCLUDED.trip_tips,
         faq            = EXCLUDED.faq,
         practical_tips = EXCLUDED.practical_tips,
         car_examples   = EXCLUDED.car_examples,
         generated_at   = NOW()`,
      [
        slug,
        name,
        country,
        result.intro,
        result.fuel_info,
        result.driving_rules,
        result.price_overview,
        result.best_car_types,
        JSON.stringify(result.trip_tips),
        JSON.stringify(result.faq),
        JSON.stringify(result.practical_tips),
        JSON.stringify(result.car_examples),
      ]
    )

    metaCache.set(`car_rental_ai_${slug}`, result)
    console.log(`[car-rental-ai] ✓ hotovo: ${name} (${queuePending - 1} zbývá)`)
  })
}

async function generateMissingCarRentalAI() {
  try {
    const destinations = []
    const seen = new Set()

    // 1. Admin-managed car destinations
    try {
      const r = await db.query(
        `SELECT slug, name, country FROM car_destinations WHERE active = TRUE ORDER BY country, name`
      )
      for (const row of r.rows) {
        if (!seen.has(row.slug)) {
          seen.add(row.slug)
          destinations.push({ slug: row.slug, name: row.name, country: row.country })
        }
      }
    } catch { /* car_destinations table may not exist */ }

    // 2. Destinations derived from hotels with future departures
    try {
      const r = await db.query(`
        SELECT DISTINCT
          h.country,
          COALESCE(h.resort_town, split_part(h.destination, '/', 2)) AS resort_town
        FROM hotels h
        INNER JOIN hotel_stats s ON s.hotel_id = h.id
        WHERE s.next_departure >= CURRENT_DATE::text
          AND (h.resort_town IS NOT NULL OR h.destination IS NOT NULL)
          AND h.country IS NOT NULL
        ORDER BY h.country, resort_town
      `)

      for (const row of r.rows) {
        const name = row.resort_town?.trim()
        if (!name || /safari|bike|trek|plus|sport|aktivní/i.test(name)) continue
        // Simple slug: lowercase, remove diacritics, spaces→dashes
        const slug = name
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

        if (!seen.has(slug)) {
          seen.add(slug)
          destinations.push({ slug, name, country: row.country })
        }
      }
    } catch (e) {
      console.warn('[car-rental-ai] hotels query error:', e.message)
    }

    if (destinations.length === 0) {
      console.log('[car-rental-ai] žádné destinace k nalezení, přeskakuji')
      return 0
    }

    const existingR = await db.query(`SELECT slug FROM car_rental_ai WHERE intro IS NOT NULL`)
    const existing = new Set(existingR.rows.map(r => r.slug))
    const missing = destinations.filter(d => !existing.has(d.slug))

    if (missing.length === 0) {
      console.log('[car-rental-ai] všechny destinace mají obsah půjčovny, přeskakuji')
      return 0
    }
    console.log(`[car-rental-ai] zahajuji generování pro ${missing.length} destinací: ${missing.map(d => d.name).join(', ')}`)
    for (const d of missing) await generateAndStore(d.slug, d.name, d.country)
    return missing.length
  } catch (e) {
    console.error('[car-rental-ai] generateMissingCarRentalAI error:', e.message)
    return 0
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/car-rental-ai/status
router.get('/status', (req, res) => {
  res.json({ pending: queuePending, queued_slugs: queuedSlugs.size })
})

// POST /api/car-rental-ai/generate
router.post('/generate', async (req, res) => {
  try {
    const count = await generateMissingCarRentalAI()
    res.json({ queued: count ?? 0, pending: queuePending })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/car-rental-ai/:slug
router.get('/:slug', async (req, res) => {
  const { slug } = req.params
  try {
    const cacheKey = `car_rental_ai_${slug}`
    const cached = metaCache.get(cacheKey)
    if (cached) return res.set('X-Cache', 'HIT').json(cached)

    const dbR = await db.query(
      `SELECT name, country, intro, fuel_info, driving_rules, price_overview,
              best_car_types, trip_tips, faq, practical_tips, car_examples
       FROM car_rental_ai WHERE slug = ?`,
      [slug]
    )
    const row = dbR.rows[0]
    if (row) {
      const result = {
        name:          row.name,
        country:       row.country,
        intro:         row.intro,
        fuel_info:     row.fuel_info,
        driving_rules: row.driving_rules,
        price_overview: row.price_overview,
        best_car_types: row.best_car_types,
        trip_tips:     row.trip_tips     ? JSON.parse(row.trip_tips)     : [],
        faq:           row.faq           ? JSON.parse(row.faq)           : [],
        practical_tips: row.practical_tips ? JSON.parse(row.practical_tips) : [],
        car_examples:  row.car_examples  ? JSON.parse(row.car_examples)  : [],
      }
      metaCache.set(cacheKey, result)
      return res.set('X-Cache', 'HIT').json(result)
    }

    // Trigger background generation if missing
    generateAndStore(slug, slug.replace(/-/g, ' '), '').catch(() => {})
    res.json({
      name: null, country: null, intro: null, fuel_info: null,
      driving_rules: null, price_overview: null, best_car_types: null,
      trip_tips: [], faq: [], practical_tips: [], car_examples: [],
    })
  } catch (err) {
    console.error('[car-rental-ai] GET error:', err.message)
    res.json({
      name: null, country: null, intro: null, fuel_info: null,
      driving_rules: null, price_overview: null, best_car_types: null,
      trip_tips: [], faq: [], practical_tips: [], car_examples: [],
    })
  }
})

module.exports = router
module.exports.generateMissingCarRentalAI = generateMissingCarRentalAI