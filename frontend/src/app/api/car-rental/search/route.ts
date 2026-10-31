import { NextRequest, NextResponse } from 'next/server'
import { carSearch } from '@/server/carRental'
import { queryOf } from '@/server/http'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(req: NextRequest) {
  const r = await carSearch(queryOf(req))
  return NextResponse.json(r.body, { status: r.status })
}
