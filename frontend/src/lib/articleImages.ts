import { fetchDestinationPhoto, type Article } from '@/lib/api'

/** V DB se u článků bez lokality objevuje řetězec "null" – ber ho jako prázdnou hodnotu. */
export function cleanLocation(l: string | null | undefined): string | null {
  const t = (l ?? '').trim()
  return t && t.toLowerCase() !== 'null' && t.toLowerCase() !== 'undefined' ? t : null
}

/** Poslední záchrana, když nejde načíst žádná fotka destinace. */
export const ARTICLE_FALLBACK_IMAGE = '/img/1509.webp'

/**
 * Pestrá sada oblíbených destinací pro články bez vlastního obrázku a bez lokality (typicky „Inspirace“).
 * Každý takový článek dostane jinou fotku, aby karty nepůsobily jako opakovaná výplň.
 */
const FILLER_DESTINATIONS = ['Řecko', 'Turecko', 'Španělsko', 'Chorvatsko', 'Egypt', 'Itálie', 'Kypr', 'Portugalsko', 'Bulharsko', 'Tunisko']

/** Fotky hotelů od CK nejsou jako ilustrace článku vhodné (jsou jen záloha v destinacích). */
const isHotelPhoto = (u: string | null) => !u || /content4travel\.com/.test(u)

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/**
 * Obrázky karet článků podle slugu: vlastní obrázek článku → fotka destinace (podle lokality) → jedna z pestrých
 * fotek oblíbených destinací (každý článek jiná) → lokální záložní fotka.
 * Jedno místo pro homepage, seznam článků, „Čti dál“ i stránku destinace.
 */
export async function articleImageMap(articles: Article[]): Promise<Map<string, string>> {
  const locations = [...new Set(articles.filter(a => !a.custom_image_url).map(a => cleanLocation(a.location)).filter(Boolean) as string[])]
  const needsFiller = articles.some(a => !a.custom_image_url && !cleanLocation(a.location))

  const [photos, fillerPhotos] = await Promise.all([
    Promise.all(locations.map(l => fetchDestinationPhoto(l).catch(() => null))),
    needsFiller ? Promise.all(FILLER_DESTINATIONS.map(d => fetchDestinationPhoto(d).catch(() => null))) : Promise.resolve([] as (string | null)[]),
  ])
  const byLocation = new Map(locations.map((l, i) => [l, photos[i]]))
  const filler = fillerPhotos.filter((u): u is string => !isHotelPhoto(u))

  // Výplňové fotky se přidělují postupně od pozice podle slugu → různé články dostanou různé fotky.
  let used = 0
  const out = new Map<string, string>()
  for (const a of articles) {
    const own = a.custom_image_url ?? byLocation.get(cleanLocation(a.location) ?? '') ?? null
    if (own) { out.set(a.slug, own); continue }
    out.set(a.slug, filler.length ? filler[(hash(a.slug) + used++) % filler.length] : ARTICLE_FALLBACK_IMAGE)
  }
  return out
}
