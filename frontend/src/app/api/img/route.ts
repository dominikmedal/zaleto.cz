import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/** Jen důvěryhodné zdroje fotek destinací (žádný otevřený proxy). */
const ALLOWED = new Set(['images.pexels.com'])
const UA = 'zaleto.cz/1.0 (info@zaleto.cz)'

// malá paměťová cache pro warm instanci (Vercel CDN drží zbytek díky Cache-Control)
const mem = new Map<string, { buf: ArrayBuffer; type: string }>()
const MAX_ITEMS = 60
const MAX_BYTES = 2_000_000

async function load(url: string): Promise<{ buf: ArrayBuffer; type: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, cache: 'no-store', signal: AbortSignal.timeout(12_000) })
      if (r.status === 429 || r.status === 503) { await new Promise(res => setTimeout(res, 1200 * (attempt + 1))); continue }
      if (!r.ok) return null
      const type = r.headers.get('content-type') ?? 'image/jpeg'
      if (!type.startsWith('image/')) return null
      return { buf: await r.arrayBuffer(), type }
    } catch { return null }
  }
  return null
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('u')
  if (!raw) return new NextResponse('Missing u', { status: 400 })
  let target: URL
  try { target = new URL(raw) } catch { return new NextResponse('Bad url', { status: 400 }) }
  if (target.protocol !== 'https:' || !ALLOWED.has(target.hostname)) return new NextResponse('Forbidden', { status: 403 })

  const key = target.toString()
  let item = mem.get(key) ?? null
  if (!item) {
    item = await load(key)
    if (!item) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } })
    if (item.buf.byteLength <= MAX_BYTES) {
      if (mem.size >= MAX_ITEMS) mem.delete(mem.keys().next().value as string)
      mem.set(key, item)
    }
  }
  return new NextResponse(item.buf, {
    headers: {
      'Content-Type': item.type,
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  })
}
