require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')

const app = express()
const PORT = process.env.PORT || 3001

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(compression())
app.use(express.json())

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        origin === 'https://zaleto.cz' || origin === 'https://www.zaleto.cz' ||
        (origin || '').endsWith('.vercel.app')) {
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

app.use('/api/hotels', hotelsRouter)
app.use('/api/hotels/:slug/tours', toursRouter)
app.use('/api/redirect', redirectRouter)
app.use('/api/destination-photo', destPhotosRouter)
app.use('/api', metaRouter)

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use((req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Zaleto Backend`)
  console.log(`   http://localhost:${PORT}/api/health\n`)
})
