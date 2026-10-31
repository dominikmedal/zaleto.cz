import { NextRequest, NextResponse } from 'next/server'
import { resolveRedirect } from '@/server/redirect'
import { queryOf } from '@/server/http'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const r = await resolveRedirect(params.slug, queryOf(req))
    if ('url' in r) return NextResponse.redirect(r.url, 302)
    return NextResponse.json({ error: r.error }, { status: r.status })
  } catch (e) {
    console.error('GET /redirect error:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
