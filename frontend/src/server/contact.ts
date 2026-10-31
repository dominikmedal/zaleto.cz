import 'server-only'
import { query } from './db'
import { sendMail } from './mail'

const ipTimestamps = new Map<string, number[]>()
function isRateLimited(ip: string) {
  const now = Date.now()
  const times = (ipTimestamps.get(ip) || []).filter(t => now - t < 3_600_000)
  if (times.length >= 5) return true
  times.push(now)
  ipTimestamps.set(ip, times)
  return false
}
const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function sendContact(ip: string, body: { name?: string; email?: string; message?: string; pageUrl?: string }) {
  if (isRateLimited(ip)) return { status: 429, body: { error: 'Příliš mnoho zpráv. Zkuste to za chvíli.' } }
  const { name, email, message, pageUrl } = body
  if (!email?.trim()) return { status: 400, body: { error: 'Zadejte e-mail pro odpověď.' } }
  if (!message?.trim()) return { status: 400, body: { error: 'Zpráva nesmí být prázdná.' } }
  if (message.trim().length > 2000) return { status: 400, body: { error: 'Zpráva je příliš dlouhá.' } }

  // Zpráva se nejdřív uloží do DB, aby se neztratila, ani když selže odeslání e-mailu.
  let rowId: number | null = null
  try {
    await query(`CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY, name TEXT, email TEXT NOT NULL, message TEXT NOT NULL, page_url TEXT,
      emailed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
    const r = await query<{ id: number }>(
      'INSERT INTO contact_messages (name, email, message, page_url) VALUES (?, ?, ?, ?) RETURNING id',
      [name?.trim() || null, email.trim(), message.trim(), pageUrl || null])
    rowId = r.rows[0]?.id ?? null
  } catch (e) { console.error('contact: uložení do DB selhalo', e) }

  const html = `
    <p><strong>Jméno:</strong> ${name ? esc(name) : '—'}</p>
    <p><strong>E-mail:</strong> ${esc(email)}</p><hr>
    <p>${esc(message).split('\n').join('<br>')}</p><hr>
    <p style="color:#888;font-size:12px">Stránka: ${pageUrl ? `<a href="${esc(pageUrl)}">${esc(pageUrl)}</a>` : '—'}<br>Odesláno přes chat widget na zaleto.cz</p>`
  try {
    await sendMail({
      subject: `Zaleto — dotaz od návštěvníka${name ? ` (${name})` : ''}`,
      html,
      text: `Jméno: ${name || '—'}\nE-mail: ${email}\n\n${message}\n\nStránka: ${pageUrl || '—'}`,
      replyTo: email.trim(),
    })
    if (rowId != null) await query('UPDATE contact_messages SET emailed = TRUE WHERE id = ?', [rowId]).catch(() => {})
  } catch (e) {
    console.error('contact: e-mail se nepodařilo odeslat:', e instanceof Error ? e.message : e)
    // zpráva je uložená v DB → návštěvníkovi to nehlásíme jako chybu; bez uložení i bez e-mailu ano
    if (rowId == null) return { status: 500, body: { error: 'Zprávu se nepodařilo odeslat. Napište nám prosím e-mailem.' } }
  }
  return { status: 200, body: { ok: true } }
}
