import { NextResponse } from 'next/server'
import { checkCron } from '@/server/cronAuth'
import { apiError } from '@/lib/apiError'
import { publishScheduled } from '@/server/autoArticles'

export const dynamic = 'force-dynamic'

/** Volá se každých 10 minut z GitHub Actions: zveřejní naplánované články, kterým nadešel čas. */
export async function GET(req: Request) {
  const denied = checkCron(req)
  if (denied) return denied
  try { return NextResponse.json(await publishScheduled()) } catch (e) {
    console.error('[publish-scheduled]', e)
    return apiError(500, e instanceof Error ? e.message : 'Chyba')
  }
}
