import { NextRequest, NextResponse } from 'next/server'
import { handleAdmin } from '@/server/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

async function run(req: NextRequest, { params }: { params: { path: string[] } }) {
  const ct = req.headers.get('content-type') ?? ''
  let body: unknown = undefined
  let file: File | null = null
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    const f = form?.get('image')
    file = f instanceof File ? f : null
  } else if (req.method !== 'GET' && req.method !== 'DELETE') {
    body = await req.json().catch(() => ({}))
  }
  const r = await handleAdmin(req.method, params.path, req.nextUrl.searchParams, body, req.headers.get('authorization'), file)
  return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } })
}

export const GET = run
export const POST = run
export const PUT = run
export const DELETE = run
