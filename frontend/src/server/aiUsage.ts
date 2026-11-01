import 'server-only'
import { query } from './db'

/**
 * Evidence nákladů na Gemini. Tokeny se ukládají do `ai_usage` (z webu i z GitHub Actions),
 * cena se počítá až při zobrazení podle ceníku níže, takže změna ceníku opraví i starší záznamy.
 * Částky jsou orientační (ceny Google AI, 1 USD = kurz v administraci).
 */

// USD za 1 milion tokenů (standardní ceny Gemini API, text)
export const PRICES: Record<string, { in: number; out: number; image?: number }> = {
  'gemini-2.5-flash': { in: 0.30, out: 2.50 },
  'gemini-2.5-flash-lite': { in: 0.10, out: 0.40 },
  'gemini-2.5-flash-image': { in: 0.30, out: 30, image: 0.039 }, // obrázek ≈ 1290 výstupních tokenů
}
const FALLBACK = { in: 0.30, out: 2.50 }

export const costUsd = (model: string, inTok: number, outTok: number, images = 0) => {
  const p = PRICES[model] ?? FALLBACK
  return (inTok * p.in) / 1e6 + (outTok * p.out) / 1e6 + images * (p.image ?? 0)
}

let ready: Promise<void> | null = null
function ensure() {
  ready ??= query(`CREATE TABLE IF NOT EXISTS ai_usage (
    id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source TEXT NOT NULL, kind TEXT NOT NULL,
    model TEXT NOT NULL, input_tokens INT NOT NULL DEFAULT 0, output_tokens INT NOT NULL DEFAULT 0, images INT NOT NULL DEFAULT 0)`)
    .then(() => undefined).catch(e => { ready = null; throw e })
  return ready
}

/** Zapíše jedno volání Gemini. Nikdy nevyhodí chybu (evidence nesmí rozbít generování). */
export async function recordUsage(kind: string, model: string, usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined, images = 0) {
  try {
    await ensure()
    await query('INSERT INTO ai_usage (source, kind, model, input_tokens, output_tokens, images) VALUES (?, ?, ?, ?, ?, ?)',
      ['web', kind, model, usage?.promptTokenCount ?? 0, (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0), images])
  } catch { /* ignore */ }
}

// Průměrná spotřeba na jednu vygenerovanou položku (k zpětnému odhadu před začátkem měření)
const AVG: Record<string, { model: string; in: number; out: number; label: string }> = {
  destination: { model: 'gemini-2.5-flash-lite', in: 700, out: 2600, label: 'Popisy destinací' },
  weather: { model: 'gemini-2.5-flash-lite', in: 600, out: 1800, label: 'Počasí' },
  car_rental: { model: 'gemini-2.5-flash-lite', in: 800, out: 2800, label: 'Půjčovny aut' },
  guide: { model: 'gemini-2.5-flash-lite', in: 1500, out: 14000, label: 'Průvodci oblastí' },
  article: { model: 'gemini-2.5-flash', in: 7000, out: 5000, label: 'Automatické články' },
}
const COUNTS: Record<string, string> = {
  destination: 'SELECT COUNT(*)::int AS n FROM destination_ai',
  weather: 'SELECT COUNT(*)::int AS n FROM weather_ai',
  car_rental: 'SELECT COUNT(*)::int AS n FROM car_rental_ai',
  guide: 'SELECT COUNT(*)::int AS n FROM destination_guide',
  article: 'SELECT COUNT(*)::int AS n FROM articles WHERE source_name IS NOT NULL',
}

export async function usageSummary() {
  // zpětný odhad podle počtu položek v databázi
  const estimate = await Promise.all(Object.entries(COUNTS).map(async ([kind, sql]) => {
    let n = 0
    try { n = Number((await query(sql)).rows[0].n) || 0 } catch { /* tabulka ještě není */ }
    const a = AVG[kind]
    return { kind, label: a.label, count: n, usd: n * costUsd(a.model, a.in, a.out) }
  }))

  let tracked = { total_usd: 0, since: null as string | null, calls: 0 }
  let byKind: { kind: string; source: string; calls: number; in: number; out: number; images: number; usd: number }[] = []
  let byDay: { day: string; usd: number }[] = []
  let month = 0, last30 = 0
  try {
    await ensure()
    const rows = (await query<{ at: string; source: string; kind: string; model: string; input_tokens: number; output_tokens: number; images: number }>(
      'SELECT at, source, kind, model, input_tokens, output_tokens, images FROM ai_usage ORDER BY at')).rows
    const k = new Map<string, (typeof byKind)[number]>()
    const d = new Map<string, number>()
    const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime(), d30 = Date.now() - 30 * 864e5
    for (const r of rows) {
      const usd = costUsd(r.model, r.input_tokens, r.output_tokens, r.images)
      tracked.total_usd += usd; tracked.calls++
      const t = new Date(r.at).getTime()
      if (t >= m0) month += usd
      if (t >= d30) last30 += usd
      const key = `${r.source}/${r.kind}`
      const e = k.get(key) ?? { kind: r.kind, source: r.source, calls: 0, in: 0, out: 0, images: 0, usd: 0 }
      e.calls++; e.in += r.input_tokens; e.out += r.output_tokens; e.images += r.images; e.usd += usd
      k.set(key, e)
      if (t >= d30) { const day = new Date(r.at).toISOString().slice(0, 10); d.set(day, (d.get(day) ?? 0) + usd) }
    }
    tracked.since = rows[0]?.at ?? null
    byKind = [...k.values()].sort((a, b) => b.usd - a.usd)
    byDay = [...d.entries()].sort().map(([day, usd]) => ({ day, usd }))
  } catch { /* bez evidence */ }

  return { estimate, estimateUsd: estimate.reduce((s, e) => s + e.usd, 0), tracked, byKind, byDay, month, last30 }
}
