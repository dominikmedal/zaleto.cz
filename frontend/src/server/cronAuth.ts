import { timingSafeEqual } from 'node:crypto'
import { apiError } from '@/lib/apiError'

/** Povinná kontrola Bearer tokenu (CRON_SECRET) u automatizace: endpointy stojí peníze (Gemini), proto bez tajemství nikdy nepustí. */
export function checkCron(req: Request): Response | null {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret ?? ''}`
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  return ok ? null : apiError(401, 'Neautorizováno.')
}
