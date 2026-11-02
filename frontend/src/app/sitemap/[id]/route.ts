import { NextResponse } from 'next/server'
import { SITEMAP_IDS, type SitemapId } from '@/lib/seo'
import { sitemapEntries, sitemapXml } from '@/server/sitemaps'

// Část sitemapy (/sitemap/hotely.xml). On-demand, Vercel ji cachuje 24 hodin.
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id.replace(/\.xml$/, '')
  if (!(SITEMAP_IDS as readonly string[]).includes(id)) return new NextResponse('Not found', { status: 404 })
  const xml = sitemapXml(await sitemapEntries(id as SitemapId))
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
  })
}
