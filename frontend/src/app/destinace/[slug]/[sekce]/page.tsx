import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import NavTabs, { type NavTabItem } from '@/components/ui/NavTabs'
import BeachExplorer from '@/components/BeachExplorer'
import { ResortCards, TransportCards } from '@/components/ui/GuideSections'
import PlaceCards from '@/components/ui/PlaceCards'
import { GUIDE_SECTIONS, sectionCount } from '@/lib/guideSections'
import { resolveDestination } from '../resolve'
import { loadGuide, loadResortPhotos } from '../guideData'

export const revalidate = 3600
export const dynamicParams = true

interface Props { params: { slug: string; sekce: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sec = GUIDE_SECTIONS.find(s => s.key === params.sekce)
  const dest = await resolveDestination(params.slug)
  if (!sec || !dest) return { title: 'Stránka nenalezena' }
  const title = `${sec.label}: ${dest.name}`
  const description = `${sec.heading.charAt(0).toUpperCase()}${sec.heading.slice(1)} v destinaci ${dest.name}: popisy, fotky a poloha na mapě.`
  const canonical = `https://zaleto.cz/destinace/${params.slug}/${sec.key}`
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' } }
}

export default async function GuideSectionPage({ params }: Props) {
  const sec = GUIDE_SECTIONS.find(s => s.key === params.sekce)
  if (!sec) notFound()
  const dest = await resolveDestination(params.slug)
  if (!dest) notFound()
  const { guide, resortLinks } = await loadGuide(dest)
  if (!guide || sectionCount(guide, sec.field) === 0) notFound()

  const base = `/destinace/${params.slug}`
  const tabs: NavTabItem[] = [
    { href: base, label: 'O destinaci', icon: 'kompas' },
    ...GUIDE_SECTIONS.filter(s => sectionCount(guide, s.field) > 0).map(s => ({ href: `${base}/${s.key}`, label: s.label, icon: s.icon })),
    { href: `${base}/hotely`, label: 'Hotely', icon: 'hotel' as const },
  ]

  let body: React.ReactNode = null
  if (sec.key === 'strediska') body = <ResortCards items={guide.resorts} links={resortLinks} photos={await loadResortPhotos(guide)} />
  else if (sec.key === 'plaze') body = <BeachExplorer beaches={guide.beaches} resortLinks={resortLinks} regionName={dest.name} base={`${base}/plaze`} />
  else if (sec.key === 'klastery') body = <PlaceCards items={guide.monasteries} icon="mesto" base={`${base}/klastery`} />
  else if (sec.key === 'pamatky') body = <PlaceCards items={guide.sights} icon="kompas" base={`${base}/pamatky`} />
  else if (sec.key === 'priroda') body = <PlaceCards items={guide.nature} icon="hory" base={`${base}/priroda`} />
  else if (sec.key === 'vesnicky') body = <PlaceCards items={guide.villages} icon="srdce" base={`${base}/vesnicky`} />
  else if (sec.key === 'doprava') body = <TransportCards transport={guide.transport} />

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...dest.breadcrumb.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.label, item: `https://zaleto.cz${c.href}` })),
      { '@type': 'ListItem', position: dest.breadcrumb.length + 2, name: sec.label, item: `https://zaleto.cz${base}/${sec.key}` },
    ],
  }

  return (
    <>
      <JsonLd data={schema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Destinace', href: '/destinace' }, ...dest.breadcrumb, { label: sec.label, href: `${base}/${sec.key}` }]} />
        <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>
          Destinace{dest.country && dest.country !== dest.name ? ` · ${dest.country}` : ''}
        </div>
        <h1 className="h1" style={{ margin: 'var(--space-3) 0 0' }}>{sec.heading}: {dest.name}<span className="z-dot">.</span></h1>
        <NavTabs items={tabs} />
        <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>{body}</section>
        <p style={{ margin: 'var(--space-8) 0', display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
          <Link href={base} className="z-more">Zpět na {dest.name}</Link>
          <Link href={`${base}/hotely`} className="z-more">Hotely: {dest.name}</Link>
          <Link href={`${base}#zajezdy`} className="z-more">Zájezdy: {dest.name}</Link>
        </p>
      </main>
    </>
  )
}
