import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import Icon from '@/components/ui/Icon'
import LoadMoreHotels from '@/components/LoadMoreHotels'
import HotelsAreaMap from '@/components/HotelsAreaMap'
import OfferStrip, { pickOffers } from '@/components/ui/OfferStrip'
import NavTabs, { type NavTabItem } from '@/components/ui/NavTabs'
import PlaceLinks from '@/components/PlaceLinks'
import { fetchHotels } from '@/lib/api'
import { resolveDestination } from '../resolve'

export const revalidate = 3600
export const dynamicParams = true

const LIMIT = 48
const SORTS: [string, string][] = [['price_asc', 'Nejlevnější'], ['date_asc', 'Nejbližší'], ['stars_desc', 'Nejlepší hotely']]

interface Props { params: { slug: string }; searchParams: { sort?: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dest = await resolveDestination(params.slug)
  if (!dest) return { title: 'Destinace nenalezena' }
  const title = `Hotely ${dest.name} — všechny hotely s termínem`
  const description = `Všechny hotely v destinaci ${dest.name}, ke kterým máme aktuální zájezdy od českých cestovních kanceláří.`
  const canonical = `https://zaleto.cz/destinace/${params.slug}/hotely`
  return {
    title, description, alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
  }
}

export default async function DestinaceHotelyPage({ params, searchParams }: Props) {
  const dest = await resolveDestination(params.slug)
  if (!dest) notFound()
  const sort = SORTS.some(([v]) => v === searchParams.sort) ? (searchParams.sort as string) : 'price_asc'

  const result = await fetchHotels({ destination: dest.name, sort, page: 1, limit: LIMIT }).catch(() => null)
  const hotels = result?.hotels ?? []
  const total = result?.pagination?.total ?? hotels.length
  const base = `/destinace/${params.slug}`

  const tabs: NavTabItem[] = [
    { href: base, label: `O destinaci`, icon: 'kompas' },
    { href: `${base}#zajezdy`, label: 'Zájezdy', icon: 'letadlo' },
  ]

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...dest.breadcrumb.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.label, item: `https://zaleto.cz${c.href}` })),
      { '@type': 'ListItem', position: dest.breadcrumb.length + 2, name: 'Hotely', item: `https://zaleto.cz${base}/hotely` },
    ],
  }

  return (
    <>
      <JsonLd data={schema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Destinace', href: '/destinace' }, ...dest.breadcrumb, { label: 'Hotely', href: `${base}/hotely` }]} />

        <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>
          Destinace{dest.country && dest.country !== dest.name ? ` · ${dest.country}` : ''}
        </div>
        <h1 className="h1" style={{ margin: 'var(--space-3) 0 0' }}>hotely: {dest.name}<span className="z-dot">.</span></h1>

        <NavTabs items={tabs} />
        <div className="z-stripwrap"><OfferStrip hotels={pickOffers(hotels)} /></div>

        <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>
          <div className="z-hotelspage__bar">
            <div className="z-meta"><span><Icon name="hotel" />{total} hotelů</span></div>
            <nav aria-label="Řazení" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {SORTS.map(([v, l]) => (
                <Link
                  key={v}
                  href={`${base}/hotely${v === 'price_asc' ? '' : `?sort=${v}`}`}
                  scroll={false}
                  className="z-chip"
                  aria-current={sort === v ? 'true' : undefined}
                  style={{ textDecoration: 'none', ...(sort === v ? { background: 'var(--ink)', color: 'var(--paper)' } : {}) }}
                >{l}</Link>
              ))}
            </nav>
          </div>
          {hotels.length > 0 && <div style={{ marginBottom: 'var(--space-6)' }}><HotelsAreaMap destination={dest.name} /></div>}
          {hotels.length > 0 && (
            <LoadMoreHotels key={sort} initial={hotels} total={total} limit={LIMIT} query={{ destination: dest.name, sort }} variant="tile" />
          )}
        </section>
        <PlaceLinks slug={params.slug} skip={['hotels']} />
      </main>
    </>
  )
}
