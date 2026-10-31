import { NextResponse, type NextRequest } from 'next/server'
import { prefersMarkdown } from '@/lib/agent'
import { apiError } from '@/lib/apiError'

/** Veřejné endpointy jen pro čtení: jiná metoda než GET/HEAD/OPTIONS = JSON chyba 405 (jinak by Next vrátil prázdné 405). */
const READ_ONLY_API = /^\/api\/(search|hotels|destinations|filters|calendar-prices|articles|destination-ai|weather-ai|car-rental-ai|destination-photo|health)(\/|$)/

/**
 * Vyjednávání obsahu pro AI agenty: požadavek s `Accept: text/markdown` se přepíše na /api/markdown,
 * který vrátí stejnou stránku jako Markdown. Ostatním (prohlížečům) zůstává HTML; všechny odpovědi nesou `Vary: Accept`,
 * aby CDN a cache nepodstrčily Markdown někomu, kdo chce HTML.
 */
export function middleware(req: NextRequest) {
  const { pathname: apiPath } = req.nextUrl
  if (apiPath.startsWith('/api/')) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && READ_ONLY_API.test(apiPath)) {
      return apiError(405, 'Tato metoda není u tohoto endpointu podporovaná.', undefined, { Allow: 'GET, HEAD, OPTIONS' })
    }
    return NextResponse.next()
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return NextResponse.next()
  // interní stažení HTML z route /api/markdown
  if (req.headers.get('x-zaleto-markdown') === '1') return NextResponse.next()

  const { pathname, search } = req.nextUrl
  if (pathname.startsWith('/admin')) return NextResponse.next()

  if (prefersMarkdown(req.headers.get('accept'))) {
    const url = req.nextUrl.clone()
    url.pathname = '/api/markdown'
    url.search = ''
    // cestu předáváme hlavičkou (query u přepsaného požadavku se v route handleru neslučuje spolehlivě)
    const headers = new Headers(req.headers)
    headers.set('x-zaleto-md-path', pathname + search)
    return NextResponse.rewrite(url, { request: { headers } })
  }

  const res = NextResponse.next()
  res.headers.append('Vary', 'Accept')
  return res
}

// Bez statických souborů (cokoli s příponou: sitemap.xml, robots.txt, llms.txt, obrázky) a /_next.
export const config = {
  matcher: ['/((?!_next/|.*\\..*).*)'],
}
