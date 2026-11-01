import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import Icon from '@/components/ui/Icon'
import ItemMap from '@/components/ItemMap'
import { PhotoCredit } from '@/components/ui/PhotoCredit'
import { GUIDE_SECTIONS } from '@/lib/guideSections'
import { slugify } from '@/lib/slugify'
import type { GuideBeach, GuidePlace } from '@/lib/guide'
import { resolveDestination } from '../../resolve'
import { loadGuide } from '../../guideData'

export const revalidate = 3600
export const dynamicParams = true

interface Props { params: { slug: string; sekce: string; polozka: string } }
const CROWD: Record<string, string> = { 'klidná': 'klidná', 'střední': 'středně rušná', 'rušná': 'rušná' }
const ITEM_SECTIONS = ['plaze', 'klastery', 'pamatky', 'priroda', 'vesnicky']

async function load(p: Props['params']) {
  const sec = GUIDE_SECTIONS.find(s => s.key === p.sekce)
  if (!sec || !ITEM_SECTIONS.includes(sec.key)) return null
  const dest = await resolveDestination(p.slug)
  if (!dest) return null
  const { guide } = await loadGuide(dest)
  if (!guide) return null
  const list = guide[sec.field] as (GuidePlace | GuideBeach)[]
  const item = Array.isArray(list) ? list.find(x => slugify(x.name) === p.polozka) : undefined
  if (!item) return null
  return { sec, dest, item, list }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load(params)
  if (!d) return { title: 'Stránka nenalezena | Zaleto' }
  const title = `${d.item.name} (${d.dest.name}) | Zaleto`
  const description = d.item.description.length > 155 ? `${d.item.description.slice(0, 152).replace(/\s+\S*$/, '')}…` : d.item.description
  const canonical = `https://zaleto.cz/destinace/${params.slug}/${params.sekce}/${params.polozka}`
  return {
    title, description, alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'article', siteName: 'Zaleto', locale: 'cs_CZ', images: d.item.image ? [d.item.image.url] : undefined },
  }
}

