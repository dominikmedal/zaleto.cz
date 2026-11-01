import { query } from './db'
import { listDestinations } from './tours'
import { ensureAutomationSchema } from './automationDb'
import type { Q } from './hotels'
import { guideSearchIndex } from './content'
import { searchTravelogues } from './travelogueSearch'

import type { SearchResults } from '@/lib/searchTypes'
export type { SearchResults }

const PAGES = [
  { title: 'Všechny zájezdy', text: 'Hledání zájezdů podle destinace, termínu a ceny', href: '/zajezdy', kw: 'zajezdy dovolena zajezd' },
  { title: 'Last minute', text: 'Zájezdy s odletem v nejbližších týdnech', href: '/zajezdy?tour_type=last_minute', kw: 'last minute posledni chvili' },
  { title: 'First minute', text: 'Zájezdy s předstihem za nižší ceny', href: '/zajezdy?tour_type=first_minute', kw: 'first minute predstih' },
  { title: 'Destinace', text: 'Průvodci po zemích, oblastech a letoviscích', href: '/destinace', kw: 'destinace zeme pruvodce' },
  { title: 'Půjčovna aut', text: 'Srovnání cen půjčoven aut v zahraničí', href: '/pujcovna-aut', kw: 'pujcovna aut auto pronajem rent a car' },
  { title: 'Články', text: 'Cestovní deník – tipy a inspirace', href: '/clanky', kw: 'clanky blog tipy inspirace cestovni denik' },
  { title: 'Počasí a klima', text: 'Teploty a nejlepší doba pro cestu', href: '/pocasi', kw: 'pocasi klima teploty kdy jet' },
  { title: 'Časté otázky', text: 'Odpovědi na nejčastější dotazy', href: '/faq', kw: 'faq caste otazky napoveda' },
  { title: 'Kontakt', text: 'Napiš nám, odpovíme do 24 hodin', href: '/kontakt', kw: 'kontakt podpora email' },
  { title: 'Co je Zaleto', text: 'Jak Zaleto funguje', href: '/o-zaleto', kw: 'o zaleto o nas jak funguje' },
]

/** Bez diakritiky a malými písmeny (stejně jako translate() v SQL níže). */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const slugify = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const SQL_NORM = (col: string) => `translate(lower(${col}), 'áäčďéěëíňóöřšťúůüýž', 'aacdeeeinoorstuuuyz')`

const rank = (name: string, t: string) => {
  const n = norm(name)
  return n === t ? 0 : n.startsWith(t) ? 1 : n.split(/[\s\-/]+/).some(w => w.startsWith(t)) ? 2 : 3
}

