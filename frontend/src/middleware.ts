import { NextResponse, type NextRequest } from 'next/server'
import { prefersMarkdown } from '@/lib/agent'

/**
 * Vyjednávání obsahu pro AI agenty: požadavek s `Accept: text/markdown` se přepíše na /api/markdown,
 * který vrátí stejnou stránku jako Markdown. Ostatním (prohlížečům) zůstává HTML; všechny odpovědi nesou `Vary: Accept`,
 * aby CDN a cache nepodstrčily Markdown někomu, kdo chce HTML.
 */
export function middleware(req: NextRequest) {
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

// Bez statických souborů (cokoli s příponou: sitemap.xml, robots.txt, llms.txt, obrázky), /_next a /api.
export const config = {
  matcher: ['/((?!_next/|api/|.*\\..*).*)'],
}
