import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import Crumbs from '@/components/ui/Crumbs'
import ArticleBody from '@/components/ui/ArticleBody'
import StoryCard from '@/components/ui/StoryCard'
import TourAd from '@/components/ui/TourAd'
import OfferStrip, { pickOffers } from '@/components/ui/OfferStrip'
import CarRentalBanner from '@/components/CarRentalBanner'
import { formatLongDate, readingTime } from '@/components/ui/format'
import { fetchArticle, fetchArticles, fetchAllArticleSlugs, fetchDestinationPhoto, fetchHotels } from '@/lib/api'

export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams() {
  try { return (await fetchAllArticleSlugs()).map(({ slug }) => ({ slug })) } catch { return [] }
}

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await fetchArticle(params.slug).catch(() => null)
  if (!article) return { title: 'Článek nenalezen | Zaleto' }
  return {
    title: `${article.title} | Zaleto`,
    description: article.excerpt ?? undefined,
    alternates: { canonical: `https://zaleto.cz/clanky/${params.slug}` },
    openGraph: { title: article.title, description: article.excerpt ?? undefined, type: 'article' },
  }
}

export default async function ArticlePage({ params }: Props) {
  const article = await fetchArticle(params.slug).catch(() => null)
  if (!article) notFound()

  const [photo, byDest, cheapest, others] = await Promise.all([
    article.location && !article.custom_image_url ? fetchDestinationPhoto(article.location).catch(() => null) : Promise.resolve(null),
    article.location ? fetchHotels({ destination: article.location, limit: 24, sort: 'price_asc' }).catch(() => null) : Promise.resolve(null),
    fetchHotels({ limit: 24, sort: 'price_asc' }).catch(() => null),
    fetchArticles(5).catch(() => []),
  ])
  const hero = article.custom_image_url ?? photo
  const pool = (byDest?.hotels.length ? byDest.hotels : cheapest?.hotels ?? []).filter(h => h.thumbnail_url)
  const adHotel = pool[0] ?? null
  const more = others.filter(a => a.slug !== params.slug).slice(0, 3)

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Article', headline: article.title,
        description: article.excerpt ?? undefined, datePublished: article.published_at,
        mainEntityOfPage: `https://zaleto.cz/clanky/${params.slug}`,
      }} />
      <Header />
      <div className="z-page">
        <main>
          <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Články', href: '/clanky' }, { label: article.title }]} />
          <h1 className="h1" style={{ margin: 'var(--space-4) 0' }}>{article.title}</h1>
          <div className="z-byline">
            {article.location && <span><Icon name="poloha" />{article.location}</span>}
            <span><Icon name="cas" />{readingTime(article.reading_time)}</span>
            <span><Icon name="kalendar" />{formatLongDate(article.published_at)}</span>
          </div>
          <div style={{ marginBottom: 'var(--space-6)' }}><OfferStrip hotels={pickOffers(pool)} /></div>
          {hero && (
            <figure style={{ margin: '0 0 var(--space-6)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero} alt={article.title} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} />
              {article.custom_image_url && article.custom_image_credit === 'AI' && (
                <figcaption className="z-data" style={{ marginTop: 'var(--space-2)', textTransform: 'none' }}>Ilustrace vytvořena pomocí AI</figcaption>
              )}
              {article.custom_image_url && article.custom_image_credit && article.custom_image_credit !== 'AI' && (
                <figcaption className="z-data" style={{ marginTop: 'var(--space-2)', textTransform: 'none' }}>
                  Foto: <a href={article.custom_image_credit_url ?? 'https://unsplash.com'} target="_blank" rel="noopener noreferrer">{article.custom_image_credit}</a> / <a href="https://unsplash.com/?utm_source=zaleto&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>
                </figcaption>
              )}
            </figure>
          )}
          {article.content && <ArticleBody content={article.content} insert={<CarRentalBanner place={article.location ?? ''} country="" />} />}

          <div style={{ marginTop: 'var(--space-7)' }}>
            <Button href={article.location ? `/zajezdy?destination=${encodeURIComponent(article.location)}` : '/zajezdy'}>
              {article.location ? `Najít zájezd: ${article.location}` : 'Najít zájezd'}
            </Button>
          </div>
        </main>

        <aside className="z-page__side">{adHotel && <TourAd hotel={adHotel} sticky />}</aside>
      </div>

      {more.length > 0 && (
        <section className="z-container" style={{ marginTop: 'var(--space-8)' }}>
          <div className="z-kicker" style={{ marginBottom: 'var(--space-5)' }}>Čti dál</div>
          <div className="z-grid-3w">{more.map(a => <StoryCard key={a.slug} article={a} />)}</div>
        </section>
      )}
    </>
  )
}
