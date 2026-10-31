import { NextRequest, NextResponse } from 'next/server'
import { clickTarget } from '@/server/carRental'
export const dynamic = 'force-dynamic'
export function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url') ?? undefined
  if (!raw) return new NextResponse('Missing url', { status: 400 })
  const dest = clickTarget(raw)
  if (!dest) return new NextResponse('Forbidden', { status: 403 })
  return NextResponse.redirect(dest.toString(), 302)
}
