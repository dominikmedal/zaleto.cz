import Photo from '@/components/ui/Photo'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import Icon from '@/components/ui/Icon'
import LoadMoreHotels from '@/components/LoadMoreHotels'
import TourAd from '@/components/ui/TourAd'
import StoryCard from '@/components/ui/StoryCard'
import { articleImageMap } from '@/lib/articleImages'
import NavTabs, { type NavTabItem } from '@/components/ui/NavTabs'
import { PlaceTickets, FoodMenu, TripRoute } from '@/components/ui/ItemCard'
import { fetchDestinations, fetchWikiSummary, fetchDestinationPhoto, fetchDestinationPhotoCredit, fetchDestinationAI, fetchHotels, fetchArticles } from '@/lib/api'
import { slugify } from '@/lib/slugify'
import { resolveDestination } from './resolve'
import OfferStrip, { pickOffers } from '@/components/ui/OfferStrip'
import { destinationGallery } from '@/server/content'
import { loadGuide } from './guideData'
import { GUIDE_SECTIONS, sectionCount } from '@/lib/guideSections'
import { approvedTravelogues } from '@/server/travelogues'
import TravelogueCard from '@/components/ui/TravelogueCard'
import HotelsAreaMap from '@/components/HotelsAreaMap'
import PhotoGallery from '@/components/PhotoGallery'
import { FactsStrip, GuideHub } from '@/components/ui/GuideSections'
import { mergeDestinations } from '@/lib/carRental'
import { fetchDynamicCarDestinations } from '@/lib/api'
import { formatPrice } from '@/components/ui/format'
import { seasonYear } from '@/lib/seo'
import { fetchDestinationSeo, fetchLandingList, fetchLinkTargets } from '@/lib/api'
import { Linked, weatherAutoLinks } from '@/lib/autolink'
import Teaser from '@/components/ui/Teaser'
import { MONTHS } from '@/lib/seoContent'
import { Paragraphs, AudienceList, MonthsGrid, LinkList, AiNote } from '@/components/ui/SeoBlocks'

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

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dest = await resolveDestination(params.slug)
  if (!dest) return { title: 'Destinace nenalezena' }

  const year = seasonYear()
  // stejný dotaz jako v těle stránky (výchozí řazení), takže se jen sdílí cache
  const [wiki, first] = await Promise.all([
    fetchWikiSummary(dest.name).catch(() => null),
    fetchHotels({ destination: dest.name, sort: 'price_asc', page: 1, limit: LIMIT }).catch(() => null),
  ])
  const minPrice = first?.hotels[0]?.min_price
  const from = minPrice ? ` od ${formatPrice(minPrice)}` : ''
  const name = wiki?.title ?? dest.name
  const description = wiki
    ? wiki.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
    : `Porovnej zájezdy do destinace ${name} od českých cestovních kanceláří.`
  const canonical = `https://zaleto.cz/destinace/${params.slug}`
  const title = `Zájezdy ${name} ${year}${from} — srovnání cen CK`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const LIMIT = 47
const SORTS: [string, string][] = [['price_asc', 'Nejlevnější'], ['date_asc', 'Nejbližší'], ['stars_desc', 'Nejlepší hotely']]

type Item = { name: string; description: string }

function Block({ id, kicker, title, className, children }: { id: string; kicker: string; title: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} data-rail={kicker} className={`z-cardest__block${className ? " " + className : ""}`}>
      <div className="z-shead" style={{ marginBottom: 'var(--space-5)' }}>
        <div>
          <div className="z-kicker">{kicker}</div>
          <h2 style={{ fontSize: 32, lineHeight: '38px' }}>{title}{/[?!.…]$/.test(title.trim()) ? null : <span className="z-dot">.</span>}</h2>
        </div>
      </div>
      {children}
    </section>
  )
}

