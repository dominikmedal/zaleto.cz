// Service Worker — cache-first pro hotelové obrázky z CDN
// Cache se automaticky obnoví každý týden (nový klíč = stará cache smazána)

const WEEK  = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
const CACHE = `zaleto-img-w${WEEK}`

const CDN_ORIGINS = [
  'content4travel.com',   // Čedok
  'fischer.cz',           // Fischer
  'redgalaxy.com',        // TUI
  'siteone.io',           // Blue Style
  'pexels.com',           // destinační fotky
  'booking.com',          // Booking.com
  'wikimedia.org',        // Wikipedia
]

function isCacheable(url) {
  return CDN_ORIGINS.some(o => url.includes(o))
}

// Aktivuj ihned — nepřekrývat s předchozí verzí SW
self.addEventListener('install', () => self.skipWaiting())

// Smaž staré týdenní cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('zaleto-img-') && k !== CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (!isCacheable(event.request.url)) return

  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached

        return fetch(event.request)
          .then(response => {
            // Cachuj ok i opaque (cross-origin bez CORS) odpovědi
            if (response.ok || response.type === 'opaque') {
              cache.put(event.request, response.clone())
            }
            return response
          })
          .catch(() => cached ?? Response.error())
      })
    )
  )
})
