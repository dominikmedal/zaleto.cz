const express = require('express')
const router = express.Router()
const db = require('../db')
const { metaCache } = require('../cache')

const DEST_EN = {
  'Egypt': 'Egypt beach Red Sea', 'Řecko': 'Greece travel island', 'Turecko': 'Turkey beach resort',
  'Španělsko': 'Spain travel beach', 'Thajsko': 'Thailand beach tropical', 'Maldivky': 'Maldives beach overwater',
  'Dubaj': 'Dubai skyline luxury', 'Chorvatsko': 'Croatia coast Adriatic', 'Tunisko': 'Tunisia beach Mediterranean',
  'Itálie': 'Italy travel coast', 'Kypr': 'Cyprus beach Mediterranean', 'Portugalsko': 'Portugal travel coast',
  'Bulharsko': 'Bulgaria Black Sea beach', 'Maroko': 'Morocco travel medina', 'Mexiko': 'Mexico beach Caribbean',
  'Malta': 'Malta island Mediterranean', 'Dominikánská republika': 'Dominican Republic beach Caribbean',
  'Francie': 'France travel Riviera', 'Gran Canaria': 'Gran Canaria beach Canary Islands',
  'Tenerife': 'Tenerife beach Canary Islands', 'Kréta': 'Crete Greece beach',
  'Rhodos': 'Rhodes Greece island', 'Korfu': 'Corfu Greece island', 'Zakynthos': 'Zakynthos Greece Navagio',
  'Hurghada': 'Hurghada Red Sea beach', 'Sharm el Sheikh': 'Sharm el Sheikh Red Sea',
  'Antalya': 'Antalya Turkey beach resort', 'Bodrum': 'Bodrum Turkey coast',
  'Side': 'Side Turkey beach ancient', 'Alanya': 'Alanya Turkey beach castle',
  'Spojené arabské emiráty': 'UAE Abu Dhabi beach', 'Srí Lanka': 'Sri Lanka beach tropical',
  'Bali': 'Bali Indonesia beach temple', 'Vietnam': 'Vietnam beach Ha Long',
  'Kefalonie': 'Kefalonia Greece beach', 'Santorini': 'Santorini Greece sunset',
  'Mykonos': 'Mykonos Greece beach', 'Lefkada': 'Lefkada Greece beach',
  'Halkidiki': 'Halkidiki Greece beach', 'Kos': 'Kos Greece beach island',
  'Lanzarote': 'Lanzarote Canary Islands', 'Fuerteventura': 'Fuerteventura beach Canary',
  'Mallorca': 'Mallorca Spain beach', 'Ibiza': 'Ibiza Spain beach',
  'Kapverdské ostrovy': 'Cape Verde beach island', 'Zanzibar': 'Zanzibar Tanzania beach',
  'Mauricius': 'Mauritius beach island', 'Seychely': 'Seychelles beach paradise',
}

const STALE_DAYS = 30

// GET /api/destination-photo/:name
router.get('/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name)
  const apiKey = process.env.PEXELS_API_KEY

  // In-memory cache (fast path)
  const cacheKey = `photo_${name}`
  const cached = metaCache.get(cacheKey)
  if (cached !== null && cached !== undefined) {
    return res.set('X-Cache', 'HIT').json({ url: cached })
  }

  try {
    // DB cache
    const cachedR = await db.query(
      'SELECT photo_url, updated_at FROM destination_photos WHERE name = ?',
      [name]
    )
    const row = cachedR.rows[0]
    if (row) {
      const ageDays = (Date.now() - new Date(row.updated_at).getTime()) / 86400000
      if (ageDays < STALE_DAYS) {
        metaCache.set(cacheKey, row.photo_url)
        return res.json({ url: row.photo_url })
      }
    }

    // Fetch from Pexels
    let url = null
    if (apiKey) {
      const query = DEST_EN[name] ?? `${name} travel beach`
      try {
        const r = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
          { headers: { Authorization: apiKey } }
        )
        if (r.ok) {
          const data = await r.json()
          url = data.photos?.[0]?.src?.large2x ?? data.photos?.[0]?.src?.large ?? null
        }
      } catch (e) {
        console.error('Pexels fetch error:', e.message)
      }
    }

    // Upsert DB (even if null — avoids re-fetching missing keys)
    await db.query(
      `INSERT INTO destination_photos (name, photo_url, updated_at)
       VALUES (?, ?, NOW())
       ON CONFLICT (name) DO UPDATE SET photo_url = EXCLUDED.photo_url, updated_at = EXCLUDED.updated_at`,
      [name, url]
    )

    metaCache.set(cacheKey, url)

    res.json({ url })
  } catch (err) {
    console.error('GET /destination-photo error:', err.message)
    res.json({ url: null })
  }
})

module.exports = router