export default async function GuideItemPage({ params }: Props) {
  const d = await load(params)
  if (!d) notFound()
  const { sec, dest, item, list } = d
  const base = `/destinace/${params.slug}`
  const sectionUrl = `${base}/${sec.key}`
  const beach = sec.key === 'plaze' ? (item as GuideBeach) : null
  const place = !beach ? (item as GuidePlace) : null
  const kicker = beach ? beach.resort : place?.location
  const badge = beach ? beach.type : place?.kind
  const others = list.filter(x => x.name !== item.name).slice(0, 6)
  const hasGeo = beach && typeof beach.lat === 'number' && typeof beach.lng === 'number'

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': beach ? 'Beach' : 'TouristAttraction',
      name: item.name, description: item.description,
      ...(item.image ? { image: item.image.url } : {}),
      ...(hasGeo ? { geo: { '@type': 'GeoCoordinates', latitude: beach!.lat, longitude: beach!.lng } } : {}),
      containedInPlace: { '@type': 'Place', name: dest.name },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
        ...dest.breadcrumb.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.label, item: `https://zaleto.cz${c.href}` })),
        { '@type': 'ListItem', position: dest.breadcrumb.length + 2, name: sec.label, item: `https://zaleto.cz${sectionUrl}` },
        { '@type': 'ListItem', position: dest.breadcrumb.length + 3, name: item.name, item: `https://zaleto.cz${sectionUrl}/${params.polozka}` },
      ],
    },
  ]

  return (
    <>
      <JsonLd data={schema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Destinace', href: '/destinace' }, ...dest.breadcrumb, { label: sec.label, href: sectionUrl }, { label: item.name }]} />

        <div className="z-item__hero">
          <div className="z-tk z-tk--v z-item__pass" style={{ ['--stub' as string]: '210px' }}>
            <div className="z-tk__in z-item__passin">
              <div className="z-item__passmain">
                {kicker && <div className="z-kicker">{kicker} · {dest.name}</div>}
                <h1 className="h1" style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>{item.name}<span className="z-dot">.</span></h1>
                <p className="lead z-item__lead">{item.description}</p>
              </div>
              <div className="z-item__stub">
                {badge && <span className="z-stamp z-stamp--brand"><Icon name={sec.icon} size="sm" />{badge}</span>}
                <dl>
                  <div><dt>Destinace</dt><dd>{dest.name}</dd></div>
                  {kicker && <div><dt>{beach ? 'Středisko' : 'Lokalita'}</dt><dd>{kicker}</dd></div>}
                  <div><dt>Sekce</dt><dd>{sec.label}</dd></div>
                </dl>
              </div>
            </div>
          </div>
          {item.image ? (
            <figure className="z-item__photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image.url} alt={item.name} />
              <figcaption><PhotoCredit photo={item.image} /></figcaption>
            </figure>
          ) : (
            <div className="z-item__photo z-item__photo--ph" aria-hidden="true"><Icon name={sec.icon} size="lg" /></div>
          )}
        </div>

        {beach && (
          <div className="z-item__detail">
            <div className="z-tk"><div className="z-tk__in z-item__facts">
              <div className="z-kicker">Palubní údaje</div>
              <h2 className="h3">o pláži<span className="z-dot">.</span></h2>
              <dl>
                {beach.crowd && <div><dt>Rušnost</dt><dd><ul className="z-beach__chips"><li data-k="crowd">{CROWD[beach.crowd] ?? beach.crowd}</li></ul></dd></div>}
                {beach.suitable_for?.length ? <div><dt>Hodí se pro</dt><dd><ul className="z-beach__chips">{beach.suitable_for.map(x => <li key={x} data-k="for">{x}</li>)}</ul></dd></div> : null}
                {beach.facilities?.length ? <div><dt>Vybavení</dt><dd><ul className="z-beach__chips">{[...new Set(beach.facilities)].filter(x => !beach.suitable_for?.includes(x)).map(x => <li key={x}>{x}</li>)}</ul></dd></div> : null}
                {beach.type ? <div><dt>Povrch</dt><dd>{beach.type}</dd></div> : null}
              </dl>
              {beach.tip && <p className="z-beach__tip"><Icon name="info" size="sm" /><span>{beach.tip}</span></p>}
            </div></div>
            {hasGeo
              ? <ItemMap lat={beach.lat as number} lng={beach.lng as number} title={item.name} sub={beach.resort} />
              : <a className="z-more" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent([item.name, beach.resort, dest.name].filter(Boolean).join(', '))}`}><Icon name="mapa" size="sm" />Najít na mapě</a>}
          </div>
        )}

        <div className="z-item__ctas">
          <Link href={`${base}/hotely`} className="z-cta z-cta--main">
            <span className="z-cta__ic"><Icon name="hotel" size="lg" /></span>
            <span className="z-cta__txt"><b>Hotely: {dest.name}</b><small>všechny hotely s aktuálním termínem</small></span>
            <span className="z-cta__go" aria-hidden="true"><Icon name="sipka" /></span>
          </Link>
          <Link href={`${base}#zajezdy`} className="z-cta">
            <span className="z-cta__ic"><Icon name="letadlo" size="lg" /></span>
            <span className="z-cta__txt"><b>Zájezdy: {dest.name}</b><small>porovnání cen více cestovních kanceláří</small></span>
            <span className="z-cta__go" aria-hidden="true"><Icon name="sipka" /></span>
          </Link>
          <Link href={sectionUrl} className="z-cta">
            <span className="z-cta__ic"><Icon name={sec.icon} size="lg" /></span>
            <span className="z-cta__txt"><b>Všechny: {sec.label.toLowerCase()}</b><small>zpět na přehled sekce</small></span>
            <span className="z-cta__go" aria-hidden="true"><Icon name="sipka" /></span>
          </Link>
        </div>

        {others.length > 0 && (
          <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>
            <div className="z-shead" style={{ marginBottom: 'var(--space-5)' }}>
              <div>
                <div className="z-kicker">{sec.label}</div>
                <h2 style={{ fontSize: 32, lineHeight: '38px' }}>další: {sec.label.toLowerCase()}<span className="z-dot">.</span></h2>
              </div>
              <Link className="z-more" href={sectionUrl}>Všechny</Link>
            </div>
            <ul className="z-itemlinks">
              {others.map(o => (
                <li key={o.name}><Link href={`${sectionUrl}/${slugify(o.name)}`}><Icon name={sec.icon} size="sm" />{o.name}</Link></li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  )
}
