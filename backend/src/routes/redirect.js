const express = require('express')
const router  = express.Router()
const db      = require('../db')

const FISCHER_AFFILIATE   = 'https://www.kqzyfj.com/click-101468674-15041945'
const BLUESTYLE_AFFILIATE = 'https://www.tkqlhce.com/click-101468674-14358779'

function affiliateUrl(url, agency) {
  const a = (agency || '').toLowerCase()
  if (a === 'fischer')    return `${FISCHER_AFFILIATE}?url=${encodeURIComponent(url)}`
  if (a === 'blue style') return `${BLUESTYLE_AFFILIATE}?url=${encodeURIComponent(url)}`
  return url
}

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// GET /api/redirect/:slug?date=YYYY-MM-DD&nights=7&adults=2&tour_url=...
router.get('/:slug', (req, res) => {
  const { slug } = req.params
  const { date, nights, adults = '2', tour_url } = req.query

  if (!date) return res.status(400).json({ error: 'date required' })

  const hotel = db.prepare('SELECT id, agency, api_config FROM hotels WHERE slug = ?').get(slug)
  if (!hotel) return res.status(404).json({ error: 'Hotel nenalezen' })

  const nightsNum = parseInt(nights) || 7
  const adultsNum = Math.max(1, parseInt(adults) || 2)

  // Čedok: URL already contains deeplink — redirect directly (tour_url takes precedence)
  if (hotel.agency === 'Čedok') {
    const destUrl = tour_url || (() => {
      const t = db.prepare(
        'SELECT url FROM tours WHERE hotel_id = ? AND departure_date = ? ORDER BY price ASC LIMIT 1'
      ).get(hotel.id, date)
      return t?.url
    })()
    if (!destUrl) return res.status(404).json({ error: `Termín ${date} nenalezen` })
    console.log(`[redirect] cedok ${slug} ${date} → ${destUrl}`)
    return res.redirect(302, destUrl)
  }

  // Prefer exact tour_url from frontend (avoids wrong-airport fallback)
  let tourUrl = tour_url || null

  if (!tourUrl) {
    let tour = db.prepare(
      'SELECT url FROM tours WHERE hotel_id = ? AND departure_date = ? AND duration = ? ORDER BY price ASC LIMIT 1'
    ).get(hotel.id, date, nightsNum)
    if (!tour) {
      tour = db.prepare(
        'SELECT url FROM tours WHERE hotel_id = ? AND departure_date = ? ORDER BY price ASC LIMIT 1'
      ).get(hotel.id, date)
    }
    if (!tour?.url) return res.status(404).json({ error: `Termín ${date} nenalezen` })
    tourUrl = tour.url
  }

  // Fischer URL parametry (odvozeno z pozorování chování jejich webu):
  //   DF  = sezónní rozsah hotelu — NEMĚNÍ se, zůstává z tourFilterQuery
  //   DD  = datum odjezdu (stejné jako date param, NE departure+nights)
  //   RD  = datum odjezdu (alias k DD)
  //   TO  = letiště|letiště (zdvojené pro odlet|přilet) — zachováváme z tour URL!
  //   NN  = počet nocí
  //   MNN = počet nocí (alias)
  //   NNM = počet nocí (další alias)
  //   MT  = typ dopravy (2 = letecky)

  try {
    const urlObj = new URL(tourUrl)
    const p = urlObj.searchParams

    // Datum odjezdu — DF necháváme z tourFilterQuery beze změny
    p.set('DD', date)
    p.set('RD', date)

    // Počet nocí — všechny varianty parametrů
    p.set('NN',  String(nightsNum))
    p.set('MNN', String(nightsNum))
    p.set('NNM', String(nightsNum))

    // Počet cestujících
    p.set('AC1', String(adultsNum))

    // Typ dopravy
    p.set('MT', '2')

    // TO zdvojit: 4312 → 4312|4312
    const to = p.get('TO') || ''
    if (to && !to.includes('|')) p.set('TO', `${to}|${to}`)

    // DI (strava) a RCS (kategorie pokoje) z api_config
    if (hotel.api_config) {
      try {
        const cfg = JSON.parse(hotel.api_config)
        if (cfg.mealCode && !p.has('DI'))   p.set('DI',  cfg.mealCode)
        const rc = cfg.rooms?.[0]?.roomCode
        if (rc         && !p.has('RCS'))    p.set('RCS', rc)
      } catch { /* ignore */ }
    }

    const finalUrl = urlObj.toString().replace(/%7C/gi, '|')
    const destUrl = affiliateUrl(finalUrl, hotel.agency)
    console.log(`[redirect] ${slug} ${date} → ${destUrl}`)
    res.redirect(302, destUrl)
  } catch {
    const destUrl = affiliateUrl(tourUrl, hotel.agency)
    console.log(`[redirect] fallback ${slug} ${date} → ${destUrl}`)
    res.redirect(302, destUrl)
  }
})

module.exports = router
