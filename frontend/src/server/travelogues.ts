import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { query } from './db'
import { slugify } from '@/lib/slugify'
import { sendMail } from './mail'

/**
 * Cestopisy od čtenářů. Bez přihlášení:
 *  - kdokoli může cestopis odeslat (stav „pending“, veřejně se neukáže),
 *  - po odeslání dostane autor tajný odkaz pro úpravy (ukládá se jen jeho hash),
 *  - zveřejní ho až admin (stav „approved“).
 */

export interface Travelogue {
  id: number; slug: string; title: string; body: string; author_name: string
  destination: string; dest_slug: string; status: 'pending' | 'approved' | 'rejected'
  created_at: string; approved_at: string | null
}

let ready: Promise<void> | null = null
function ensure(): Promise<void> {
  ready ??= (async () => {
    await query(`CREATE TABLE IF NOT EXISTS travelogues (
      id SERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, body TEXT NOT NULL,
      author_name TEXT NOT NULL, author_email TEXT NOT NULL, destination TEXT NOT NULL, dest_slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', token_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), approved_at TIMESTAMPTZ)`)
    await query('CREATE INDEX IF NOT EXISTS travelogues_dest_idx ON travelogues (dest_slug, status)')
  })().catch(e => { ready = null; throw e })
  return ready
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex')
const COLS = 'id, slug, title, body, author_name, destination, dest_slug, status, created_at, approved_at'

const ipTimes = new Map<string, number[]>()
function limited(ip: string) {
  const now = Date.now()
  const t = (ipTimes.get(ip) ?? []).filter(x => now - x < 3_600_000)
  if (t.length >= 3) return true
  t.push(now); ipTimes.set(ip, t)
  return false
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r/g, '').trim().slice(0, max) : '')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface Input { title?: string; body?: string; author_name?: string; author_email?: string; destination?: string; website?: string; t?: number }

