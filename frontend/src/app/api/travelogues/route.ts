import { NextRequest, NextResponse } from 'next/server'
import { submitTravelogue } from '@/server/travelogues'
import { apiErrorBody } from '@/lib/apiError'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const body = await req.json().catch(() => ({}))
    const r = await submitTravelogue(ip, body)
    return NextResponse.json('error' in r.body ? apiErrorBody(r.status, (r.body as { error: string }).error) : r.body, { status: r.status })
  } catch (e) {
    console.error('travelogue error:', e)
    return NextResponse.json(apiErrorBody(500, 'Cestopis se nepodařilo odeslat.'), { status: 500 })
  }
}
