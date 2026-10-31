import 'server-only'

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

  const key = process.env.RESEND_API_KEY || ''
  const to = (process.env.REPORT_TO || '').split(',').map(s => s.trim()).filter(Boolean)
  const from = process.env.REPORT_FROM || 'zaleto@zaleto.cz'
  if (!key || !to.length) {
    console.warn('RESEND_API_KEY / REPORT_TO není nastaveno — zpráva se neodešle')
    return { status: 200, body: { ok: true } }
  }
  const html = `
    <p><strong>Jméno:</strong> ${name ? esc(name) : '—'}</p>
    <p><strong>E-mail:</strong> ${esc(email)}</p><hr>
    <p>${esc(message).replace(/\n/g, '<br>')}</p><hr>
    <p style="color:#888;font-size:12px">Stránka: ${pageUrl ? `<a href="${esc(pageUrl)}">${esc(pageUrl)}</a>` : '—'}<br>Odesláno přes chat widget na zaleto.cz</p>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: `Zaleto — dotaz od návštěvníka${name ? ` (${name})` : ''}`, html }),
  })
  if (!r.ok) {
    console.error(`Resend error ${r.status}: ${await r.text()}`)
    return { status: 500, body: { error: 'Zprávu se nepodařilo odeslat.' } }
  }
  return { status: 200, body: { ok: true } }
}
