import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 20

/** Povolené šířky (shodné s src/lib/imageLoader.ts) – brání zneužití a drží malý počet variant v CDN cache. */
const WIDTHS = new Set([96, 192, 240, 320, 360, 400, 480, 640, 720, 800, 900, 960, 1200, 1600])
const MAX_SRC_BYTES = 25_000_000
const IP_LITERAL = /^(\d{1,3}\.){3}\d{1,3}$|^\[|^localhost$|\.local$|\.internal$/i

/** Zmenšená WebP fotka z libovolného veřejného https zdroje. Odpověď je neměnná, takže ji CDN drží natrvalo (jedno zpracování na fotku a šířku). */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('u')
  const w = Number(req.nextUrl.searchParams.get('w'))
  const q = Math.min(90, Math.max(40, Number(req.nextUrl.searchParams.get('q')) || 72))
  if (!raw || !WIDTHS.has(w)) return new NextResponse('Bad request', { status: 400 })
  let target: URL
  try { target = new URL(raw) } catch { return new NextResponse('Bad url', { status: 400 }) }
  if (target.protocol !== 'https:' || IP_LITERAL.test(target.hostname)) return new NextResponse('Forbidden', { status: 403 })

  try {
    const r = await fetch(target, { headers: { 'User-Agent': 'zaleto.cz/1.0 (info@zaleto.cz)', Accept: 'image/*' }, signal: AbortSignal.timeout(12_000) })
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return notFound()
    if (Number(r.headers.get('content-length') ?? 0) > MAX_SRC_BYTES) return notFound()
    const input = Buffer.from(await r.arrayBuffer())
    if (input.byteLength > MAX_SRC_BYTES) return notFound()
    const out = await sharp(input, { failOn: 'none' }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: q }).toBuffer()
    return new NextResponse(new Uint8Array(out), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    })
  } catch {
    return notFound()
  }
}

function notFound() {
  return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } })
}
