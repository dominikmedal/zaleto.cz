/** Booking.com – odkazy na vyhledávání ubytování (bez serverových závislostí, používá se i v prohlížeči). */

export type BookingOrder = 'price' | 'bayesian_review_score' | 'popularity'

export interface BookingSearch {
  /** Hledaný text: destinace, letovisko nebo název hotelu. */
  ss: string
  checkin?: string
  checkout?: string
  adults?: number
  rooms?: number
  order?: BookingOrder
}

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
export const defaultStay = () => ({ checkin: iso(21), checkout: iso(28) })

/** Vlastní vyhledávací URL Booking.com (česky, ceny v Kč). Affiliate obálka CJ se přidává až v /api/booking/click. */
export function buildBookingUrl(p: BookingSearch): string {
  const u = new URL('https://www.booking.com/searchresults.cs.html')
  u.searchParams.set('ss', p.ss)
  if (p.checkin) u.searchParams.set('checkin', p.checkin)
  if (p.checkout) u.searchParams.set('checkout', p.checkout)
  u.searchParams.set('group_adults', String(p.adults ?? 2))
  u.searchParams.set('no_rooms', String(p.rooms ?? 1))
  u.searchParams.set('group_children', '0')
  u.searchParams.set('selected_currency', 'CZK')
  if (p.order) u.searchParams.set('order', p.order)
  return u.toString()
}

/** Hotový odkaz na vyhledávání ubytování v místě (termín za ~3 týdny na 7 nocí), `placement` jde do CJ jako sid. */
export function stayLink(name: string, country: string | null | undefined, placement: string): string {
  const ss = country && country !== name ? `${name}, ${country}` : name
  return bookingClick(buildBookingUrl({ ss, ...defaultStay() }), placement)
}

/** Odkaz přes naši klik-route; `placement` jde do CJ jako sid, takže v reportu uvidíš, které umístění vydělává. */
export function bookingClick(bookingUrl: string, placement: string): string {
  return `/api/booking/click?url=${encodeURIComponent(bookingUrl)}&sid=${encodeURIComponent(placement)}`
}

/**
 * Pokyn pro AI, která píše nový článek: vlastními slovy vložit jeden odkaz na ubytování (adresa je zástupná `ubytovani`,
 * skutečný odkaz doplní applyStayLink). Přidává se do promptu v kódu, aby ho nešlo přepsat v administraci.
 */
export const ARTICLE_STAY_INSTRUCTION = `

DODATEČNÝ POKYN K ODKAZU NA UBYTOVÁNÍ (má přednost před případným pravidlem o zákazu odkazů):
Pokud má článek konkrétní lokalitu, vlož do textu PŘESNĚ JEDEN odkaz na naši nabídku nejlevnějšího ubytování v této lokalitě, v Markdownu ve tvaru [text odkazu](ubytovani). Adresa musí být doslova ubytovani. Odkaz zasaď do věty tam, kde to v článku dává smysl, klidně uprostřed textu, nemusí to být na konci. Formulaci vymysli vlastními slovy tak, aby odpovídala tématu a tónu článku a nezněla jako reklama; vždy ji napiš jinak. Sdělení je, že máme nabídku nejlevnějšího ubytování v dané lokalitě. Odkazem má být jen pár slov uvnitř věty. Nikdy nezmiňuj Booking.com ani žádného jiného partnera. Bez konkrétní lokality odkaz nevkládej.`

const STAY_LINK = /\[([^\]]+)\]\(\/?ubytovani\/?\)/g

/**
 * Po vygenerování článku nahradí zástupný odkaz `(ubytovani)` skutečným affiliate odkazem (bez termínu, aby nezastaral).
 * Nechá první výskyt, další změní na prostý text. Když AI odkaz vynechala, přidá krátkou větu na konec bez zmínky o partnerovi.
 * Bez lokality odkazy odstraní.
 */
export function applyStayLink(content: string, location: string | null | undefined): string {
  const place = (location ?? '').replace(/[()[\]*]/g, '').trim()
  const valid = place && place.toLowerCase() !== 'null'
  const href = valid ? bookingClick(buildBookingUrl({ ss: place }), 'clanek') : ''
  let used = false
  const out = content.replace(STAY_LINK, (_m, text: string) => {
    if (!valid || used) return text
    used = true
    return `[${text}](${href})`
  })
  if (valid && !used) return `${out.trimEnd()}\n\nNabídku [nejlevnějšího ubytování: ${place}](${href}) máme připravenou.`
  return out
}

const PRAGUE = 'Europe/Prague'
const ymd = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: PRAGUE })

/**
 * Nejbližší víkend pátek–neděle (2 noci). V pátek počítá s dneškem, v sobotu a v neděli už s příštím víkendem,
 * protože na ten letošní se většinou nedá rezervovat. `week` je pořadí týdne v roce pro střídání nabídky.
 */
export function nextWeekend(now = new Date()) {
  const today = new Date(`${ymd(now)}T12:00:00Z`)
  const dow = today.getUTCDay() // 0 = neděle … 5 = pátek
  const toFriday = (5 - dow + 7) % 7
  const fri = new Date(today.getTime() + toFriday * 86_400_000)
  const sun = new Date(fri.getTime() + 2 * 86_400_000)
  const f = (d: Date) => `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`
  const week = Math.floor((fri.getTime() - Date.UTC(fri.getUTCFullYear(), 0, 1)) / (7 * 86_400_000))
  return { checkin: ymd(fri), checkout: ymd(sun), label: `pá ${f(fri)} – ne ${f(sun)}`, week }
}

/** Víkendový pobyt v místě, řazený od nejlevnějšího (odkaz přes CJ, `sid` = umístění). */
export function weekendStayLink(ss: string, placement: string): string {
  const w = nextWeekend()
  return bookingClick(buildBookingUrl({ ss, checkin: w.checkin, checkout: w.checkout, order: 'price' }), placement)
}
