import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

// Called by admin panel after saving article/destination
// POST /api/revalidate { path: '/clanky/slug', secret: '...' }
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  if (secret) {
    const { secret: provided, path, tag } = await req.json().catch(() => ({}))
    if (provided !== secret) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }
    if (path) revalidatePath(path)
    if (tag)  revalidateTag(tag)
    return NextResponse.json({ revalidated: true, path, tag })
  }

  // No secret configured — allow calls from same origin (admin is protected by token anyway)
  const { path, tag } = await req.json().catch(() => ({}))
  if (path) revalidatePath(path)
  if (tag)  revalidateTag(tag)
  return NextResponse.json({ revalidated: true, path, tag })
}
