import { NextRequest, NextResponse } from 'next/server'
import { updateByToken } from '@/server/travelogues'
import { apiErrorBody } from '@/lib/apiError'
export const dynamic = 'force-dynamic'
export async function PUT(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const r = await updateByToken(params.token, body)
    return NextResponse.json('error' in r.body ? apiErrorBody(r.status, (r.body as { error: string }).error) : r.body, { status: r.status })
  } catch (e) {
    console.error('travelogue update error:', e)
    return NextResponse.json(apiErrorBody(500, 'Úprava se nepodařila.'), { status: 500 })
  }
}
