/**
 * Jednoduchý in-memory TTL cache pro API endpointy.
 * Klíč = query string, hodnota = JSON odpověď.
 * Při překročení maxSize se odstraní nejstarší záznamy (FIFO).
 */
class TTLCache {
  constructor(ttlMs = 5 * 60 * 1000, maxSize = 500) {
    this.store  = new Map()
    this.ttl    = ttlMs
    this.maxSize = maxSize
  }

  get(key) {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() - entry.ts > this.ttl) {
      this.store.delete(key)
      return null
    }
    // Přesuň na konec (LRU touch)
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.value
  }

  set(key, value) {
    if (this.store.size >= this.maxSize) {
      // Smaž nejstarší záznam
      this.store.delete(this.store.keys().next().value)
    }
    this.store.set(key, { value, ts: Date.now() })
  }

  delete(key) {
    this.store.delete(key)
  }

  deletePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key)
    }
  }

  invalidate() {
    this.store.clear()
  }

  get size() {
    return this.store.size
  }
}

// Sdílené instance pro jednotlivé endpointy
// Popis hotelu, fotky, amenities se prakticky nemění → dlouhé TTL
// Ceny a termíny se mění denně → kratší TTL
// Po každém scrapingu se volá /api/cache/invalidate — TTL slouží jen jako pojistka,
// ne jako limit čerstvosti. Lze nastavit agresivně.
const hotelsCache      = new TTLCache( 2 * 60 * 60 * 1000,  500)   //  2 hod — výpisy hotelů, filtrování
const hotelDetailCache = new TTLCache(24 * 60 * 60 * 1000, 1000)   // 24 hod — detail hotelu, nearby, slugs (statická data)
const toursCache       = new TTLCache( 4 * 60 * 60 * 1000,  300)   //  4 hod — termíny na detailu hotelu
const metaCache        = new TTLCache( 4 * 60 * 60 * 1000,  500)   //  4 hod — destinations, filters, calendar-prices

module.exports = { hotelsCache, hotelDetailCache, toursCache, metaCache }
