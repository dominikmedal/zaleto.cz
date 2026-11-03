import { NextRequest, NextResponse } from 'next/server'
import { sendCollab } from '@/server/collab'
import { apiErrorBody } from '@/lib/apiError'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/** POST multipart/form-data: poptávka spolupráce (placené články) s přílohami → e-mail správci. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const fd = await req.formData().catch(() => null)
    if (!fd) return NextResponse.json(apiErrorBody(400, 'Neplatný formulář.'), { status: 400 })
    const r = await sendCollab(ip, fd)
    return NextResponse.json(r.body.error ? apiErrorBody(r.status, r.body.error) : r.body, { status: r.status })
  } catch (e) {
    console.error('collab error:', e)
    return NextResponse.json(apiErrorBody(500, 'Zprávu se nepodařilo odeslat.'), { status: 500 })
  }
}
