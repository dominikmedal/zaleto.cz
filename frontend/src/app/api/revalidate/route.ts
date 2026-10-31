import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { isAuthorized } from '@/server/admin'

export const dynamic = 'force-dynamic'

function secretOk(provided: unknown): boolean {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret || typeof provided !== 'string') return false
  const a = Buffer.from(provided), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * POST /api/revalidate  { path?, tag?, secret? }
 * Autorizace: REVALIDATE_SECRET v těle (scraper / GitHub Actions) NEBO admin Bearer token (admin panel).
 * Bez jedné z nich vrací 401 – žádný otevřený režim.
 */
export async function POST(req: NextRequest) {
  const { path, tag, secret } = await req.json().catch(() => ({} as Record<string, unknown>))
  if (!secretOk(secret) && !isAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (typeof path === 'string') revalidatePath(path)
  if (typeof tag === 'string') revalidateTag(tag)
  return NextResponse.json({ revalidated: true, path, tag })
}
