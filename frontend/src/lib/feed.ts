/**
 * Rozparsování RSS 2.0 a Atom kanálů (bez závislostí). Položky bez spolehlivého data se vynechají,
 * protože bez něj nepoznáme, že jde o čerstvý článek. Bez importů přes alias `@/`, aby šlo spustit v testech.
 */
export interface FeedItem { url: string; title: string; publishedAt: string | null }

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

export function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = []
  const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/g) ?? []
  for (const b of blocks) {
    const title = decode(b.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const link = b.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/)?.[1] ?? decode(b.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? '')
    const dateRaw = b.match(/<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/)?.[1]
    const d = dateRaw ? new Date(decode(dateRaw)) : null
    if (!title || !/^https?:\/\//.test(link)) continue
    out.push({ url: link, title, publishedAt: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null })
  }
  return out
}
