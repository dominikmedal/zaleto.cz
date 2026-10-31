import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { HttpError, type Q } from './hotels'

export function queryOf(req: NextRequest): Q {
  const q: Q = {}
  req.nextUrl.searchParams.forEach((v, k) => { q[k] = v })
  return q
}

/** Obalí service funkci: JSON odpověď, mapování HttpError → status, ostatní chyby → 500. */
export async function respond(fn: () => Promise<unknown>, cache = 'public, s-maxage=300, stale-while-revalidate=60') {
  try {
    const data = await fn()
    return NextResponse.json(data, { headers: { 'Cache-Control': cache } })
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status })
    console.error('[api]', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
