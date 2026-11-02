import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
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
import { fetchArticle, fetchArticles, fetchAllArticleSlugs, fetchDestinationPhoto, fetchHotels, fetchDestinations, fetchLandingList, fetchLinkTargets } from '@/lib/api'
import { LinkList } from '@/components/ui/SeoBlocks'
import { GENERIC_PLACE, weatherAutoLinks } from '@/lib/autolink'
import { slugify } from '@/lib/slugify'

export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams() {
  try { return (await fetchAllArticleSlugs()).map(({ slug }) => ({ slug })) } catch { return [] }
}

interface Props { params: { slug: string } }

const GENERIC = GENERIC_PLACE

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await fetchArticle(params.slug).catch(() => null)
  if (!article) return { title: 'Článek nenalezen' }
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
    alternates: { canonical: `https://zaleto.cz/clanky/${params.slug}` },
    openGraph: { title: article.title, description: article.excerpt ?? undefined, type: 'article' },
  }
}

export default async function ArticlePage({ params }: Props) {
  const article = await fetchArticle(params.slug).catch(() => null)
  if (!article) notFound()

  const [photo, byDest, cheapest, others, destinations, landings] = await Promise.all([
    article.location && !article.custom_image_url ? fetchDestinationPhoto(article.location).catch(() => null) : Promise.resolve(null),
    article.location ? fetchHotels({ destination: article.location, limit: 24, sort: 'price_asc' }).catch(() => null) : Promise.resolve(null),
    fetchHotels({ limit: 24, sort: 'price_asc' }).catch(() => null),
    fetchArticles(5).catch(() => []),
    fetchDestinations().catch(() => []),
    fetchLandingList(),
  ])
  const hero = article.custom_image_url ?? photo
  const pool = (byDest?.hotels.length ? byDest.hotels : cheapest?.hotels ?? []).filter(h => h.thumbnail_url)
  const adHotel = pool[0] ?? null
  const more = others.filter(a => a.slug !== params.slug).slice(0, 3)

  // Vnitřní prolinkování: první zmínka země / oblasti v textu vede na její průvodce (místo článku jde první)
  const names = new Map<string, string>()
  for (const d of destinations) {
    const region = d.destination?.split('/')[1]?.trim()
    // obecná slova (Ostrov, Pobřeží …) se jako názvy oblastí v textu nelinkují: shoda by byla náhodná
    for (const n of [d.country, region]) if (n && !GENERIC.test(n) && !names.has(n)) names.set(n, `/destinace/${slugify(n)}`)
  }
  // odkazy v textu: země, oblasti i střediska (první výskyt každého názvu); lokalita článku má přednost při omezení počtu odkazů
  // stránka počasí lokality článku (země nebo oblast): na ni vedou slova jako „počasí“ nebo „teploty moře“
  const loc = article.location
  const countryRow = loc ? destinations.find(d => d.country === loc) : undefined
  const regionRow = loc && !countryRow ? destinations.find(d => d.destination?.split('/')[1]?.trim() === loc) : undefined
  const weatherHref = loc && countryRow ? `/pocasi/${slugify(loc)}`
    : loc && regionRow?.country ? `/pocasi/${slugify(regionRow.country)}/${slugify(loc)}` : null
  const autoLinks = [
    ...(await fetchLinkTargets()).sort((a, b) => Number(b.name === article.location) - Number(a.name === article.location)),
    ...weatherAutoLinks(weatherHref),
  ]

  // odkazy pod článkem: průvodce a přehledy zájezdů pro lokalitu článku
  const locSlug = article.location ? slugify(article.location) : ''
  const guideLinks = article.location && names.has(article.location)
    ? [{ href: names.get(article.location)!, label: `Průvodce: ${article.location}`, hint: 'kdy jet, pro koho, kolik stojí' }] : []
  const overviewLinks = locSlug
    ? landings.filter(l => l.country && slugify(l.country) === locSlug)
        .sort((a, b) => b.hotel_count - a.hotel_count).slice(0, 6)
        .map(l => ({ href: `/zajezdy/${l.slug}`, label: l.title, hint: `${l.hotel_count} hotelů` }))
    : []

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Article', headline: article.title,
        description: article.excerpt ?? undefined, datePublished: article.published_at, dateModified: article.published_at,
        ...(hero?.startsWith('http') ? { image: hero } : {}),
        author: { '@type': 'Organization', name: 'Redakce Zaleto', url: 'https://zaleto.cz/o-zaleto' },
        publisher: { '@type': 'Organization', name: 'Zaleto', url: 'https://zaleto.cz', logo: { '@type': 'ImageObject', url: 'https://zaleto.cz/img/logo/logo.png' } },
        inLanguage: 'cs-CZ',
        mainEntityOfPage: `https://zaleto.cz/clanky/${params.slug}`,
      }} />
      <Header />
      <div className="z-page">
        <main>
          <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Články', href: '/clanky' }, { label: article.title }]} />
          <h1 className="h1" style={{ margin: 'var(--space-4) 0' }}>{article.title}</h1>
          <div className="z-byline">
            {article.location && <span><Icon name="poloha" />{article.location}</span>}
            <span><Icon name="agentura" /><Link href="/o-zaleto">Redakce Zaleto</Link></span>
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
          {article.content && <ArticleBody content={article.content} links={autoLinks} insert={<CarRentalBanner place={article.location ?? ''} country="" />} />}

          <LinkList title="Související průvodci" links={guideLinks} />
          <LinkList title={`Přehledy zájezdů${article.location ? `: ${article.location}` : ''}`} links={overviewLinks} />

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
