import { NextRequest } from 'next/server'
import { htmlToMarkdown } from '@/lib/htmlToMarkdown'
import { markdownError } from '@/lib/agent'

export const dynamic = 'force-dynamic'

const HEADERS = {
  'Content-Type': 'text/markdown; charset=utf-8',
  Vary: 'Accept',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
  'X-Robots-Tag': 'noindex',
}

const md = (body: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...HEADERS, 'X-Markdown-Tokens': String(Math.ceil(body.length / 4)), ...extra } })

/**
 * Markdown verze libovolné stránky webu (do ní přepisuje middleware požadavky s `Accept: text/markdown`).
 * Stránku si stáhne jako HTML ze stejného originu a převede ji; 404 a chyby vrací jako Markdown s odkazy na llms.txt a sitemapu.
 */
export async function GET(req: NextRequest) {
  const path = req.headers.get('x-zaleto-md-path') || req.nextUrl.searchParams.get('path') || '/'
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/api/') || path.startsWith('/admin')) {
    return md(markdownError(path, 404), 404)
  }

  let res: Response
  try {
    res = await fetch(new URL(path, req.nextUrl.origin), {
      headers: { accept: 'text/html', 'x-zaleto-markdown': '1', 'user-agent': 'zaleto-markdown/1.0' },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
  } catch {
    return md(markdownError(path, 502), 502, { 'Cache-Control': 'no-store' })
  }

  // přesměrování necháme klienta následovat (kanonická adresa)
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    return new Response(null, { status: res.status, headers: { Vary: 'Accept', ...(location ? { Location: location } : {}) } })
  }
  if (res.status === 404) return md(markdownError(path, 404), 404)
  if (!res.ok) return md(markdownError(path, res.status), res.status, { 'Cache-Control': 'no-store' })

  const html = await res.text()
  const body = htmlToMarkdown(html, new URL(path, 'https://zaleto.cz').toString())
  if (!body) return md(markdownError(path, 404), 404)
  return md(body)
}
