import 'server-only'
import { query } from './db'
import type { Q } from './hotels'

const AFFILIATE: Record<string, string> = {
  'fischer': 'https://www.anrdoezrs.net/click-101468674-15736055',
  'exim tours': 'https://www.dpbolvw.net/click-101468674-15043859',
  'nev-dama': 'https://www.anrdoezrs.net/click-101468674-15736055',
  'čedok': 'https://www.jdoqocy.com/click-101468674-15686662',
  'blue style': 'https://www.tkqlhce.com/click-101468674-14358779',
  'tui': 'https://www.kqzyfj.com/click-101468674-15704921',
}

function affiliateUrl(url: string, agency: string | null | undefined) {
  const base = AFFILIATE[(agency || '').toLowerCase()]
  return base ? `${base}?url=${encodeURIComponent(url)}` : url
}

const addDays = (dateStr: string, n: number) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export type RedirectResult = { url: string } | { error: string; status: number }

/** GET /api/redirect/:slug?date=&nights=&adults=&tour_url=&agency= */
export async function resolveRedirect(slug: string, q: Q): Promise<RedirectResult> {
  let { date, nights, tour_url, agency: agencyOverride } = q
  const { adults = '2' } = q

  // `best=1` (reklamní bannery): vezmi nejlevnější budoucí termín hotelu a pošli rovnou k partnerovi s affiliate odkazem
  if (!date && q.best) {
    const r = await query(
      `SELECT t.departure_date, t.duration, t.url, t.agency FROM tours t JOIN hotels h ON h.id = t.hotel_id
       WHERE (h.slug = ? OR h.canonical_slug = (SELECT canonical_slug FROM hotels WHERE slug = ?))
         AND t.price > 0 AND t.departure_date >= CURRENT_DATE::text
       ORDER BY t.price ASC LIMIT 1`, [slug, slug])
    const best = r.rows[0]
    // bez platného termínu aspoň detail hotelu na Zaletu
    if (!best) return { url: `https://zaleto.cz/hotel/${encodeURIComponent(slug)}` }
    date = best.departure_date
    nights = nights ?? (best.duration != null ? String(best.duration) : undefined)
    tour_url = tour_url ?? best.url ?? undefined
    agencyOverride = agencyOverride ?? best.agency ?? undefined
  }
  if (!date) return { error: 'date required', status: 400 }

  const hotel = (await query('SELECT id, agency, api_config FROM hotels WHERE slug = ?', [slug])).rows[0]
  if (!hotel) return { error: 'Hotel nenalezen', status: 404 }

  const nightsNum = parseInt(nights ?? '') || 7
  const adultsNum = Math.max(1, parseInt(adults) || 2)
  const effectiveAgency: string = agencyOverride || hotel.agency

  if (effectiveAgency.toLowerCase() === 'tui') {
    let tuiUrl = tour_url
    if (!tuiUrl) {
      tuiUrl = (await query('SELECT url FROM tours WHERE hotel_id = ? AND departure_date = ? ORDER BY price ASC LIMIT 1', [hotel.id, date])).rows[0]?.url
    }
    if (!tuiUrl) return { error: `Termín ${date} nenalezen`, status: 404 }
    const offerIdx = tuiUrl.indexOf('/OfferCodeWS/')
    let baseUrl = offerIdx !== -1 ? tuiUrl.substring(0, offerIdx + 1) : tuiUrl.split('?')[0]
    if (!baseUrl.endsWith('/')) baseUrl += '/'
    baseUrl += `?date=${date}`
    return { url: affiliateUrl(baseUrl, effectiveAgency) }
  }

  if (effectiveAgency === 'Čedok') {
    let rawUrl = tour_url
    if (!rawUrl) {
      rawUrl = (await query(
        `SELECT t.url FROM tours t JOIN hotels h ON h.id = t.hotel_id
         WHERE h.canonical_slug = (SELECT canonical_slug FROM hotels WHERE slug = ?)
           AND t.departure_date = ? AND t.agency = 'Čedok' ORDER BY t.price ASC LIMIT 1`, [slug, date])).rows[0]?.url
    }
    if (!rawUrl) return { error: `Termín ${date} nenalezen`, status: 404 }
    return { url: affiliateUrl(rawUrl, effectiveAgency) }
  }

  let tourUrl = tour_url || null
  if (!tourUrl) {
    let tr = await query('SELECT url FROM tours WHERE hotel_id = ? AND departure_date = ? AND duration = ? ORDER BY price ASC LIMIT 1', [hotel.id, date, nightsNum])
    if (!tr.rows[0]) tr = await query('SELECT url FROM tours WHERE hotel_id = ? AND departure_date = ? ORDER BY price ASC LIMIT 1', [hotel.id, date])
    if (!tr.rows[0]?.url) return { error: `Termín ${date} nenalezen`, status: 404 }
    tourUrl = tr.rows[0].url as string
  }

  try {
    const urlObj = new URL(tourUrl!)
    const p = urlObj.searchParams
    p.set('DD', date); p.set('RD', addDays(date, nightsNum))
    p.set('NN', String(nightsNum)); p.set('MNN', String(nightsNum)); p.set('NNM', String(nightsNum))
    p.set('AC1', String(adultsNum)); p.set('MT', '2')
    const to = p.get('TO') || ''
    if (to && !to.includes('|')) p.set('TO', `${to}|${to}`)
    if (hotel.api_config) {
      try {
        const cfg = JSON.parse(hotel.api_config)
        if (cfg.mealCode && !p.has('DI')) p.set('DI', cfg.mealCode)
        const rc = cfg.rooms?.[0]?.roomCode
        if (rc && !p.has('RCS')) p.set('RCS', rc)
      } catch { /* ignore */ }
    }
    return { url: affiliateUrl(urlObj.toString().replace(/%7C/gi, '|'), effectiveAgency) }
  } catch {
    return { url: affiliateUrl(tourUrl!, effectiveAgency) }
  }
}