/** GET /api/search?q= – hledání napříč destinacemi, zájezdy (hotely), články, půjčovnou aut a stránkami webu. */
export async function siteSearch(q: Q): Promise<SearchResults> {
  const raw = (q.q ?? '').trim().slice(0, 80)
  const limit = Math.min(12, Math.max(1, parseInt(q.limit ?? '') || 6))
  const empty: SearchResults = { q: raw, destinations: [], hotels: [], articles: [], cars: [], places: [], trips: [], pages: [] }
  const t = norm(raw)
  if (t.length < 2) return empty
  const like = `%${t.replace(/[%_\\]/g, m => `\\${m}`)}%`

  await ensureAutomationSchema().catch(() => {})
  const [destRows, hotelRows, articleRows, carRows, guideItems, tripRows] = await Promise.all([
    listDestinations().catch(() => []) as Promise<{ country: string; destination: string; resort_town: string | null; hotel_count: number }[]>,
    query(
      `SELECT h.slug, h.name, h.country, h.resort_town, h.stars, h.thumbnail_url, s.min_price
       FROM hotels h INNER JOIN hotel_stats s ON s.hotel_id = h.id
       WHERE (${SQL_NORM('h.name')} LIKE ? OR ${SQL_NORM('h.resort_town')} LIKE ? OR ${SQL_NORM('h.destination')} LIKE ? OR ${SQL_NORM('h.country')} LIKE ?)
         AND s.min_price IS NOT NULL AND s.next_departure >= CURRENT_DATE::text
         AND (h.canonical_slug IS NULL OR h.canonical_slug = h.slug)
       ORDER BY (${SQL_NORM('h.name')} LIKE ?) DESC, s.min_price ASC LIMIT ?`,
      [like, like, like, like, `${t}%`, limit],
    ).then(r => r.rows).catch(() => []),
    query(
      `SELECT slug, title, location, excerpt, custom_image_url FROM articles
       WHERE status = 'published' AND (${SQL_NORM('title')} LIKE ? OR ${SQL_NORM('location')} LIKE ? OR ${SQL_NORM('excerpt')} LIKE ?)
       ORDER BY (${SQL_NORM('title')} LIKE ?) DESC, published_at DESC LIMIT ?`,
      [like, like, like, like, limit],
    ).then(r => r.rows).catch(() => []),
    query(`SELECT slug, name, country FROM car_rental_ai WHERE intro IS NOT NULL AND (${SQL_NORM('name')} LIKE ? OR ${SQL_NORM('country')} LIKE ?) ORDER BY name LIMIT ?`, [like, like, limit])
      .then(r => r.rows).catch(() => []),
    guideSearchIndex(),
    searchTravelogues(t, limit),
  ])

  const places = guideItems
    .filter(g => norm(g.name).includes(t))
    .sort((a, b) => rank(a.name, t) - rank(b.name, t) || a.name.localeCompare(b.name, 'cs'))
    .slice(0, limit)
    .map(g => ({ name: g.name, kind: g.label, section: g.section, sub: [g.location, g.region].filter(Boolean).join(' · '), photo: g.image, href: g.href }))

  // destinace: země, oblasti a letoviska z nabídky zájezdů
  const map = new Map<string, SearchResults['destinations'][number]>()
  const add = (name: string, kind: 'country' | 'region' | 'resort', country: string | null, count: number) => {
    if (!name || !norm(name).includes(t)) return
    const cur = map.get(name)
    if (cur) cur.count += count
    else map.set(name, { name, kind, country, count, href: `/destinace/${slugify(name)}` })
  }
  for (const r of destRows) {
    add(r.country, 'country', null, r.hotel_count)
    const parts = (r.destination ?? '').split('/').map(s => s.trim())
    const region = parts[1] ?? parts[0]
    if (region && region !== r.country) add(region, 'region', r.country, r.hotel_count)
    if (r.resort_town && r.resort_town !== region) add(r.resort_town, 'resort', r.country, r.hotel_count)
  }
  const kindOrder = { country: 0, region: 1, resort: 2 }
  const destinations = [...map.values()]
    .sort((a, b) => rank(a.name, t) - rank(b.name, t) || kindOrder[a.kind] - kindOrder[b.kind] || b.count - a.count)
    .slice(0, limit)

  return {
    q: raw,
    destinations,
    hotels: hotelRows.map((h: any) => ({
      slug: h.slug, name: h.name, place: [h.resort_town, h.country].filter(Boolean).join(', '), stars: h.stars ?? null,
      price: h.min_price != null ? Number(h.min_price) : null, photo: h.thumbnail_url ?? null, href: `/hotel/${h.slug}`,
    })),
    articles: articleRows.map((a: any) => ({
      slug: a.slug, title: a.title, location: a.location ?? null, excerpt: a.excerpt ?? null,
      image: a.custom_image_url && !String(a.custom_image_url).startsWith('/uploads/') ? a.custom_image_url : null, href: `/clanky/${a.slug}`,
    })),
    places,
    trips: tripRows,
    cars: carRows.map((c: any) => ({ name: c.name, country: c.country, href: `/pujcovna-aut/${c.slug}` })),
    pages: PAGES.filter(p => norm(`${p.title} ${p.kw}`).includes(t)).slice(0, 4).map(({ title, text, href }) => ({ title, text, href })),
  }
}
