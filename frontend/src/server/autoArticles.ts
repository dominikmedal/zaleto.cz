import { revalidatePath, revalidateTag } from 'next/cache'
import { Readability } from '@mozilla/readability'
import { put } from '@vercel/blob'
import { query } from './db'
import { metaCache } from './cache'
import { ensureAutomationSchema } from './automationDb'
import { geminiText, geminiImage, parseJson } from './gemini'
import { renderPrompt } from './prompts'
import { ARTICLE_STAY_INSTRUCTION, applyStayLink } from '@/lib/booking'
import { searchUnsplash, registerDownload } from './unsplash'
import { slugify } from '@/lib/slugify'
import { parseFeed, type FeedItem } from '@/lib/feed'

/**
 * Denní automatika článků (stejný postup jako u projektu dominikmedal.cz), rozdělená na krátké kroky,
 * aby každé volání vyhovělo časovému limitu funkcí na Vercelu (kroky řídí .github/workflows/auto-publish.yml):
 *   1. pickForToday()    – projde RSS zdroje, Gemini ohodnotí čerstvé články, vybere až N s dostatečným skóre
 *   2. processArticle()  – stáhne zdroj, přepíše ho vlastními slovy (prompt z administrace) a uloží jako „naplánovaný“
 *   3. generateCover()   – titulní obrázek: fotka z Unsplash (s autorem), jinak obrázek z Gemini (prompt z administrace)
 * publishScheduled() (každých 10 minut) pak zveřejní články, kterým nadešel čas.
 */

const FRESH_HOURS = 48          // „čerstvé“ = zveřejněné v tomto okně (zdroje mají různé časové zóny a frekvence)
const MAX_CANDIDATES = 40       // drží hodnotící prompt malý a levný
const FIRST_DELAY_MIN = 15      // první článek vyjde brzy po běhu, další se rozloží přes den
const SPACING_MIN = 150
const DAY_WINDOW_HOURS = 20     // limit „za den“ počítá vše automaticky vydané v tomto okně
const CATEGORIES = ['Průvodce', 'Inspirace', 'Tipy', 'Destinace']

export interface Decision {
  title: string; url: string; sourceName: string; score: number | null; reason: string; picked: boolean
  scheduledAt?: string; articleId?: number; error?: string
}

export interface Settings { enabled: boolean; max_per_day: number; min_score: number }

export async function getSettings(): Promise<Settings> {
  await ensureAutomationSchema()
  return (await query<Settings>('SELECT enabled, max_per_day, min_score FROM automation_settings WHERE id = 1')).rows[0]
}

// ── RSS / Atom ──────────────────────────────────────────────────────────────

async function fetchFeed(url: string): Promise<FeedItem[]> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZaletoBot/1.0; +https://zaleto.cz)' }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Kanál ${url}: HTTP ${res.status}`)
  return parseFeed(await res.text())
}

// ── běhy ────────────────────────────────────────────────────────────────────

async function logRun(candidates: number, decisions: Decision[], note: string | null) {
  const r = await query<{ id: number }>('INSERT INTO auto_publish_runs (candidates, decisions, note) VALUES (?, ?, ?) RETURNING id', [candidates, JSON.stringify(decisions), note])
  return r.rows[0].id
}

/** Doplní jedno rozhodnutí běhu (podle url) – použijí další kroky pro uložení id článku nebo chyby. */
export async function updateDecision(runId: number | undefined, url: string, patch: Partial<Decision>) {
  if (!runId) return
  const run = (await query<{ decisions: Decision[] }>('SELECT decisions FROM auto_publish_runs WHERE id = ?', [runId])).rows[0]
  if (!run) return
  const decisions = run.decisions.map(d => (d.url === url ? { ...d, ...patch } : d))
  await query('UPDATE auto_publish_runs SET decisions = ? WHERE id = ?', [JSON.stringify(decisions), runId])
}

