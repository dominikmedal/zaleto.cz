import { fetchDestinationPhoto, type Article } from '@/lib/api'

/** V DB se u článků bez lokality objevuje řetězec "null" – ber ho jako prázdnou hodnotu. */
export function cleanLocation(l: string | null | undefined): string | null {
  const t = (l ?? '').trim()
  return t && t.toLowerCase() !== 'null' && t.toLowerCase() !== 'undefined' ? t : null
}

/** Záložní fotka pro články bez vlastního obrázku a bez lokality (např. „Inspirace“). */
export const ARTICLE_FALLBACK_IMAGE = '/img/1509.webp'

/**
 * Obrázky karet článků podle slugu: vlastní obrázek článku → fotka destinace (podle lokality) → záložní fotka.
 * Jedno místo pro homepage, seznam článků, „Čti dál“ i stránku destinace (dřív to uměl jen seznam /clanky,
 * proto měly karty jinde prázdné místo místo fotky).
 */
export async function articleImageMap(articles: Article[]): Promise<Map<string, string>> {
  const locations = [...new Set(articles.filter(a => !a.custom_image_url).map(a => cleanLocation(a.location)).filter(Boolean) as string[])]
  const photos = await Promise.all(locations.map(l => fetchDestinationPhoto(l).catch(() => null)))
  const byLocation = new Map(locations.map((l, i) => [l, photos[i]]))
  return new Map(articles.map(a => [
    a.slug,
    a.custom_image_url ?? byLocation.get(cleanLocation(a.location) ?? '') ?? ARTICLE_FALLBACK_IMAGE,
  ]))
}
