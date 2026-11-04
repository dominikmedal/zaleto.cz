import { NextRequest, NextResponse } from 'next/server'
import { bookingClickTarget } from '@/server/booking'
export const dynamic = 'force-dynamic'
export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const raw = sp.get('url') ?? undefined
  if (!raw) return new NextResponse('Missing url', { status: 400 })
  const dest = bookingClickTarget(raw, sp.get('sid'))
  if (!dest) return new NextResponse('Forbidden', { status: 403 })
  return NextResponse.redirect(dest.toString(), 302)
}
