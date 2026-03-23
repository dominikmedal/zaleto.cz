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

  invalidate() {
    this.store.clear()
  }

  get size() {
    return this.store.size
  }
}

// Sdílené instance pro jednotlivé endpointy
const hotelsCache = new TTLCache(5 * 60 * 1000, 500)   // 5 min, max 500 queries
const metaCache   = new TTLCache(10 * 60 * 1000, 50)   // 10 min

module.exports = { hotelsCache, metaCache }
