import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import Icon from '@/components/ui/Icon'
import TourCard from '@/components/ui/TourCard'
import TourAd from '@/components/ui/TourAd'
import StoryCard from '@/components/ui/StoryCard'
import { fetchDestinations, fetchWikiSummary, fetchDestinationPhoto, fetchDestinationAI, fetchHotels, fetchArticles } from '@/lib/api'
import { slugify } from '@/lib/slugify'

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  try {
    const destinations = await fetchDestinations()
    const seen = new Set<string>()
    const params: { slug: string }[] = []
    const add = (name: string | null | undefined) => {
      if (!name) return
      const s = slugify(name)
      if (s && !seen.has(s)) { seen.add(s); params.push({ slug: s }) }
    }
    for (const d of destinations) {
      add(d.country)
      add(d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim())
      add(d.resort_town)
    }
    return params
  } catch {
    return []
  }
}

interface DestInfo {
  name: string
  country: string | null
  type: 'country' | 'region' | 'town'
  breadcrumb: { label: string; href: string }[]
}

async function resolveDestination(slug: string): Promise<DestInfo | null> {
  let destinations
  try { destinations = await fetchDestinations() } catch { return null }

  for (const d of destinations) {
    if (d.country && slugify(d.country) === slug) {
      return { name: d.country, country: d.country, type: 'country', breadcrumb: [{ label: d.country, href: `/destinace/${slugify(d.country)}` }] }
    }
  }
  for (const d of destinations) {
    const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
    if (region && slugify(region) === slug) {
      const crumbs: { label: string; href: string }[] = []
      if (d.country) crumbs.push({ label: d.country, href: `/destinace/${slugify(d.country)}` })
      crumbs.push({ label: region, href: `/destinace/${slugify(region)}` })
      return { name: region, country: d.country, type: 'region', breadcrumb: crumbs }
    }
  }
  for (const d of destinations) {
    if (d.resort_town && slugify(d.resort_town) === slug) {
      const region = d.destination?.split('/')[1]?.trim() ?? d.destination?.split('/')[0]?.trim()
      const crumbs: { label: string; href: string }[] = []
      if (d.country) crumbs.push({ label: d.country, href: `/destinace/${slugify(d.country)}` })
      if (region && region !== d.resort_town) crumbs.push({ label: region, href: `/destinace/${slugify(region)}` })
      crumbs.push({ label: d.resort_town, href: `/destinace/${slugify(d.resort_town)}` })
      return { name: d.resort_town, country: d.country, type: 'town', breadcrumb: crumbs }
    }
  }
  return null
}

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dest = await resolveDestination(params.slug)
  if (!dest) return { title: 'Destinace nenalezena | Zaleto' }

  const year = new Date().getFullYear()
  const wiki = await fetchWikiSummary(dest.name).catch(() => null)
  const name = wiki?.title ?? dest.name
  const description = wiki
    ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    : `Porovnej zájezdy do destinace ${name} od českých cestovních kanceláří.`
  const canonical = `https://zaleto.cz/destinace/${params.slug}`
  const title = `Zájezdy ${name} ${year} — srovnání cen CK | Zaleto`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: `Zájezdy ${name} ${year} | Zaleto`, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const LIMIT = 24
const SORTS: [string, string][] = [['price_asc', 'Nejlevnější'], ['date_asc', 'Nejbližší'], ['stars_desc', 'Nejlepší hotely']]

type Item = { name: string; description: string }

function ItemList({ title, items }: { title: string; items: Item[] }) {
  if (!items?.length) return null
  return (
    <>
      <h2>{title}<span className="z-dot">.</span></h2>
      <ul>
        {items.map(i => <li key={i.name}><strong>{i.name}</strong> — {i.description}</li>)}
      </ul>
    </>
  )
}

