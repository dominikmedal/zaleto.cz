import 'server-only'

// CJ odkaz Booking.com (PID webu + ID reklamy); funguje jako deeplink přes ?url=, stejně jako u cestovních kanceláří.
const CJ_LINK = process.env.BOOKING_CJ_LINK || 'https://www.kqzyfj.com/click-101468674-14398616'

/** Cíl pro /api/booking/click: jen adresy booking.com, zabalené do CJ deeplinku. Jiná doména → null. */
export function bookingClickTarget(raw: string | undefined, sid?: string | null): URL | null {
  if (!raw) return null
  let dest: URL
  try { dest = new URL(raw) } catch { return null }
  if (dest.protocol !== 'https:' || (dest.hostname !== 'booking.com' && !dest.hostname.endsWith('.booking.com'))) return null
  const out = new URL(CJ_LINK)
  out.searchParams.set('url', dest.toString())
  const cleanSid = (sid ?? '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40)
  if (cleanSid) out.searchParams.set('sid', cleanSid)
  return out
}
