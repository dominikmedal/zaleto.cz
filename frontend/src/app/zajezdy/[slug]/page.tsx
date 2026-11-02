import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Icon from '@/components/ui/Icon'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import InfiniteHotels from '@/components/InfiniteHotels'
import { Paragraphs, FaqList, AiNote, LinkList, faqSchema } from '@/components/ui/SeoBlocks'
import { fetchHotels, fetchLanding, fetchLandingList } from '@/lib/api'
import { formatPrice } from '@/components/ui/format'
import { slugify } from '@/lib/slugify'
import { landingFilters, landingSearchHref, type LandingAI } from '@/lib/seoContent'

export const revalidate = 3600
export const dynamicParams = true

const LIMIT = 24
const SITE = 'https://zaleto.cz'

interface Props { params: { slug: string } }

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s)

/** Nejlevnější nabídka pro titulek: stejný dotaz jako v těle stránky, takže se jen sdílí cache. */
async function load(l: LandingAI) {
  return fetchHotels({ ...landingFilters(l), sort: 'price_asc', page: 1, limit: LIMIT }).catch(() => null)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await fetchLanding(params.slug)
  if (!l) return { title: 'Stránka nenalezena' }
  const first = await load(l)
  const from = first?.hotels[0]?.min_price ? ` od ${formatPrice(first.hotels[0].min_price)}` : ''
  const total = first?.pagination.total ?? 0
  const title = `${l.title}${from} — srovnání cen CK`
  const description = clip(l.intro.split(/\n\s*\n/)[0], 158)
  const canonical = `${SITE}/zajezdy/${l.slug}`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ', images: [{ url: '/img/og-image.png', width: 1200, height: 630, alt: 'Zaleto — Vyhledávač zájezdů' }] },
    twitter: { card: 'summary_large_image', title, description },
    // bez nabídky (měsíc už uplynul, termíny došly) by stránka byla prázdná: nechceme ji v indexu
    robots: total >= 3 ? undefined : { index: false, follow: true },
  }
}

export default async function LandingPage({ params }: Props) {
  const l = await fetchLanding(params.slug)
  if (!l) notFound()

  const [result, all] = await Promise.all([load(l), fetchLandingList()])
  const hotels = result?.hotels ?? []
  const pg = result?.pagination
  const from = hotels[0]?.min_price

  const sameCountry = l.country ? all.filter(x => x.country === l.country && x.slug !== l.slug) : []
  const sameType = all.filter(x => x.type === l.type && x.country && x.country !== l.country && x.value === l.value).slice(0, 8)
  const order = { meal: 0, stars: 1, month: 2 } as const
  const related = [
    ...sameCountry.sort((a, b) => order[a.type] - order[b.type] || b.hotel_count - a.hotel_count).slice(0, 8)
      .map(x => ({ href: `/zajezdy/${x.slug}`, label: x.title, hint: `${x.hotel_count} hotelů` })),
  ]
  // přehledy bez země (všechny destinace): jinak by na ně nevedl žádný odkaz kromě sitemapy
  const globalTypeOrder = { meal: 0, stars: 1, month: 2 } as const
  const globals = all.filter(x => !x.country && x.slug !== l.slug)
    .sort((a, b) => globalTypeOrder[a.type] - globalTypeOrder[b.type] || Number(a.value) - Number(b.value))
    .map(x => ({ href: `/zajezdy/${x.slug}`, label: x.title, hint: `${x.hotel_count} hotelů` }))
  const alsoElsewhere =sameType.map(x => ({ href: `/zajezdy/${x.slug}`, label: x.title, hint: `${x.hotel_count} hotelů` }))
  const guide = l.country ? [
    { href: `/destinace/${slugify(l.country)}`, label: `Průvodce: ${l.country}`, hint: 'kdy jet, pro koho, kolik stojí' },
    { href: `/pocasi/${slugify(l.country)}`, label: `Počasí: ${l.country}`, hint: 'klima po měsících' },
  ] : []

  const crumbs = [
    { label: 'Zaleto', href: '/' },
    { label: 'Zájezdy', href: '/zajezdy' },
    ...(l.country ? [{ label: l.country, href: `/destinace/${slugify(l.country)}` }] : []),
    { label: l.title },
  ]
  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, item: c.href ? `${SITE}${c.href}` : `${SITE}/zajezdy/${l.slug}` })),
  }
  const listSchema = hotels.length ? {
    '@context': 'https://schema.org', '@type': 'ItemList', name: l.title,
    itemListElement: hotels.slice(0, 12).map((h, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/hotel/${h.slug}`, name: h.name })),
  } : null
  const faqLd = faqSchema(l.faq)

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {listSchema && <JsonLd data={listSchema} />}
      {faqLd && <JsonLd data={faqLd} />}
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={crumbs} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead
          as="h1"
          keepKicker
          kicker={pg ? `${pg.total.toLocaleString('cs-CZ')} hotelů s volným termínem${from ? ` · od ${formatPrice(from)}` : ''}` : 'Zájezdy'}
          title={l.title.toLowerCase()}
        />

        <div className="z-prose" style={{ maxWidth: 'var(--article-max)', marginBottom: 'var(--space-7)' }}>
          <Paragraphs text={l.intro} lead />
          <p><Link className="z-more" href={landingSearchHref(l)}>Upravit filtry a termín<span className="z-btn__go"><Icon name="sipka" /></span></Link></p>
        </div>

        {hotels.length === 0 ? (
          <div className="z-info"><h2 className="z-info__title">teď tu nic není<span className="z-dot">.</span></h2>
            <p style={{ margin: 'var(--space-3) 0 0' }}>Pro tuto nabídku teď nemáme volný termín. <Link href="/zajezdy" className="z-more">Zkusit jiné zájezdy</Link></p></div>
        ) : (
          <InfiniteHotels
            initial={hotels}
            total={pg?.total ?? hotels.length}
            limit={LIMIT}
            query={{ ...Object.fromEntries(Object.entries(landingFilters(l)).map(([k, v]) => [k, String(v)])), sort: 'price_asc' }}
          />
        )}

        {l.sections.length > 0 && (
          <div className="z-prose" style={{ maxWidth: 'var(--article-max)', marginTop: 'var(--space-8)' }}>
            {l.sections.map(s => (
              <section key={s.heading}>
                <h2>{s.heading}</h2>
                <p>{s.text}</p>
              </section>
            ))}
          </div>
        )}

        {l.faq.length > 0 && (
          <section id="faq" style={{ marginTop: 'var(--space-8)' }}>
            <SectionHead kicker="Časté otázky" title="dotazy k nabídce" />
            <FaqList items={l.faq} />
          </section>
        )}

        <AiNote at={l.generated_at} />

        <LinkList title="Průvodce a počasí" links={guide} />
        <LinkList title={l.country ? `Další přehledy: ${l.country}` : 'Další přehledy'} links={related} />
        <LinkList title="Stejná nabídka jinde" links={alsoElsewhere} />
        <LinkList title="Zájezdy podle stravy, hvězdiček a měsíce" links={globals} />
        <div style={{ height: 'var(--space-8)' }} />
      </main>
    </>
  )
}
