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
import NavTabs, { type NavTabItem } from '@/components/ui/NavTabs'
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

function Block({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="z-cardest__block">
      <div className="z-shead" style={{ marginBottom: 'var(--space-5)' }}>
        <div>
          <div className="z-kicker">{kicker}</div>
          <h2 style={{ fontSize: 32, lineHeight: '38px' }}>{title}<span className="z-dot">.</span></h2>
        </div>
      </div>
      {children}
    </section>
  )
}

/** Položky jako číslované karty (název + popis). */
function ItemCards({ items }: { items: Item[] }) {
  return (
    <div className="z-grid-2">
      {items.map((it, i) => (
        <article key={it.name} className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', height: '100%' }}>
          <div className="z-kicker" style={{ color: 'var(--brand-strong)' }}>{String(i + 1).padStart(2, '0')}</div>
          <h3 className="h4" style={{ margin: 'var(--space-2) 0' }}>{it.name}</h3>
          <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{it.description}</p>
        </div></article>
      ))}
    </div>
  )
}

export default async function DestinacePage({ params, searchParams }: Props & { searchParams: { page?: string; sort?: string } }) {
  const dest = await resolveDestination(params.slug)
  if (!dest) notFound()

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const sort = SORTS.some(([v]) => v === searchParams.sort) ? (searchParams.sort as string) : 'price_asc'

  const [destAI, heroPhoto, result, articles] = await Promise.all([
    fetchDestinationAI(dest.name).catch(() => null),
    fetchDestinationPhoto(dest.name).then(u => u ?? (dest.country && dest.country !== dest.name ? fetchDestinationPhoto(dest.country) : null)).catch(() => null),
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

  const places = destAI?.places ?? []
  const food = destAI?.food ?? []
  const trips = [...(destAI?.trips ?? []), ...(destAI?.excursions ?? [])]
  const bestTime = destAI?.best_time ?? null

  const weatherUrl = dest.type === 'country'
    ? `/pocasi/${slugify(dest.name)}`
    : dest.country ? `/pocasi/${slugify(dest.country)}/${slugify(dest.name)}` : null

  const tabs: NavTabItem[] = [
    ...(paragraphs.length > 1 ? [{ href: '#o-destinaci', label: 'O destinaci', icon: 'kompas' as const }] : []),
    ...(bestTime ? [{ href: '#kdy-jet', label: 'Kdy jet', icon: 'kalendar' as const }] : []),
    ...(places.length ? [{ href: '#co-videt', label: 'Co vidět', icon: 'poloha' as const }] : []),
    ...(food.length ? [{ href: '#jidlo', label: 'Jídlo', icon: 'jidlo' as const }] : []),
    ...(trips.length ? [{ href: '#vylety', label: 'Výlety', icon: 'trasa' as const }] : []),
    { href: '#zajezdy', label: 'Zájezdy', icon: 'letadlo' as const },
    ...(articles.length ? [{ href: '#clanky', label: 'Články', icon: 'clanek' as const }] : []),
    ...(weatherUrl ? [{ href: weatherUrl, label: 'Počasí', icon: 'slunce' as const }] : []),
    { href: '/pujcovna-aut', label: 'Půjčovna aut', icon: 'auto' as const },
  ]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...dest.breadcrumb.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.label, item: `https://zaleto.cz${c.href}` })),
    ],
  }

  const pageHref = (n: number) => {
    const q = new URLSearchParams()
    if (sort !== 'price_asc') q.set('sort', sort)
    q.set('page', String(n))
    return `/destinace/${params.slug}?${q}`
  }

  const hasLong = !!(paragraphs.length > 1 || bestTime || places.length || food.length || trips.length)

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <Header />

      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Destinace', href: '/destinace' }, ...dest.breadcrumb]} />

        <div className="z-cardest">
          <div>
            <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>
              Destinace{dest.country && dest.country !== dest.name ? ` · ${dest.country}` : ''}
            </div>
            <h1 className="h1" style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>{title}<span className="z-dot">.</span></h1>
            {paragraphs[0] && <p className="lead" style={{ margin: 0 }}>{paragraphs[0]}</p>}
            <div className="z-meta" style={{ marginTop: 'var(--space-5)', fontSize: 15 }}>
              {pg ? <span><Icon name="hotel" />{pg.total} hotelů s termínem</span> : null}
              {weatherUrl ? <span><Icon name="slunce" /><Link href={weatherUrl} style={{ color: 'inherit' }}>Počasí a klima</Link></span> : null}
            </div>
          </div>
          {heroPhoto && (
            <div className="z-cardest__photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPhoto} alt={dest.name} />
            </div>
          )}
        </div>

        <NavTabs items={tabs} />

        {hasLong && (
          <div className="z-cardest__grid">
            <div className="z-cardest__main">
              {paragraphs.length > 1 && (
                <Block id="o-destinaci" kicker="O destinaci" title={`o místě: ${dest.name}`}>
                  <div className="z-prose">{paragraphs.slice(1).map((p, i) => <p key={i}>{p}</p>)}</div>
                </Block>
              )}
              {bestTime && (
                <Block id="kdy-jet" kicker="Kdy jet" title="nejlepší doba na cestu">
                  <div className="z-prose">{bestTime.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
                  {weatherUrl && <p style={{ marginTop: 'var(--space-4)' }}><Link className="z-more" href={weatherUrl}>Počasí po měsících</Link></p>}
                </Block>
              )}
              {places.length > 0 && <Block id="co-videt" kicker="Co vidět" title="místa, která stojí za to"><ItemCards items={places} /></Block>}
              {food.length > 0 && <Block id="jidlo" kicker="Jídlo" title="co ochutnat"><ItemCards items={food} /></Block>}
              {trips.length > 0 && <Block id="vylety" kicker="Výlety" title="výlety z místa"><ItemCards items={trips} /></Block>}
            </div>

            <aside className="z-cardest__side">
              {adHotel && <TourAd hotel={adHotel} sticky kicker={`Nabídka — ${dest.name}`} />}
            </aside>
          </div>
        )}

        <section id="zajezdy" className="z-section" style={{ scrollMarginTop: 'calc(var(--header-height) + 16px)' }}>
          <div className="z-shead">
            <div>
              <div className="z-kicker">Zájezdy</div>
              <h2>zájezdy: {dest.name}<span className="z-dot">.</span></h2>
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
          <section id="clanky" className="z-section" style={{ scrollMarginTop: 'calc(var(--header-height) + 16px)' }}>
            <div className="z-shead">
              <div>
                <div className="z-kicker">Z cest</div>
                <h2>čerstvě z cest: {dest.name}<span className="z-dot">.</span></h2>
              </div>
              <Link className="z-more" href="/clanky">Všechny články</Link>
            </div>
            <div className="z-grid-3w">{articles.map(a => <StoryCard key={a.slug} article={a} />)}</div>
          </section>
        )}
      </main>
    </>
  )
}
