import 'server-only'
import { query } from './db'
import { sendMail, type MailAttachment } from './mail'

/** Poptávky na placené články a spolupráci: formulář s přílohami → e-mail správci (SMTP) + záloha v DB. */

const ipTimestamps = new Map<string, number[]>()
function isRateLimited(ip: string) {
  const now = Date.now()
  const times = (ipTimestamps.get(ip) || []).filter(t => now - t < 3_600_000)
  if (times.length >= 4) return true
  times.push(now)
  ipTimestamps.set(ip, times)
  return false
}

const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Limity: Vercel přijme tělo požadavku nejvýše 4,5 MB, proto přílohy celkem max. 4 MB. */
export const COLLAB_MAX_FILES = 4
export const COLLAB_MAX_TOTAL = 4 * 1024 * 1024
const ALLOWED = new Set(['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'zip'])
export const COLLAB_TYPES = ['Placený článek', 'Placený článek a propagace', 'Jiná spolupráce']

const field = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? '').trim().slice(0, max)

export async function sendCollab(ip: string, fd: FormData): Promise<{ status: number; body: { ok?: true; error?: string } }> {
  // past na roboty: skryté pole a příliš rychlé odeslání (jako u cestopisů) se tváří jako úspěch
  const t = Number(fd.get('t'))
  if (field(fd, 'website', 200) || (t > 0 && Date.now() - t < 3000)) return { status: 200, body: { ok: true } }
  if (isRateLimited(ip)) return { status: 429, body: { error: 'Příliš mnoho zpráv. Zkuste to prosím později.' } }

  const name = field(fd, 'name', 120)
  const company = field(fd, 'company', 160)
  const email = field(fd, 'email', 160)
  const phone = field(fd, 'phone', 40)
  const site = field(fd, 'site', 300)
  const type = COLLAB_TYPES.includes(field(fd, 'type', 60)) ? field(fd, 'type', 60) : COLLAB_TYPES[0]
  const message = field(fd, 'message', 5000)
  if (!name) return { status: 400, body: { error: 'Vyplňte prosím jméno.' } }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { status: 400, body: { error: 'Zadejte prosím platný e-mail.' } }
  if (message.length < 20) return { status: 400, body: { error: 'Napište prosím alespoň pár vět o tom, co plánujete.' } }
  if (fd.get('consent') !== '1') return { status: 400, body: { error: 'Potvrďte prosím souhlas se zpracováním údajů.' } }

  // přílohy
  const files = fd.getAll('files').filter((f): f is File => typeof f !== 'string' && f.size > 0)
  if (files.length > COLLAB_MAX_FILES) return { status: 400, body: { error: `Přiložit můžete nejvýše ${COLLAB_MAX_FILES} soubory.` } }
  let total = 0
  const attachments: MailAttachment[] = []
  for (const f of files) {
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED.has(ext)) return { status: 400, body: { error: `Soubor „${f.name}“ má nepodporovaný typ. Povolené: dokumenty, tabulky, prezentace, obrázky a ZIP.` } }
    total += f.size
    if (total > COLLAB_MAX_TOTAL) return { status: 400, body: { error: 'Přílohy jsou celkem větší než 4 MB. Zkuste je zmenšit, nebo pošlete odkaz do zprávy.' } }
    attachments.push({ filename: f.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120), content: Buffer.from(await f.arrayBuffer()), contentType: f.type || undefined })
  }

  // záloha v DB (bez obsahu příloh), aby se poptávka neztratila, ani když selže e-mail
  let rowId: number | null = null
  try {
    await query(`CREATE TABLE IF NOT EXISTS collab_requests (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, company TEXT, email TEXT NOT NULL, phone TEXT, site TEXT, type TEXT,
      message TEXT NOT NULL, files TEXT, emailed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    const r = await query<{ id: number }>(
      'INSERT INTO collab_requests (name, company, email, phone, site, type, message, files) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
      [name, company || null, email, phone || null, site || null, type, message, attachments.map(a => `${a.filename} (${Math.round(a.content.length / 1024)} kB)`).join(', ') || null])
    rowId = r.rows[0]?.id ?? null
  } catch (e) { console.error('collab: uložení do DB selhalo', e) }

  const row = (k: string, v: string) => `<tr><td style="padding:2px 12px 2px 0;color:#667"><strong>${k}</strong></td><td>${v ? esc(v) : '—'}</td></tr>`
  const html = `<h2 style="margin:0 0 12px">Poptávka spolupráce: ${esc(type)}</h2>
    <table>${row('Jméno', name)}${row('Firma', company)}${row('E-mail', email)}${row('Telefon', phone)}${row('Web / odkaz', site)}${row('Přílohy', attachments.map(a => a.filename).join(', '))}</table><hr>
    <p>${esc(message).split('\n').join('<br>')}</p><hr>
    <p style="color:#888;font-size:12px">Odesláno formulářem na zaleto.cz/spoluprace. Odpovědět můžete přímo na tento e-mail.</p>`
  try {
    await sendMail({
      subject: `Zaleto: spolupráce, ${type.toLowerCase()} (${company || name})`,
      html,
      text: `Typ: ${type}\nJméno: ${name}\nFirma: ${company || '—'}\nE-mail: ${email}\nTelefon: ${phone || '—'}\nWeb: ${site || '—'}\n\n${message}`,
      replyTo: email,
      attachments,
    })
    if (rowId != null) await query('UPDATE collab_requests SET emailed = TRUE WHERE id = ?', [rowId]).catch(() => {})
  } catch (e) {
    console.error('collab: e-mail se nepodařilo odeslat:', e instanceof Error ? e.message : e)
    // poptávka je uložená v DB, návštěvníkovi to nehlásíme jako chybu; bez uložení i bez e-mailu ano
    if (rowId == null) return { status: 500, body: { error: 'Zprávu se nepodařilo odeslat. Napište nám prosím na info@zaleto.cz.' } }
  }
  return { status: 200, body: { ok: true } }
}
