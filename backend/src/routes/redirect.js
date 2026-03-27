const express = require('express')
const router  = express.Router()
const db      = require('../db')

const AFFILIATE = {
  'fischer':    'https://www.anrdoezrs.net/click-101468674-15736055',
  'exim tours': 'https://www.anrdoezrs.net/click-101468674-15736055',
  'nev-dama':   'https://www.anrdoezrs.net/click-101468674-15736055',
  'čedok':      'https://www.jdoqocy.com/click-101468674-15686662',
  'blue style': 'https://www.tkqlhce.com/click-101468674-14358779',
  'tui':        'https://www.kqzyfj.com/click-101468674-15704921',
}

function affiliateUrl(url, agency) {
  const base = AFFILIATE[(agency || '').toLowerCase()]
  return base ? `${base}?url=${encodeURIComponent(url)}` : url
}

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// GET /api/redirect/:slug?date=YYYY-MM-DD&nights=7&adults=2&tour_url=...&agency=...
// agency param (optional) — overrides hotel.agency for affiliate + URL branch selection.
// Used when multi-agency tours appear on a canonical hotel page (e.g. Čedok tour on Fischer page).
router.get('/:slug', async (req, res) => {
  const { slug } = req.params
  const { date, nights, adults = '2', tour_url, agency: agencyOverride } = req.query

  if (!date) return res.status(400).json({ error: 'date required' })

  try {
    const hotelR = await db.query('SELECT id, agency, api_config FROM hotels WHERE slug = ?', [slug])
    const hotel = hotelR.rows[0]
    if (!hotel) return res.status(404).json({ error: 'Hotel nenalezen' })

    const nightsNum = parseInt(nights) || 7
    const adultsNum = Math.max(1, parseInt(adults) || 2)

    // Use agency from query param if provided (multi-agency canonical page),
    // otherwise fall back to the hotel's own agency
    const effectiveAgency = agencyOverride || hotel.agency

    // Čedok: URL already contains deeplink — wrap with affiliate, tour_url takes precedence
    if (effectiveAgency === 'Čedok') {
      let rawUrl = tour_url
      if (!rawUrl) {
        // Hledáme Čedok termín: může být pod jiným hotel_id (canonical slug merging)
        const tr = await db.query(
          `SELECT t.url FROM tours t
           JOIN hotels h ON h.id = t.hotel_id
           WHERE h.canonical_slug = (SELECT canonical_slug FROM hotels WHERE slug = ?)
             AND t.departure_date = ? AND t.agency = 'Čedok'
           ORDER BY t.price ASC LIMIT 1`,
          [slug, date]
        )
        rawUrl = tr.rows[0]?.url
      }
      if (!rawUrl) return res.status(404).json({ error: `Termín ${date} nenalezen` })
      const destUrl = affiliateUrl(rawUrl, effectiveAgency)
      console.log(`[redirect] cedok ${slug} ${date} → ${destUrl}`)
      return res.redirect(302, destUrl)
    }

    // Prefer exact tour_url from frontend
    let tourUrl = tour_url || null

    if (!tourUrl) {
      let tr = await db.query(
        'SELECT url FROM tours WHERE hotel_id = ? AND departure_date = ? AND duration = ? ORDER BY price ASC LIMIT 1',
        [hotel.id, date, nightsNum]
      )
      if (!tr.rows[0]) {
        tr = await db.query(
          'SELECT url FROM tours WHERE hotel_id = ? AND departure_date = ? ORDER BY price ASC LIMIT 1',
          [hotel.id, date]
        )
      }
      if (!tr.rows[0]?.url) return res.status(404).json({ error: `Termín ${date} nenalezen` })
      tourUrl = tr.rows[0].url
    }

    try {
      const urlObj = new URL(tourUrl)
      const p = urlObj.searchParams

      p.set('DD', date)
      p.set('RD', date)
      p.set('NN',  String(nightsNum))
      p.set('MNN', String(nightsNum))
      p.set('NNM', String(nightsNum))
      p.set('AC1', String(adultsNum))
      p.set('MT', '2')

      const to = p.get('TO') || ''
      if (to && !to.includes('|')) p.set('TO', `${to}|${to}`)

      if (hotel.api_config) {
        try {
          const cfg = JSON.parse(hotel.api_config)
          if (cfg.mealCode && !p.has('DI'))   p.set('DI',  cfg.mealCode)
          const rc = cfg.rooms?.[0]?.roomCode
          if (rc         && !p.has('RCS'))    p.set('RCS', rc)
        } catch { /* ignore */ }
      }

      const finalUrl = urlObj.toString().replace(/%7C/gi, '|')
      const destUrl = affiliateUrl(finalUrl, effectiveAgency)
      console.log(`[redirect] ${slug} ${date} → ${destUrl}`)
      res.redirect(302, destUrl)
    } catch {
      const destUrl = affiliateUrl(tourUrl, effectiveAgency)
      console.log(`[redirect] fallback ${slug} ${date} → ${destUrl}`)
      res.redirect(302, destUrl)
    }
  } catch (err) {
    console.error('GET /redirect error:', err)
    res.status(500).json({ error: 'Database error' })
  }
})

module.exports = router
