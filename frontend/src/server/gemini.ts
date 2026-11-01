import { recordUsage } from './aiUsage'

/** Tenký klient Google Gemini přes REST (text i obrázek), bez dalších závislostí. */

const BASE = 'https://generativelanguage.googleapis.com'

function key(): string {
  const k = process.env.GEMINI_API_KEY
  if (!k) throw new Error('GEMINI_API_KEY není nastaven')
  return k
}

async function call(version: 'v1' | 'v1beta', model: string, body: unknown, timeoutMs: number) {
  const res = await fetch(`${BASE}/${version}/models/${model}:generateContent?key=${key()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    const e = new Error(`Gemini HTTP ${res.status}: ${t.slice(0, 300)}`) as Error & { status?: number }
    e.status = res.status
    throw e
  }
  return res.json() as Promise<{ usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }; candidates?: { finishReason?: string; content?: { parts?: { text?: string; inlineData?: { mimeType: string; data: string } }[] } }[] }>
}

/** Text z modelu; zkouší modely postupně (nedostupný/příliš dlouhá odpověď → další). */
export async function geminiText(prompt: string, opts: { temperature?: number; maxTokens?: number; timeoutMs?: number; kind?: string } = {}): Promise<string> {
  const models = process.env.GEMINI_TEXT_MODEL ? [process.env.GEMINI_TEXT_MODEL] : ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
  let last: Error | null = null
  for (const model of models) {
    try {
      const data = await call('v1', model, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: opts.temperature ?? 0.6, maxOutputTokens: opts.maxTokens ?? 8192 },
      }, opts.timeoutMs ?? 50_000)
      await recordUsage(opts.kind ?? 'text', model, data.usageMetadata)
      const cand = data.candidates?.[0]
      if (cand?.finishReason === 'MAX_TOKENS') { last = new Error('MAX_TOKENS'); continue }
      const text = cand?.content?.parts?.map(p => p.text ?? '').join('').trim()
      if (!text) { last = new Error('Gemini vrátil prázdnou odpověď'); continue }
      return text
    } catch (e) {
      last = e as Error
      const status = (e as { status?: number }).status
      if (status === 404 || status === 400) continue
      throw e
    }
  }
  throw last ?? new Error('Žádný dostupný model Gemini')
}

/** Vytáhne JSON (objekt nebo pole) z odpovědi, i když je obalený do ```json. */
export function parseJson<T>(text: string): T {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try { return JSON.parse(clean) as T } catch { /* zkusíme najít první JSON blok */ }
  const m = clean.match(/[\[{][\s\S]*[\]}]/)
  if (!m) throw new Error('Odpověď modelu neobsahuje JSON')
  return JSON.parse(m[0]) as T
}

/** Obrázek z modelu (výchozí gemini-2.5-flash-image); vrací binární data a typ. */
export async function geminiImage(prompt: string, kind = 'cover'): Promise<{ buffer: Buffer; mimeType: string }> {
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'
  const data = await call('v1beta', model, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  }, 55_000)
  await recordUsage(kind, model, data.usageMetadata, 1)
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const img = parts.find(p => p.inlineData?.data)
  if (!img?.inlineData) {
    const reply = parts.map(p => p.text ?? '').join(' ').trim().slice(0, 200)
    throw new Error(`Gemini nevrátilo obrázek${reply ? `: ${reply}` : ''}`)
  }
  return { buffer: Buffer.from(img.inlineData.data, 'base64'), mimeType: img.inlineData.mimeType || 'image/png' }
}