export async function pickForToday(): Promise<{ runId?: number; picks: { url: string; title: string; scheduledAt: string }[]; skipped?: string }> {
  const settings = await getSettings()
  if (!settings.enabled) return { skipped: 'Automatické zveřejňování je vypnuté.', picks: [] }

  const already = (await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM articles WHERE auto_published = TRUE AND generated_at >= NOW() - INTERVAL '${DAY_WINDOW_HOURS} hours'`)).rows[0].n
  const remaining = settings.max_per_day - already
  if (remaining <= 0) {
    await logRun(0, [], `Denní limit (${settings.max_per_day}) už je vyčerpaný.`)
    return { skipped: 'Denní limit už je vyčerpaný.', picks: [] }
  }

  const sources = (await query<{ name: string; feed_url: string }>('SELECT name, feed_url FROM scrape_sources WHERE enabled = TRUE ORDER BY id')).rows
  const used = new Set((await query<{ source_url: string }>('SELECT source_url FROM articles WHERE source_url IS NOT NULL')).rows.map(r => r.source_url))

  const results = await Promise.allSettled(sources.map(s => fetchFeed(s.feed_url)))
  const cutoff = Date.now() - FRESH_HOURS * 3600_000
  const seen = new Set<string>()
  const candidates: { url: string; title: string; sourceName: string; publishedAt: string }[] = []
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    for (const it of r.value) {
      if (!it.publishedAt || used.has(it.url) || seen.has(it.url) || new Date(it.publishedAt).getTime() < cutoff) continue
      seen.add(it.url)
      candidates.push({ url: it.url, title: it.title, sourceName: sources[i].name, publishedAt: it.publishedAt })
    }
  })
  candidates.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  const list = candidates.slice(0, MAX_CANDIDATES)
  if (!list.length) {
    await logRun(0, [], 'Žádné čerstvé články ve zdrojích.')
    return { skipped: 'Žádné čerstvé články.', picks: [] }
  }

  const existingRows = (await query<{ title: string; location: string | null }>(
    `SELECT title, location FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 60`)).rows
  const existing = existingRows.map(a => `- ${a.title}${a.location ? ` [${a.location}]` : ''}`).join('\n') || '(zatím žádné)'
  const offer = list.map((c, i) => `${i + 1}. [${c.sourceName}] ${c.title}`).join('\n')

  const month = new Date().toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'Europe/Prague' })
  const prompt = await promptFor('auto_select', { existing, candidates: offer, max: remaining, month })
  const verdicts = parseJson<{ index: number; score: number; reason: string }[]>(await geminiText(prompt, { temperature: 0.2, maxTokens: 6000, kind: 'article_select' }))
  const byIndex = new Map(verdicts.map(v => [Number(v.index), v]))

  const chosen = verdicts
    .filter(v => Number(v.score) >= settings.min_score && list[Number(v.index) - 1])
    .sort((a, b) => b.score - a.score
      || new Date(list[b.index - 1].publishedAt).getTime() - new Date(list[a.index - 1].publishedAt).getTime())
    .slice(0, remaining)
  const chosenIdx = new Set(chosen.map(v => Number(v.index)))

  const decisions: Decision[] = list.map((c, i) => {
    const v = byIndex.get(i + 1)
    return { title: c.title, url: c.url, sourceName: c.sourceName, score: v ? Number(v.score) : null, reason: v?.reason ?? 'Nehodnoceno.', picked: chosenIdx.has(i + 1) }
  })

  const base = Date.now() + FIRST_DELAY_MIN * 60_000
  const picks: { url: string; title: string; scheduledAt: string }[] = []
  chosen.forEach((v, n) => {
    const c = list[v.index - 1]
    const scheduledAt = new Date(base + n * SPACING_MIN * 60_000).toISOString()
    picks.push({ url: c.url, title: c.title, scheduledAt })
    decisions[v.index - 1].scheduledAt = scheduledAt
  })

  const runId = await logRun(list.length, decisions, picks.length ? null : `Nic nedosáhlo skóre ${settings.min_score}+, nic se nepublikuje.`)
  return { runId, picks }
}

async function promptFor(key: string, vars: Record<string, string | number>) {
  const text = await renderPrompt(key, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v)])))
  return text
}

/** Stáhne čitelný text zdrojového článku (Mozilla Readability). */
async function scrapeArticle(url: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZaletoBot/1.0; +https://zaleto.cz)' }, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Nepodařilo se stáhnout ${url}: HTTP ${res.status}`)
  const { JSDOM } = await import('jsdom') // načítá se až při použití (těžká závislost)
  const dom = new JSDOM(await res.text(), { url })
  const art = new Readability(dom.window.document).parse()
  if (!art?.textContent || art.textContent.trim().length < 600) throw new Error('Ze stránky se nepodařilo získat dostatek čitelného textu.')
  return { title: art.title || '', text: art.textContent.replace(/\s+/g, ' ').trim(), siteName: art.siteName || new URL(url).hostname }
}

export function afterArticleChange(slug?: string) {
  metaCache.deletePrefix('articles_')
  metaCache.delete('article_slugs')
  if (slug) metaCache.delete(`article_${slug}`)
  try {
    revalidateTag('articles'); revalidateTag('api')
    if (slug) { revalidateTag(`article-${slug}`); revalidatePath(`/clanky/${slug}`) }
    revalidatePath('/clanky'); revalidatePath('/')
  } catch { /* mimo kontext požadavku */ }
}