function validate(b: Input) {
  const title = clean(b.title, 140), body = clean(b.body, 15000), author_name = clean(b.author_name, 60)
  const author_email = clean(b.author_email, 120), destination = clean(b.destination, 80)
  if (title.length < 5) return { error: 'Napiš prosím nadpis (alespoň 5 znaků).' }
  if (destination.length < 2) return { error: 'Vyber nebo napiš destinaci.' }
  if (body.length < 300) return { error: 'Cestopis je moc krátký, napiš alespoň pár odstavců (300 znaků).' }
  if (author_name.length < 2) return { error: 'Napiš své jméno nebo přezdívku.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(author_email)) return { error: 'Zadej platný e-mail (nebude zveřejněn).' }
  if ((body.match(/https?:\/\//g) ?? []).length > 3) return { error: 'V textu je příliš mnoho odkazů.' }
  return { title, body, author_name, author_email, destination }
}

/** Odeslání nového cestopisu. Vrací tajný token pro pozdější úpravy. */
export async function submitTravelogue(ip: string, b: Input) {
  // honeypot + příliš rychlé odeslání = bot; tváříme se, že to prošlo
  if (b.website) return { status: 200, body: { ok: true, token: 'x', slug: 'x' } }
  if (typeof b.t === 'number' && Date.now() - b.t < 8000) return { status: 400, body: { error: 'Formulář jsi odeslal(a) moc rychle, zkus to znovu.' } }
  if (limited(ip)) return { status: 429, body: { error: 'Za poslední hodinu jsi poslal(a) víc cestopisů. Zkus to později.' } }
  const v = validate(b)
  if ('error' in v) return { status: 400, body: { error: v.error } }
  await ensure()
  const pending = Number((await query('SELECT COUNT(*) AS n FROM travelogues WHERE status = ?', ['pending'])).rows[0].n)
  if (pending >= 100) return { status: 503, body: { error: 'Čekáme na schválení dříve odeslaných cestopisů. Zkus to prosím později.' } }

  const token = randomBytes(24).toString('hex')
  const base = slugify(v.title).slice(0, 70) || 'cestopis'
  let slug = base
  for (let i = 2; (await query('SELECT 1 FROM travelogues WHERE slug = ?', [slug])).rows.length; i++) slug = `${base}-${i}`
  await query(
    `INSERT INTO travelogues (slug, title, body, author_name, author_email, destination, dest_slug, token_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [slug, v.title, v.body, v.author_name, v.author_email, v.destination, slugify(v.destination), hash(token)])

  // upozornění adminovi (selhání e-mailu nesmí shodit odeslání)
  sendMail({
    subject: `Zaleto — nový cestopis ke schválení: ${v.title}`,
    html: `<p><b>${esc(v.title)}</b> (${esc(v.destination)}) od ${esc(v.author_name)}</p><p><a href="https://zaleto.cz/admin/cestopisy">Schválit v administraci</a></p>`,
  }).catch(() => {})
  return { status: 200, body: { ok: true, token, slug } }
}

/** Úprava přes tajný odkaz; po úpravě se cestopis vrací ke schválení. */
export async function getByToken(token: string) {
  await ensure()
  const r = await query<Travelogue>(`SELECT ${COLS} FROM travelogues WHERE token_hash = ?`, [hash(token)])
  return r.rows[0] ?? null
}
export async function updateByToken(token: string, b: Input) {
  const v = validate({ ...b, author_email: b.author_email || 'x@x.cz' })
  if ('error' in v) return { status: 400, body: { error: v.error } }
  const cur = await getByToken(token)
  if (!cur) return { status: 404, body: { error: 'Odkaz pro úpravy není platný.' } }
  await query(
    `UPDATE travelogues SET title = ?, body = ?, author_name = ?, destination = ?, dest_slug = ?, status = 'pending', approved_at = NULL, updated_at = NOW()
     WHERE id = ?`, [v.title, v.body, v.author_name, v.destination, slugify(v.destination), cur.id])
  return { status: 200, body: { ok: true } }
}

// ── veřejné čtení (jen schválené) ──
export async function approvedTravelogues(opts: { destSlugs?: string[]; limit?: number } = {}): Promise<Travelogue[]> {
  try {
    await ensure()
    const limit = opts.limit ?? 24
    if (opts.destSlugs) {
      if (!opts.destSlugs.length) return []
      const ph = opts.destSlugs.map(() => '?').join(',')
      return (await query<Travelogue>(`SELECT ${COLS} FROM travelogues WHERE status = 'approved' AND dest_slug IN (${ph}) ORDER BY approved_at DESC LIMIT ?`, [...opts.destSlugs, limit])).rows
    }
    return (await query<Travelogue>(`SELECT ${COLS} FROM travelogues WHERE status = 'approved' ORDER BY approved_at DESC LIMIT ?`, [limit])).rows
  } catch { return [] }
}
export async function approvedTravelogue(slug: string): Promise<Travelogue | null> {
  try {
    await ensure()
    return (await query<Travelogue>(`SELECT ${COLS} FROM travelogues WHERE status = 'approved' AND slug = ?`, [slug])).rows[0] ?? null
  } catch { return null }
}

// ── administrace ──
export async function adminListTravelogues(status?: string) {
  await ensure()
  const where = status && ['pending', 'approved', 'rejected'].includes(status) ? 'WHERE status = ?' : ''
  return (await query(`SELECT ${COLS}, author_email FROM travelogues ${where} ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 200`, where ? [status] : [])).rows
}
export async function adminSetTravelogue(id: string, b: { status?: string; title?: string; body?: string }) {
  await ensure()
  const status = ['pending', 'approved', 'rejected'].includes(b.status ?? '') ? b.status : null
  await query(`UPDATE travelogues SET status = COALESCE(?, status), title = COALESCE(?, title), body = COALESCE(?, body),
    approved_at = CASE WHEN ? = 'approved' AND status <> 'approved' THEN NOW() ELSE approved_at END, updated_at = NOW() WHERE id = ?`,
  [status, b.title?.trim() || null, b.body?.trim() || null, status, id])
}
export async function adminDeleteTravelogue(id: string) {
  await ensure()
  await query('DELETE FROM travelogues WHERE id = ?', [id])
}
