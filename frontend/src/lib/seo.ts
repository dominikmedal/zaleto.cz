export const SITE = 'https://zaleto.cz'

/** Části sitemapy (každá je vlastní soubor /sitemap/<id>.xml, aby šla v Search Console sledovat zvlášť). */
export const SITEMAP_IDS = ['stranky', 'destinace', 'pruvodce', 'pocasi', 'hotely', 'prehledy', 'clanky', 'pujcovna-aut'] as const
export type SitemapId = (typeof SITEMAP_IDS)[number]

/** Rok, který lidé při hledání zájezdu píšou: od října se plánuje už příští sezóna. */
export function seasonYear(now = new Date()): number {
  return now.getFullYear() + (now.getMonth() >= 9 ? 1 : 0)
}

/** Profily Zaleto na sociálních sítích a v katalozích (pro Organization.sameAs). Čárkou oddělené adresy v NEXT_PUBLIC_SOCIAL_LINKS. */
export const SOCIAL_LINKS: string[] = (process.env.NEXT_PUBLIC_SOCIAL_LINKS ?? '')
  .split(',').map(s => s.trim()).filter(s => s.startsWith('https://'))
