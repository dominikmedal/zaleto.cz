const express = require('express')
const router  = express.Router()

const AFF_BASE = 'https://www.dpbolvw.net/click-101468674-14358779'

// GET /api/aff-redirect?url=<encoded-destination>
router.get('/', (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).json({ error: 'url required' })

  // Validace — přijímáme jen http/https URL
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return res.status(400).json({ error: 'invalid url' })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'invalid url' })
  }

  const destination = `${AFF_BASE}?url=${encodeURIComponent(url)}`
  console.log(`[aff-redirect] → ${destination}`)
  res.redirect(302, destination)
})

module.exports = router
