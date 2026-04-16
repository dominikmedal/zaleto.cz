require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const rateLimit = require('express-rate-limit')

const app = express()
const PORT = process.env.PORT || 3001

app.set('trust proxy', 1)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(compression())
app.use(express.json())

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        origin === 'https://zaleto.cz' || origin === 'https://www.zaleto.cz' ||
        (origin || '').endsWith('.vercel.app') ||
        (origin || '').endsWith('.railway.app')) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}))

const hotelsRouter         = require('./routes/hotels')
const toursRouter          = require('./routes/tours')
const metaRouter           = require('./routes/meta')
const redirectRouter       = require('./routes/redirect')
const destPhotosRouter     = require('./routes/destinationPhotos')
const destAIRouter         = require('./routes/destinationAI')
const weatherAIRouter      = require('./routes/weatherAI')
const contactRouter        = require('./routes/contact')
const articlesRouter       = require('./routes/articles')
const adminRouter          = require('./routes/admin')
const carRentalRouter      = require('./routes/carRental')
const { UPLOADS_DIR }      = require('./routes/admin')

app.use('/uploads', express.static(UPLOADS_DIR))
app.use('/api/admin', adminRouter)
app.use('/api/hotels', hotelsRouter)
app.use('/api/hotels/:slug/tours', toursRouter)
const redirectLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Příliš mnoho požadavků, zkuste to za chvíli.' },
})
app.use('/api/redirect', redirectLimiter, redirectRouter)
app.use('/api/destination-photo', destPhotosRouter)
app.use('/api/destination-ai', destAIRouter)
app.use('/api/weather-ai', weatherAIRouter)
app.use('/api/contact', contactRouter)
app.use('/api/articles', articlesRouter)
app.use('/api/car-rental', carRentalRouter)
app.use('/api', metaRouter)

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Invalidace cache po dokončení scrapingu (volá run_all.py)
app.post('/api/cache/invalidate', async (req, res) => {
  const { hotelsCache, hotelDetailCache, toursCache, metaCache } = require('./cache')
  hotelsCache.invalidate()
  hotelDetailCache.invalidate()
  toursCache.invalidate()
  metaCache.invalidate()
  // Resetujeme statsPopulated — scraper mohl aktualizovat hotel_stats
  try { await require('./routes/hotels').resetStats() } catch {}
  // Vygeneruj AI popisy jen při finální invalidaci (konec celého scraping cyklu)
  if (req.query.final === '1') {
    require('./routes/destinationAI').generateMissingAI().catch(() => {})
    // Start weather AI generation 3 min after destination AI (shares same Gemini key)
    setTimeout(() => {
      require('./routes/weatherAI').generateMissingWeatherAI().catch(() => {})
    }, 3 * 60_000)
  }
  res.json({ ok: true })
})

app.use((req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

async function start() {
  const dbUrl = process.env.DATABASE_URL
  console.log(`[db] DATABASE_URL: ${dbUrl ? dbUrl.replace(/:\/\/[^@]+@/, '://***@') : 'NOT SET'}`)

  app.listen(PORT, () => {
    console.log(`\n🚀 Zaleto Backend`)
    console.log(`   http://localhost:${PORT}/api/health\n`)
  })

  try {
    await require('./db').initSchema()
  } catch (e) {
    console.error('[db] initSchema failed:', e.message || e)
    process.exit(1)
  }

  setTimeout(() => {
    require('./db').runMaintenance().catch(e => console.error('[maintenance]', e.message))
  }, 5000)
}

start()
