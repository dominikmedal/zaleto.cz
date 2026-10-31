import { unstable_cache } from 'next/cache'
import * as hotels from './hotels'
import * as tours from './tours'
import * as content from './content'
import * as car from './carRental'
import { HttpError, type Q } from './hotels'

/**
 * Serverové (in-process) volání stejných endpointů, které vystavují route handlery v app/api.
 * Server komponenty tak nemusí volat vlastní HTTP (na Vercelu při buildu žádné neběží).
 */

type Handler = (params: string[], q: Q) => Promise<unknown>
const dec = decodeURIComponent

// Pořadí je důležité: konkrétní cesty před `/api/hotels/:slug`.
const ROUTES: [RegExp, Handler][] = [
  [/^\/api\/hotels$/, (_, q) => hotels.listHotels(q)],
  [/^\/api\/hotels\/geo$/, (_, q) => hotels.hotelsGeo(q)],
  [/^\/api\/hotels\/nearby$/, (_, q) => hotels.nearbyHotels(q)],
  [/^\/api\/hotels\/slugs$/, (_, q) => hotels.hotelSlugs(q)],
  [/^\/api\/hotels\/search$/, (_, q) => hotels.searchHotels(q)],
  [/^\/api\/hotels\/([^/]+)\/reviews$/, ([s]) => hotels.hotelReviews(dec(s))],
  [/^\/api\/hotels\/([^/]+)\/tours$/, ([s], q) => tours.hotelTours(dec(s), q)],
  [/^\/api\/hotels\/([^/]+)$/, ([s]) => hotels.hotelDetail(dec(s))],
  [/^\/api\/destinations$/, () => tours.listDestinations()],
  [/^\/api\/filters$/, () => tours.listFilters()],
  [/^\/api\/calendar-prices$/, (_, q) => tours.calendarPrices(q)],
  [/^\/api\/articles$/, (_, q) => content.listArticles(q)],
  [/^\/api\/articles\/slugs$/, () => content.articleSlugs()],
  [/^\/api\/articles\/([^/]+)$/, ([s]) => content.getArticle(dec(s))],
  [/^\/api\/destination-photo\/([^/]+)$/, ([s]) => content.destinationPhoto(dec(s))],
  [/^\/api\/destination-ai\/([^/]+)$/, ([s]) => content.destinationAI(dec(s))],
  [/^\/api\/weather-ai\/location\/([^/]+)$/, ([s]) => content.weatherLocation(dec(s))],
  [/^\/api\/weather-ai\/([^/]+)$/, ([s]) => content.weatherAI(dec(s))],
  [/^\/api\/car-rental-ai\/([^/]+)$/, ([s]) => content.carRentalAI(dec(s))],
  [/^\/api\/car-rental\/search$/, async (_, q) => (await car.carSearch(q)).body],
  [/^\/api\/car-rental\/autocomplete$/, (_, q) => car.carAutocomplete(q)],
  [/^\/api\/car-rental\/custom-destinations$/, () => car.customCarDestinations()],
  [/^\/api\/car-rental\/enriched-destinations$/, () => car.enrichedCarDestinations()],
]

export interface DispatchResult { ok: boolean; status: number; data: unknown }

async function run(pathname: string, q: Q): Promise<DispatchResult> {
  for (const [re, handler] of ROUTES) {
    const m = pathname.match(re)
    if (!m) continue
    try {
      return { ok: true, status: 200, data: await handler(m.slice(1), q) }
    } catch (e) {
      if (e instanceof HttpError) return { ok: false, status: e.status, data: { error: e.message } }
      console.error('[dispatch]', pathname, e)
      return { ok: false, status: 500, data: { error: 'Database error' } }
    }
  }
  return { ok: false, status: 404, data: { error: 'Not found' } }
}

export async function dispatch(
  path: string,
  opts: { revalidate?: number | false; tags?: string[] } = {},
): Promise<DispatchResult> {
  const url = new URL(path, 'http://internal')
  const q: Q = {}
  url.searchParams.forEach((v, k) => { q[k] = v })
  const sorted = JSON.stringify(Object.entries(q).sort())
  const revalidate = opts.revalidate === undefined ? 300 : opts.revalidate

  if (revalidate === 0) return run(url.pathname, q)

  // Data cache Next.js: přežije mezi requesty i buildy, invaliduje se přes revalidateTag / čas.
  const cached = unstable_cache(
    async () => {
      const r = await run(url.pathname, q)
      // chyby se nesmí cachovat – vyhodíme výjimku a zachytíme ji o úroveň výš
      if (!r.ok) throw Object.assign(new Error('uncacheable'), { result: r })
      return r
    },
    ['api', url.pathname, sorted],
    { revalidate: revalidate === false ? false : revalidate, tags: ['api', ...(opts.tags ?? [])] },
  )
  try {
    return await cached()
  } catch (e) {
    const r = (e as { result?: DispatchResult }).result
    if (r) return r
    throw e
  }
}