export default async function DestinacePage({ params, searchParams }: Props & { searchParams: { page?: string; sort?: string } }) {
  const dest = await resolveDestination(params.slug)
  if (!dest) notFound()

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const sort = SORTS.some(([v]) => v === searchParams.sort) ? (searchParams.sort as string) : 'price_asc'

  const [destAI, heroPhoto, result, articles] = await Promise.all([
    fetchDestinationAI(dest.name).catch(() => null),
    fetchDestinationPhoto(dest.name).catch(() => null),
    fetchHotels({ destination: dest.name, sort, page, limit: LIMIT }).catch(() => null),
    fetchArticles(3, dest.name).catch(() => []),
  ])

  const aiText = destAI?.description && destAI.description.length >= 20 ? destAI.description : null
  const wiki = aiText ? null : await fetchWikiSummary(dest.name).catch(() => null)
  const paragraphs = aiText
    ? aiText.split(/\n\n+/)
    : wiki ? [wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ')] : []
  const title = wiki?.title ?? dest.name

  const hotels = result?.hotels ?? []
  const pg = result?.pagination
  const adHotel = hotels.find(h => h.thumbnail_url) ?? null

  const weatherUrl = dest.type === 'country'
    ? `/pocasi/${slugify(dest.name)}`
    : dest.country ? `/pocasi/${slugify(dest.country)}/${slugify(dest.name)}` : null

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...dest.breadcrumb.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.label, item: `https://zaleto.cz${c.href}` })),
    ],
  }

  const pageHref = (n: number) => {
    const p = new URLSearchParams()
    if (sort !== 'price_asc') p.set('sort', sort)
    p.set('page', String(n))
    return `/destinace/${params.slug}?${p}`
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <Header />

      <div className="z-page">
        <main>
          <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Destinace', href: '/destinace' }, ...dest.breadcrumb]} />
          <h1 className="h1" style={{ margin: 'var(--space-4) 0' }}>{title}<span className="z-dot">.</span></h1>
          <div className="z-byline">
            {pg && <span><Icon name="hotel" />{pg.total} hotelů s termínem</span>}
            {weatherUrl && <span><Icon name="slunce" /><Link href={weatherUrl} style={{ color: 'inherit' }}>Počasí a klima</Link></span>}
          </div>
          {heroPhoto && (
            <figure style={{ margin: '0 0 var(--space-6)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPhoto} alt={dest.name} style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} />
            </figure>
          )}

          <div className="z-prose">
            {paragraphs.map((p, i) => <p key={i} className={i === 0 ? 'z-lead' : undefined}>{p}</p>)}
            {destAI?.best_time && (
              <>
                <h2>kdy jet<span className="z-dot">.</span></h2>
                {destAI.best_time.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
              </>
            )}
            <ItemList title="co vidět" items={destAI?.places ?? []} />
            <ItemList title="co ochutnat" items={destAI?.food ?? []} />
            <ItemList title="výlety z místa" items={[...(destAI?.trips ?? []), ...(destAI?.excursions ?? [])]} />
          </div>
        </main>
        <aside>{adHotel && <TourAd hotel={adHotel} sticky kicker={`Nabídka — ${dest.name}`} />}</aside>
      </div>

      <section className="z-container z-section">
        <div className="z-shead">
          <div>
            <div className="z-kicker">Zájezdy</div>
            <h2>lístky do {dest.name}<span className="z-dot">.</span></h2>
          </div>
          <nav aria-label="Řazení" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {SORTS.map(([v, l]) => (
              <Link
                key={v}
                href={`/destinace/${params.slug}${v === 'price_asc' ? '' : `?sort=${v}`}`}
                className="z-chip"
                aria-current={sort === v ? 'true' : undefined}
                style={{ textDecoration: 'none', ...(sort === v ? { background: 'var(--ink)', color: 'var(--paper)' } : {}) }}
              >{l}</Link>
            ))}
          </nav>
        </div>
        {hotels.length === 0 ? (
          <p className="body">Pro tuto destinaci teď nemáme žádný volný termín.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-5)', alignItems: 'stretch' }}>
            {hotels.map((h, i) => <TourCard key={h.slug} hotel={h} priority={i < 3} />)}
          </div>
        )}
        {pg && pg.totalPages > 1 && (
          <nav aria-label="Stránkování" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-7)' }}>
            {page > 1 ? <Link className="z-more" href={pageHref(page - 1)}>Předchozí</Link> : <span />}
            <span className="z-data">STRANA {page} / {pg.totalPages}</span>
            {pg.hasMore ? <Link className="z-more" href={pageHref(page + 1)}>Další</Link> : <span />}
          </nav>
        )}
      </section>

      {articles.length > 0 && (
        <section className="z-container z-section">
          <div className="z-kicker" style={{ marginBottom: 'var(--space-5)' }}>Z cest: {dest.name}</div>
          <div className="z-grid-3w">{articles.map(a => <StoryCard key={a.slug} article={a} />)}</div>
        </section>
      )}
    </>
  )
}
