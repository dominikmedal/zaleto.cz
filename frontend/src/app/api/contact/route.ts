import { NextRequest, NextResponse } from 'next/server'
import { sendContact } from '@/server/contact'
export const dynamic = 'force-dynamic'
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const body = await req.json().catch(() => ({}))
    const r = await sendContact(ip, body)
    return NextResponse.json(r.body, { status: r.status })
  } catch (e) {
    console.error('contact error:', e)
    return NextResponse.json({ error: 'Zprávu se nepodařilo odeslat.' }, { status: 500 })
  }
}