export async function processArticle(url: string, scheduledAt: Date, runId?: number): Promise<{ articleId?: number; skipped?: string }> {
  const settings = await getSettings()
  if (!settings.enabled) return { skipped: 'Automatické zveřejňování je vypnuté.' }
  if ((await query('SELECT id FROM articles WHERE source_url = ?', [url])).rows.length) return { skipped: 'Článek už existuje.' }

  const src = await scrapeArticle(url)
  const prompt = (await promptFor('auto_rewrite', { sourceTitle: src.title, sourceName: src.siteName, text: src.text.slice(0, 14000) })) + ARTICLE_STAY_INSTRUCTION
  const r = parseJson<{ title: string; category: string; location: string | null; excerpt: string; content: string; reading_time: number; image_query?: string }>(
    await geminiText(prompt, { temperature: 0.7, maxTokens: 8192, kind: 'article_rewrite' }))
  if (!r.title || !r.content || r.content.length < 800) throw new Error('Přepsaný článek je příliš krátký nebo neúplný.')
  r.content = applyStayLink(r.content, r.location)

  const base = slugify(r.title).slice(0, 80) || 'clanek'
  let slug = base
  for (let n = 2; (await query('SELECT id FROM articles WHERE slug = ?', [slug])).rows.length; n++) slug = `${base}-${n}`

  const words = r.content.split(/\s+/).length
  const ins = await query<{ id: number }>(
    `INSERT INTO articles (topic, slug, title, category, location, excerpt, content, reading_time, published_at, generated_at,
                           status, scheduled_at, auto_published, source_url, source_name, image_query)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'scheduled', ?, TRUE, ?, ?, ?) RETURNING id`,
    [`auto:${url}`, slug, r.title, CATEGORIES.includes(r.category) ? r.category : 'Inspirace', r.location || null, r.excerpt || null, r.content,
      Math.min(10, Math.max(2, Number(r.reading_time) || Math.round(words / 200))), scheduledAt.toISOString(), scheduledAt.toISOString(), url, src.siteName, (r.image_query || '').slice(0, 80) || null])
  const id = ins.rows[0].id
  await updateDecision(runId, url, { articleId: id })
  return { articleId: id }
}

/** Fotka z Unsplash k článku (landscape, dost velká, ještě nepoužitá u jiného článku); null, když nic nevyhovuje. */
async function unsplashCover(a: { id: number; location: string | null; image_query: string | null }) {
  if (!process.env.UNSPLASH_ACCESS_KEY) return null
  const queries = [a.image_query, a.location ? `${a.location} travel` : null].filter((q): q is string => !!q)
  for (const q of queries) {
    let hits
    try { hits = await searchUnsplash(q) } catch { continue }
    for (const h of hits) {
      if (h.width < 2000 || h.width / h.height < 1.3) continue
      const dup = await query('SELECT 1 FROM articles WHERE custom_image_url = ? AND id <> ? LIMIT 1', [h.url, a.id])
      if (dup.rows.length) continue
      await registerDownload(h.downloadLocation) // povinné hlášení použití podle pravidel Unsplash API
      return h
    }
  }
  return null
}

/** Po změně obrázku obnoví cache, aby se nový obrázek hned projevil u už zveřejněného článku. */
async function refreshAfterCover(id: number) {
  const slug = (await query<{ slug: string }>('SELECT slug FROM articles WHERE id = ?', [id])).rows[0]?.slug
  afterArticleChange(slug)
}

/** Titulní obrázek článku: nejdřív fotka z Unsplash (s uvedením autora), když žádná nevyhovuje, obrázek z Gemini (prompt z administrace). */
export async function generateCover(articleId: number): Promise<{ imageUrl: string; source: 'unsplash' | 'gemini' }> {
  const a = (await query<{ id: number; title: string; excerpt: string | null; location: string | null; content: string | null; image_query: string | null }>(
    'SELECT id, title, excerpt, location, content, image_query FROM articles WHERE id = ?', [articleId])).rows[0]
  if (!a) throw new Error('Článek neexistuje.')

  const photo = await unsplashCover(a)
  if (photo) {
    await query('UPDATE articles SET custom_image_url = ?, custom_image_credit = ?, custom_image_credit_url = ? WHERE id = ?', [photo.url, photo.credit, photo.creditUrl, a.id])
    await refreshAfterCover(a.id)
    return { imageUrl: photo.url, source: 'unsplash' }
  }

  const prompt = await promptFor('auto_cover', { title: a.title, summary: a.excerpt || (a.content ?? '').slice(0, 400), location: a.location ?? '' })
  const { buffer, mimeType } = await geminiImage(prompt)
  const ext = mimeType.split('/')[1]?.split('+')[0] || 'png'
  const blob = await put(`articles/${a.id}-${Date.now()}.${ext}`, buffer, { access: 'public', contentType: mimeType, addRandomSuffix: true })
  await query(`UPDATE articles SET custom_image_url = ?, custom_image_credit = 'AI', custom_image_credit_url = NULL WHERE id = ?`, [blob.url, a.id])
  await refreshAfterCover(a.id)
  return { imageUrl: blob.url, source: 'gemini' }
}

/** Při chybě generování obrázku se článek vrátí do konceptů, ať se nezveřejní bez titulky. */
export async function moveToDraft(articleId: number) {
  await query(`UPDATE articles SET status = 'draft' WHERE id = ?`, [articleId])
}

/** Zveřejní naplánované články, kterým nadešel čas. */
export async function publishScheduled(): Promise<{ published: number; articles: { id: number; slug: string; title: string }[] }> {
  await ensureAutomationSchema()
  const r = await query<{ id: number; slug: string; title: string }>(
    `UPDATE articles SET status = 'published', published_at = NOW()
     WHERE status = 'scheduled' AND scheduled_at <= NOW() RETURNING id, slug, title`)
  if (r.rows.length) { for (const a of r.rows) afterArticleChange(a.slug) }
  return { published: r.rows.length, articles: r.rows }
}
