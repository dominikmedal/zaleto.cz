/**
 * In-memory TTL cache. Na Vercelu žije jen po dobu „teplé“ instance funkce,
 * takže slouží jako levná první vrstva; trvalé cachování řeší ISR (`revalidate`)
 * a `revalidateTag` po dokončení scrapingu.
 */
class TTLCache<T = unknown> {
  private store = new Map<string, { value: T; ts: number }>()
  constructor(private ttl: number, private maxSize: number) {}

  get(key: string): T | null {
    const e = this.store.get(key)
    if (!e) return null
    if (Date.now() - e.ts > this.ttl) { this.store.delete(key); return null }
    this.store.delete(key)
    this.store.set(key, e)
    return e.value
  }
  set(key: string, value: T) {
    if (this.store.size >= this.maxSize) this.store.delete(this.store.keys().next().value as string)
    this.store.set(key, { value, ts: Date.now() })
  }
  delete(key: string) { this.store.delete(key) }
  deletePrefix(prefix: string) { for (const k of this.store.keys()) if (k.startsWith(prefix)) this.store.delete(k) }
  invalidate() { this.store.clear() }
}

const g = globalThis as unknown as { __zaletoCaches?: Record<string, TTLCache<any>> }
g.__zaletoCaches ??= {
  hotels: new TTLCache(30 * 60 * 1000, 300),
  hotelDetail: new TTLCache(60 * 60 * 1000, 500),
  tours: new TTLCache(30 * 60 * 1000, 200),
  meta: new TTLCache(60 * 60 * 1000, 300),
}
export const hotelsCache = g.__zaletoCaches.hotels
export const hotelDetailCache = g.__zaletoCaches.hotelDetail
export const toursCache = g.__zaletoCaches.tours
export const metaCache = g.__zaletoCaches.meta
