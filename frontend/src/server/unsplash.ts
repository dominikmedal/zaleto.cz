/** Unsplash API: hledání kandidátů na fotku destinace a hlášení použití (povinné podle pravidel API). */

export interface UnsplashHit {
  id: string
  thumb: string
  url: string // urls.regular (~1080 px) – odkaz na CDN Unsplash (hotlink je podle pravidel povinný)
  width: number
  height: number
  alt: string | null
  credit: string
  creditUrl: string
  downloadLocation: string
}

const UTM = 'utm_source=zaleto&utm_medium=referral'

function key(): string {
  const k = process.env.UNSPLASH_ACCESS_KEY
  if (!k) throw new Error('UNSPLASH_ACCESS_KEY není nastavený')
  return k
}

export async function searchUnsplash(q: string, page = 1): Promise<UnsplashHit[]> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&content_filter=high&per_page=12&page=${page}`
  const r = await fetch(url, { headers: { Authorization: `Client-ID ${key()}`, 'Accept-Version': 'v1' }, cache: 'no-store', signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(`Unsplash ${r.status}`)
  const data = await r.json()
  return (data.results ?? []).map((p: any): UnsplashHit => ({
    id: p.id,
    thumb: p.urls.small,
    url: p.urls.regular,
    width: p.width,
    height: p.height,
    alt: p.alt_description ?? p.description ?? null,
    credit: p.user?.name ?? 'Unsplash',
    creditUrl: `${p.user?.links?.html ?? 'https://unsplash.com'}?${UTM}`,
    downloadLocation: p.links.download_location,
  }))
}

/** Pravidla Unsplash API: při skutečném použití fotky se musí zavolat download_location. */
export async function registerDownload(downloadLocation: string): Promise<void> {
  if (!downloadLocation.startsWith('https://api.unsplash.com/')) return
  try {
    await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key()}` }, cache: 'no-store', signal: AbortSignal.timeout(8_000) })
  } catch { /* nezdar nesmí zablokovat uložení */ }
}
