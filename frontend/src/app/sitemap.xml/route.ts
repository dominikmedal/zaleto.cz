import { SITE, SITEMAP_IDS } from '@/lib/seo'

/** Index sitemap: odkazuje na jednotlivé části z app/sitemap.ts (generateSitemaps). */
export function GET() {
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    SITEMAP_IDS.map(id => `  <sitemap><loc>${SITE}/sitemap/${id}.xml</loc></sitemap>`).join('\n') +
    `\n</sitemapindex>\n`
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
