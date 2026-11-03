import type { Metadata } from 'next'
import Header from '@/components/Header'
import StoryCard from '@/components/ui/StoryCard'
import { articleImageMap } from '@/lib/articleImages'
import SectionHead from '@/components/ui/SectionHead'
import Crumbs from '@/components/ui/Crumbs'
import OfferStrip, { pickOffers } from '@/components/ui/OfferStrip'
import { fetchArticles, fetchHotels } from '@/lib/api'
import LandingOverviews from '@/components/LandingOverviews'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Cestovní deník — články z cest, průvodci a tipy',
  description: 'Články z cest, průvodci po destinacích a konkrétní tipy pro tvoji dovolenou.',
  alternates: { canonical: 'https://zaleto.cz/clanky' },
}

export default async function ClankyPage() {
  const [articles, offers] = await Promise.all([
    fetchArticles(50).catch(() => []),
    fetchHotels({ limit: 24, sort: 'price_asc' }).catch(() => null),
  ])
  const imageMap = await articleImageMap(articles)

  const [lead, ...rest] = articles

  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Články' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Cestovní deník" title="čerstvě z cest" />
        <div style={{ marginBottom: 'var(--space-7)' }}><OfferStrip hotels={pickOffers(offers?.hotels ?? [])} /></div>
        {articles.length === 0 ? (
          <p className="body">Články se připravují.</p>
        ) : (
          <>
            <StoryCard article={lead} lead image={imageMap.get(lead.slug)} />
            {rest.length > 0 && (
              <div className="z-grid-3w" style={{ marginTop: 'var(--space-8)' }}>
                {rest.map(a => <StoryCard key={a.slug} article={a} image={imageMap.get(a.slug)} />)}
              </div>
            )}
          </>
        )}
        <LandingOverviews />
      </main>
    </>
  )
}
