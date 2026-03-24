const express = require('express')
const router = express.Router()

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const REPORT_TO      = (process.env.REPORT_TO || '').split(',').map(s => s.trim()).filter(Boolean)
const FROM           = process.env.REPORT_FROM || 'zaleto@zaleto.cz'

// Jednoduchý rate-limit: max 5 zpráv / IP / hodinu
const ipTimestamps = new Map()
function isRateLimited(ip) {
  const now = Date.now()
  const hour = 60 * 60 * 1000
  const times = (ipTimestamps.get(ip) || []).filter(t => now - t < hour)
  if (times.length >= 5) return true
  times.push(now)
  ipTimestamps.set(ip, times)
  return false
}

// POST /api/contact
router.post('/', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || ''
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: 'Příliš mnoho zpráv. Zkuste to za chvíli.' })
    }

    const { name, email, message, pageUrl } = req.body
    if (!email?.trim()) return res.status(400).json({ error: 'Zadejte e-mail pro odpověď.' })
    if (!message?.trim()) return res.status(400).json({ error: 'Zpráva nesmí být prázdná.' })
    if (message.trim().length > 2000) return res.status(400).json({ error: 'Zpráva je příliš dlouhá.' })

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY není nastaveno — zpráva se neodešle')
      return res.json({ ok: true })
    }
    if (!REPORT_TO.length) {
      console.warn('REPORT_TO není nastaveno — zpráva se neodešle')
      return res.json({ ok: true })
    }

    const subject = `Zaleto — dotaz od návštěvníka${name ? ` (${name})` : ''}`
    const html = `
      <p><strong>Jméno:</strong> ${name ? escHtml(name) : '—'}</p>
      <p><strong>E-mail:</strong> ${escHtml(email)}</p>
      <hr>
      <p>${escHtml(message).replace(/\n/g, '<br>')}</p>
      <hr>
      <p style="color:#888;font-size:12px">
        Stránka: ${pageUrl ? `<a href="${escHtml(pageUrl)}">${escHtml(pageUrl)}</a>` : '—'}<br>
        Odesláno přes chat widget na zaleto.cz
      </p>
    `

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: REPORT_TO, subject, html }),
    })

    if (!r.ok) {
      const body = await r.text()
      console.error(`Resend error ${r.status}: ${body}`)
      return res.status(500).json({ error: 'Zprávu se nepodařilo odeslat.' })
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('contact error:', err)
    res.status(500).json({ error: 'Zprávu se nepodařilo odeslat.' })
  }
})

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

module.exports = router