/** Méně důležitá sekce: ukáže se začátek obsahu, který se pozvolna ztrácí do stínu, a tlačítko rozbalí celou sekci (text je v HTML celý). */
function Fold({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} data-rail={kicker} className="z-cardest__block">
      <Teaser
        head={
          <div className="z-shead" style={{ marginBottom: 'var(--space-5)' }}>
            <div>
              <div className="z-kicker">{kicker}</div>
              <h2 style={{ fontSize: 32, lineHeight: '38px' }}>{title}{/[?!.…]$/.test(title.trim()) ? null : <span className="z-dot">.</span>}</h2>
            </div>
          </div>
        }
      >
        {children}
      </Teaser>
    </section>
  )
}

export default async function DestinacePage({ params, searchParams }: Props & { searchParams: { page?: string; sort?: string } }) {
  const dest = await resolveDestination(params.slug)
  if (!dest) notFound()

  const sort = SORTS.some(([v]) => v === searchParams.sort) ? (searchParams.sort as string) : 'price_asc'

  const [destAI, seo, landings, heroPhoto, result, articles, gallery] = await Promise.all([
    fetchDestinationAI(dest.name).catch(() => null),
    fetchDestinationSeo(dest.name),
    dest.country ? fetchLandingList() : Promise.resolve([]),
    fetchDestinationPhotoCredit(dest.name).then(async r => (r.url ? r : dest.country && dest.country !== dest.name ? fetchDestinationPhotoCredit(dest.country) : r)),
    fetchHotels({ destination: dest.name, sort, page: 1, limit: LIMIT }).catch(() => null),
    fetchArticles(3, dest.name).catch(() => []),
    destinationGallery(dest.name, dest.country).catch(() => []),
  ])
  const articleImages = await articleImageMap(articles)

  const tripSlugs = [slugify(dest.name), ...(dest.type === 'town' && dest.breadcrumb.length >= 3 ? [slugify(dest.breadcrumb[1].label)] : [])]
  const logs = await approvedTravelogues({ destSlugs: tripSlugs, limit: 6 })

  const { guide } = await loadGuide(dest)
  const hubCount = guide ? GUIDE_SECTIONS.filter(x => sectionCount(guide, x.field) > 0).length : 0

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

  // Vnitřní odkazy v textech: názvy středisek a oblastí vedou na jejich průvodce (kromě této stránky), slova o počasí na stránku počasí
  const textLinks = [...(await fetchLinkTargets()), ...weatherAutoLinks(weatherUrl)]
  const selfHref = [`/destinace/${params.slug}`]

  // „Co vidět“: místo vede na svou stránku v průvodci (shoda názvu), jinak na stránku střediska/oblasti stejného jména
  const nrm = (s: string) => slugify(s)
  const guideItems = guide
    ? GUIDE_SECTIONS.filter(s => s.key !== 'strediska' && Array.isArray(guide[s.field]))
        .flatMap(s => (guide[s.field] as { name?: string }[]).filter(i => i.name).map(i => ({ slug: nrm(i.name as string), href: `/destinace/${params.slug}/${s.key}/${nrm(i.name as string)}` })))
    : []
  const targetBySlug = new Map(textLinks.map(l => [nrm(l.name), l.href]))
  const placeHref = (name: string): string | undefined => {
    const s = nrm(name)
    const g = guideItems.find(x => x.slug === s) ?? guideItems.find(x => s.length >= 6 && x.slug.length >= 6 && (x.slug.includes(s) || s.includes(x.slug)))
    if (g) return g.href
    const t = targetBySlug.get(s)
    return t && !selfHref.includes(t) ? t : undefined
  }
  const placeItems = places.map(p => ({ ...p, href: placeHref(p.name) }))

  // Půjčovna aut: rovnou na odpovídající destinaci (u země na nejpopulárnější místo v ní)
  const carDests = mergeDestinations(await fetchDynamicCarDestinations().catch(() => []))
  const norm = (v: string | null | undefined) => slugify(v ?? '')
  const carMatch = dest.type === 'country'
    ? carDests.find(d => norm(d.country) === norm(dest.name) && d.popular) ?? carDests.find(d => norm(d.country) === norm(dest.name))
    : carDests.find(d => norm(d.name) === norm(dest.name)) ?? carDests.find(d => d.slug === norm(dest.name))
  const carUrl = carMatch ? `/pujcovna-aut/${carMatch.slug}` : '/pujcovna-aut'

  const heroId = heroPhoto?.url?.split('?')[0]
  const photos = gallery.filter(g => g.url.split("?")[0] !== heroId).slice(0, 5)

  // minináhledy v záhlaví: pár fotek z galerie, rozházené (stabilně podle slugu, ať se mezi načteními nemění)
  let seed = 0
  for (const ch of params.slug) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const thumbs = photos.length >= 3
    ? photos.slice(0, 4).map(p => ({ url: p.url, rot: Math.round((rnd() * 14 - 7) * 10) / 10, dy: Math.round(rnd() * 14 - 7) }))
    : []

  const tabs: NavTabItem[] = [
    ...(bestTime ? [{ href: '#kdy-jet', label: 'Kdy jet', icon: 'kalendar' as const }] : []),
    ...(seo ? [{ href: '#mesice', label: 'Počasí a ceny', icon: 'slunce' as const }] : []),
    ...(seo?.budget ? [{ href: '#rozpocet', label: 'Kolik stojí', icon: 'mena' as const }] : []),
    ...(hubCount ? [{ href: '#pruvodce', label: 'Průvodce', icon: 'mapa' as const }] : []),
    ...(places.length ? [{ href: '#co-videt', label: 'Co vidět', icon: 'poloha' as const }] : []),
    ...(trips.length ? [{ href: '#vylety', label: 'Výlety', icon: 'trasa' as const }] : []),
    ...(food.length ? [{ href: '#jidlo', label: 'Jídlo', icon: 'jidlo' as const }] : []),
    ...((paragraphs.length > 1 || photos.length >= 3) ? [{ href: '#o-destinaci', label: 'O destinaci a fotky', icon: 'foto' as const }] : []),
    { href: '#zajezdy', label: 'Zájezdy', icon: 'letadlo' as const },
    ...((seo?.faq.length || bestTime || hotels[0]?.min_price) ? [{ href: '#faq', label: 'Otázky', icon: 'info' as const }] : []),
    ...((pg?.total ?? 0) > 0 ? [{ href: `/destinace/${params.slug}/hotely`, label: 'Hotely', icon: 'hotel' as const }] : []),
    ...(logs.length ? [{ href: '#cestopisy', label: 'Cestopisy', icon: 'trasa' as const }] : []),
    ...(articles.length ? [{ href: '#clanky', label: 'Články', icon: 'clanek' as const }] : []),
    ...(weatherUrl ? [{ href: weatherUrl, label: 'Počasí', icon: 'slunce' as const }] : []),
    { href: carUrl, label: 'Půjčovna aut', icon: 'auto' as const },
  ]

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      ...dest.breadcrumb.map((c, i) => ({ '@type': 'ListItem', position: i + 2, name: c.label, item: `https://zaleto.cz${c.href}` })),
    ],
  }

  // Časté otázky: jen z dat, která na stránce opravdu jsou (odpovědi v textu = odpovědi ve strukturovaných datech)
  const sentences = (t: string, n: number) => t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).slice(0, n).join(' ')
  const seoFaq = seo?.faq ?? []
  const faqs = [
    // „Kdy jet“ odvozujeme z textu jen tehdy, když ji nemáme z AI obsahu (ten má vlastní, podrobnější otázky)
    ...(bestTime && !seoFaq.length ? [{ q: `Kdy jet do destinace ${dest.name}?`, a: sentences(bestTime, 3) }] : []),
    ...(hotels[0]?.min_price ? [{
      q: `Kolik stojí zájezd do destinace ${dest.name}?`,
      a: `Nejlevnější zájezd, který teď srovnáváme, vychází od ${formatPrice(hotels[0].min_price)}${pg?.total ? ` a vybírat můžeš z ${pg.total.toLocaleString('cs-CZ')} hotelů s volným termínem` : ''}. Cena závisí na termínu, délce pobytu a stravování; konečnou cenu potvrdí cestovní kancelář před rezervací.`,
    }] : []),
    // otázky z AI obsahu; dotaz na cenu už odpovídáme z aktuálních nabídek výše
    ...seoFaq.filter(f => !(hotels[0]?.min_price && /kolik\s+stoj/i.test(f.q))),
  ]
  const faqSchema = faqs.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  } : null

  const destinationSchema = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: title,
    url: `https://zaleto.cz/destinace/${params.slug}`,
    ...(paragraphs[0] ? { description: paragraphs[0] } : {}),
    ...(heroPhoto?.url?.startsWith('http') ? { image: heroPhoto.url } : {}),
    ...(dest.type !== 'country' && dest.country ? { containedInPlace: { '@type': 'Country', name: dest.country } } : {}),
    ...(places.length ? { includesAttraction: places.slice(0, 10).map(p => ({ '@type': 'TouristAttraction', name: p.name, ...(p.description ? { description: p.description } : {}) })) } : {}),
  }

  const hasLong = !!(paragraphs.length > 1 || bestTime || seo || places.length || food.length || trips.length)

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={destinationSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <Header />

      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Destinace', href: '/destinace' }, ...dest.breadcrumb]} />

        <div className="z-cardest">
          <div>
            <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>
              Destinace{dest.country && dest.country !== dest.name ? ` · ${dest.country}` : ''}
            </div>
            <h1 className="h1" style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>{title}<span className="z-dot">.</span></h1>
            {paragraphs[0] && <p className="lead" style={{ margin: 0 }}><Linked text={paragraphs[0]} links={textLinks} exclude={selfHref} /></p>}
            <div className="z-meta" style={{ marginTop: 'var(--space-5)', fontSize: 15 }}>
              {pg ? <span><Icon name="hotel" />{pg.total} hotelů s termínem</span> : null}
              {weatherUrl ? <span><Icon name="slunce" /><Link href={weatherUrl} style={{ color: 'inherit' }}>Počasí a klima</Link></span> : null}
            </div>
          </div>
          {heroPhoto?.url && (
            <div className="z-cardest__media" data-thumbs={thumbs.length > 0 || undefined}>
              <div className="z-cardest__photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Photo widths={[640, 1200]} sizes="(max-width: 767px) 100vw, 600px" src={heroPhoto.url} alt={dest.name} loading="eager" fetchPriority="high" />
                {heroPhoto.credit && (
                  <span className="z-photocredit">Foto: <a href={heroPhoto.creditUrl ?? 'https://unsplash.com'} target="_blank" rel="noopener noreferrer">{heroPhoto.credit}</a> / <a href="https://unsplash.com/?utm_source=zaleto&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></span>
                )}
              </div>
              {thumbs.length > 0 && (
                <a href="#o-destinaci" className="z-herothumbs" aria-label={`Zobrazit všech ${photos.length + 1} fotografií`}>
                  {thumbs.map((t, i) => (
                    <span key={t.url} className="z-herothumbs__item" style={{ transform: `rotate(${t.rot}deg) translateY(${t.dy}px)`, zIndex: i + 1 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <Photo widths={[640, 1200]} sizes="(max-width: 767px) 100vw, 600px" src={t.url} alt="" loading="lazy" />
                    </span>
                  ))}
                  <span className="z-herothumbs__more"><Icon name="foto" />+{photos.length} fotek</span>
                </a>
              )}
            </div>
          )}
        </div>

        <NavTabs items={tabs} />

        <div className="z-stripwrap"><OfferStrip hotels={pickOffers(hotels)} /></div>

        {/* Pořadí: 1) kdy jet a kolik to stojí, 2) kde bydlet (průvodce), 3) co vidět a dělat, rozbalovací zázemí, 4) o místě a fotky, 5) nabídka zájezdů a hned pod ní časté otázky,
            6) cestopisy a články, 7) přehledy. */}
        {(bestTime || seo) && (
          <div className="z-cardest__grid">
            <div className="z-cardest__main">
              {bestTime && (
                <Block id="kdy-jet" kicker="Kdy jet" title="nejlepší doba na cestu">
                  <div className="z-prose">{bestTime.split(/\n\n+/).map((p, i) => <p key={i}><Linked text={p} links={textLinks} exclude={selfHref} /></p>)}</div>
                  {weatherUrl && <p style={{ marginTop: 'var(--space-4)' }}><Link className="z-more" href={weatherUrl}>Počasí po měsících</Link></p>}
                </Block>
              )}
              {seo && (
                <Block id="mesice" kicker="Kdy se vyplatí jet" title={`počasí a ceny zájezdů po měsících: ${dest.name}`}>
                  <MonthsGrid seo={seo} />
                  {seo.stats.cheapest_month && seo.stats.monthly?.[String(seo.stats.cheapest_month)] ? (
                    <p className="z-note">
                      Nejlevnější zájezdy teď vycházejí na odlety v měsíci {MONTHS[seo.stats.cheapest_month - 1]} (od {formatPrice(seo.stats.monthly[String(seo.stats.cheapest_month)])}).
                    </p>
                  ) : null}
                </Block>
              )}
              {seo?.budget && (
                <Block id="rozpocet" kicker="Rozpočet" title="kolik zde stojí dovolená?">
                  <div className="z-prose"><Paragraphs text={seo.budget} links={textLinks} exclude={selfHref} /></div>
                </Block>
              )}
              {seo && seo.audiences.length > 0 && (
                <Block id="pro-koho" kicker="Pro koho" title="komu se destinace hodí">
                  <AudienceList items={seo.audiences} links={textLinks} exclude={selfHref} />
                </Block>
              )}
            </div>

            <aside className="z-cardest__side">
              {adHotel && <TourAd hotel={adHotel} sticky kicker="Dnešní tip pro Tebe" />}
            </aside>
          </div>
        )}

        {guide && hubCount > 0 && (
          <>
            {guide.facts.length > 0 && <FactsStrip facts={guide.facts} />}
            <Block id="pruvodce" kicker="Průvodce" title={`průvodce: ${dest.name}`} className="z-cardest__block--gallery">
              <GuideHub guide={guide} base={`/destinace/${params.slug}`} />
            </Block>
          </>
        )}

        {(places.length > 0 || trips.length > 0 || food.length > 0 || paragraphs.length > 1 || photos.length >= 3 || seo?.comparison) && (
          <div className="z-cardest__main" style={{ marginTop: 'var(--space-8)' }}>
            {places.length > 0 && <Block id="co-videt" kicker="Co vidět" title="místa, která stojí za to"><PlaceTickets items={placeItems} links={textLinks} exclude={selfHref} /></Block>}
            {trips.length > 0 && <Fold id="vylety" kicker="Výlety" title="výlety z místa"><TripRoute items={trips} links={textLinks} exclude={selfHref} /></Fold>}
            {food.length > 0 && <Fold id="jidlo" kicker="Jídlo" title="co ochutnat"><FoodMenu items={food} links={textLinks} exclude={selfHref} /></Fold>}
            {(paragraphs.length > 1 || photos.length >= 3) && (
              <section id="o-destinaci" data-rail="O destinaci" className="z-cardest__block z-about">
                <div className="z-shead" style={{ marginBottom: 'var(--space-6)' }}>
                  <div>
                    <div className="z-kicker">O destinaci</div>
                    <h2 style={{ fontSize: 32, lineHeight: '38px' }}>{`o místě: ${dest.name} na pár fotek`}<span className="z-dot">.</span></h2>
                  </div>
                </div>
                <div className="z-about__grid" data-solo={paragraphs.length <= 1 || photos.length < 3 || undefined}>
                  {paragraphs.length > 1 && (
                    <article className="z-about__card">
                      <div className="z-about__head">
                        <span className="z-kicker">Pozdrav z cest · {dest.name}</span>
                        <span className="z-stamp z-stamp--brand z-about__stamp"><Icon name="poloha" size="sm" />Pohled z cest</span>
                      </div>
                      <div className="z-prose"><Paragraphs text={paragraphs.slice(1).join('\n\n')} lead links={textLinks} exclude={selfHref} /></div>
                      <div className="z-about__lines" aria-hidden="true"><i /><i /><i /></div>
                    </article>
                  )}
                  {photos.length >= 3 && (
                    <div className="z-about__photos"><PhotoGallery photos={photos} name={dest.name} variant="collage" /></div>
                  )}
                </div>
              </section>
            )}
            {seo?.comparison && (
              <Fold id="srovnani" kicker="Srovnání" title={`${dest.name} nebo ${seo.comparison.with}?`}>
                <div className="z-prose">
                  <p><Linked text={seo.comparison.text} links={textLinks} exclude={selfHref} /></p>
                  <p><Link className="z-more" href={`/destinace/${slugify(seo.comparison.with)}`}>Průvodce: {seo.comparison.with}</Link></p>
                </div>
                <AiNote at={seo.generated_at} />
              </Fold>
            )}
          </div>
        )}

        <section id="zajezdy" data-rail="Zájezdy" className="z-section" style={{ scrollMarginTop: 'calc(var(--header-height) + 56px)' }}>
          <div className="z-shead">
            <div>
              <div className="z-kicker">Zájezdy</div>
              <h2>zájezdy: {dest.name}<span className="z-dot">.</span></h2>
            </div>
            <nav aria-label="Řazení" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {SORTS.map(([v, l]) => (
                <Link
                  key={v}
                  href={`/destinace/${params.slug}${v === 'price_asc' ? '' : `?sort=${v}`}#zajezdy`}
                  className="z-chip"
                  aria-current={sort === v ? 'true' : undefined}
                  style={{ textDecoration: 'none', ...(sort === v ? { background: 'var(--ink)', color: 'var(--paper)' } : {}) }}
                >{l}</Link>
              ))}
            </nav>
          </div>
          {hotels.length > 0 && <HotelsAreaMap destination={dest.name} sort={sort} showPrice collapsible />}
          {hotels.length === 0 ? (
            <p className="body">Pro tuto destinaci teď nemáme žádný volný termín.</p>
          ) : (
            <LoadMoreHotels key={sort} initial={hotels} total={pg?.total ?? hotels.length} limit={LIMIT} query={{ destination: dest.name, sort }} />
          )}
        </section>

        {faqs.length > 0 && (
          <Block id="faq" kicker="Časté otázky" title="dotazy k zájezdům" className="z-cardest__block--gallery">
            {faqs.map(({ q, a }) => (
              <details key={q} className="z-faq">
                <summary><span className="h4">{q}</span></summary>
                <p><Linked text={a} links={textLinks} exclude={selfHref} /></p>
              </details>
            ))}
          </Block>
        )}

        <section id="cestopisy" data-rail="Cestopisy" className="z-section" style={{ scrollMarginTop: 'calc(var(--header-height) + 56px)' }}>
          <div className="z-shead">
            <div>
              <div className="z-kicker">Od čtenářů</div>
              <h2>cestopisy: {dest.name}<span className="z-dot">.</span></h2>
            </div>
            <Link className="z-more" href="/cestopisy/napsat">Napsat cestopis</Link>
          </div>
          {logs.length > 0
            ? <div className="z-grid-3w">{logs.map(t => <TravelogueCard key={t.slug} t={t} />)}</div>
            : <p className="body">Byl jsi tu? <Link href="/cestopisy/napsat" className="z-more">Napiš první cestopis</Link></p>}
        </section>

        {articles.length > 0 && (
          <section id="clanky" data-rail="Články" className="z-section" style={{ scrollMarginTop: 'calc(var(--header-height) + 56px)' }}>
            <div className="z-shead">
              <div>
                <div className="z-kicker">Z cest</div>
                <h2>čerstvě z cest: {dest.name}<span className="z-dot">.</span></h2>
              </div>
              <Link className="z-more" href="/clanky">Všechny články</Link>
            </div>
            <div className="z-grid-3w">{articles.map(a => <StoryCard key={a.slug} article={a} image={articleImages.get(a.slug)} />)}</div>
          </section>
        )}

        <LinkList
          title={`Přehledy zájezdů${dest.country ? `: ${dest.country}` : ''}`}
          links={landings
            .filter(l => l.country && l.country === dest.country)
            .sort((a, b) => ({ meal: 0, stars: 1, month: 2 })[a.type] - ({ meal: 0, stars: 1, month: 2 })[b.type] || b.hotel_count - a.hotel_count)
            .slice(0, 10)
            .map(l => ({ href: `/zajezdy/${l.slug}`, label: l.title, hint: `${l.hotel_count} hotelů` }))}
        />

      </main>
    </>
  )
}
