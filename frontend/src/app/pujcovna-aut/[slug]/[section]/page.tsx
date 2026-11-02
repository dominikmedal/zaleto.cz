import type { Metadata } from 'next'
import PlaceLinks from '@/components/PlaceLinks'
import { slugify } from '@/lib/slugify'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import CarRentalSearchForm from '@/components/CarRentalSearchForm'
import { getCarDestination, mergeDestinations } from '@/lib/carRental'
import {
  fetchDynamicCarDestinations, fetchCarRentalAI,
  type CarRentalAIData, type CarRentalTripTip, type CarRentalFAQ,
} from '@/lib/api'
import Icon, { type IconName } from '@/components/ui/Icon'
import Crumbs from '@/components/ui/Crumbs'
import ItemCard from '@/components/ui/ItemCard'
export const revalidate = 86400
export const dynamicParams = true

const SECTIONS = ['tipy-na-vylety-autem', 'pravidla-provozu', 'nejcastejsi-dotazy'] as const
type Section = typeof SECTIONS[number]

function isValidSection(s: string): s is Section {
  return (SECTIONS as readonly string[]).includes(s)
}

const SECTION_META: Record<Section, {
  title: (name: string, country: string, year: number) => string
  description: (name: string, country: string) => string
  heading: (name: string, country: string, year: number) => string
}> = {
  'tipy-na-vylety-autem': {
    title: (name, _country, year) => `Tipy na výlety autem z ${name} ${year} – nejlepší trasy`,
    description: (name, country) => `Nejlepší výlety autem z ${name} — vzdálenosti, trasy a tipy na co vidět v ${country}. Půjčte si auto a prozkoumejte ${country} za volantem.`,
    heading: (name) => `Tipy na výlety autem z ${name}`,
  },
  'pravidla-provozu': {
    title: (_name, country, year) => `Pravidla silničního provozu ${country} ${year} – pohonné hmoty`,
    description: (name, country) => `Kompletní průvodce pravidly silničního provozu v ${country}: rychlostní limity, alkohol za volantem, pohonné hmoty a ceny. Vše co potřebujete vědět před půjčením auta v ${name}.`,
    heading: (_name, country) => `Pravidla silničního provozu v ${country}`,
  },
  'nejcastejsi-dotazy': {
    title: (name, _country, year) => `Nejčastější dotazy – půjčovna aut ${name} ${year}`,
    description: (name, country) => `Odpovědi na nejčastější otázky o půjčování aut v ${name}, ${country}: věk řidiče, pojištění, kauce, platba a další. Vše o pronájmu auta v ${country}.`,
    heading: (name, _country, year) => `Nejčastější dotazy – půjčovna aut ${name} ${year}`,
  },
}

interface Props { params: { slug: string; section: string } }

export async function generateStaticParams() {
  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  const allDests = mergeDestinations(dynamic)
  return allDests.flatMap(d => SECTIONS.map(section => ({ slug: d.slug, section })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidSection(params.section)) return { title: 'Půjčovna aut' }

  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  const dest = getCarDestination(params.slug, mergeDestinations(dynamic))
  if (!dest) return { title: 'Půjčovna aut' }

  const year = new Date().getFullYear()
  const meta = SECTION_META[params.section]
  const title = meta.title(dest.name, dest.country, year)
  const description = meta.description(dest.name, dest.country)
  const canonical = `https://zaleto.cz/pujcovna-aut/${dest.slug}/${params.section}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'article', siteName: 'Zaleto', locale: 'cs_CZ' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function CarRentalSectionPage({ params }: Props) {
  if (!isValidSection(params.section)) notFound()

  const [dynamic, aiData] = await Promise.all([
    fetchDynamicCarDestinations().catch(() => []),
    fetchCarRentalAI(params.slug).catch(() => null),
  ])

  const dest = getCarDestination(params.slug, mergeDestinations(dynamic))
  if (!dest) notFound()

  const year = new Date().getFullYear()
  const section = params.section

  // Section-specific content guards
  if (section === 'tipy-na-vylety-autem' && !aiData?.trip_tips?.length) notFound()
  if (section === 'pravidla-provozu' && !aiData?.fuel_info && !aiData?.driving_rules) notFound()
  if (section === 'nejcastejsi-dotazy' && !aiData?.faq?.length) notFound()

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Půjčovna aut', item: 'https://zaleto.cz/pujcovna-aut' },
      { '@type': 'ListItem', position: 3, name: `Půjčovna aut ${dest.name}`, item: `https://zaleto.cz/pujcovna-aut/${dest.slug}` },
      { '@type': 'ListItem', position: 4, name: SECTION_META[section].heading(dest.name, dest.country, year), item: `https://zaleto.cz/pujcovna-aut/${dest.slug}/${section}` },
    ],
  }

  const faqSchema = section === 'nejcastejsi-dotazy' && aiData?.faq?.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: aiData.faq.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  } : null

  const tripItemListSchema = section === 'tipy-na-vylety-autem' && aiData?.trip_tips?.length ? {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `Výlety autem z ${dest.name}`,
    itemListElement: aiData.trip_tips.map((tip, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: { '@type': 'TouristAttraction', name: tip.title, description: tip.description },
    })),
  } : null

  const otherSections = SECTIONS.filter(s => s !== section)

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      {tripItemListSchema && <JsonLd data={tripItemListSchema} />}
      <Header />

      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[
          { label: 'Zaleto', href: '/' },
          { label: 'Půjčovna aut', href: '/pujcovna-aut' },
          { label: dest.name, href: `/pujcovna-aut/${dest.slug}` },
          { label: sectionLabel(section) },
        ]} />

        <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>Půjčovna aut · {dest.country}</div>
        <h1 className="h1" style={{ margin: 'var(--space-3) 0 var(--space-5)' }}>
          {SECTION_META[section].heading(dest.name, dest.country, year)}<span className="z-dot">.</span>
        </h1>

        <nav aria-label="Další sekce" className="z-navtabs" style={{ marginTop: 0, marginBottom: 'var(--space-7)' }}>
          <Link href={`/pujcovna-aut/${dest.slug}`} className="z-navtab">
            <span className="z-navtab__ic"><Icon name="sipka" style={{ transform: 'rotate(180deg)' }} /></span>
            <span className="z-navtab__label">Přehled {dest.name}</span>
          </Link>
          {otherSections.map(s => (
            <Link key={s} href={`/pujcovna-aut/${dest.slug}/${s}`} className="z-navtab">
              <span className="z-navtab__ic"><Icon name={sectionIcon(s)} /></span>
              <span className="z-navtab__label">{sectionLabel(s)}</span>
              <Icon name="sipka" size="sm" className="z-navtab__go" />
            </Link>
          ))}
        </nav>

        {section === 'tipy-na-vylety-autem' && aiData?.trip_tips && <TripTipsFullPage tips={aiData.trip_tips} destName={dest.name} />}
        {section === 'pravidla-provozu' && aiData && <DrivingRulesFullPage aiData={aiData} country={dest.country} />}
        {section === 'nejcastejsi-dotazy' && aiData?.faq && <FAQFullPage faq={aiData.faq} destName={dest.name} />}

        <section className="z-section">
          <div className="z-shead">
            <div>
              <div className="z-kicker">Rezervace</div>
              <h2>půjčit auto — {dest.name}<span className="z-dot">.</span></h2>
            </div>
          </div>
          <CarRentalSearchForm destination={dest} />
        </section>

        <div style={{ marginTop: 'var(--space-7)' }}>
          <Link href={`/pujcovna-aut/${dest.slug}`} className="z-more">Zpět na přehled — {dest.name}</Link>
        </div>

        <PlaceLinks slug={slugify(dest.name)} skip={['car']} />
      </main>
    </>
  )
}

// ─── Pomocné ────────────────────────────────────────────────────────────────

function sectionLabel(s: Section): string {
  switch (s) {
    case 'tipy-na-vylety-autem': return 'Výlety autem'
    case 'pravidla-provozu': return 'Pravidla provozu'
    case 'nejcastejsi-dotazy': return 'Časté dotazy'
  }
}

function sectionIcon(s: Section): IconName {
  switch (s) {
    case 'tipy-na-vylety-autem': return 'trasa'
    case 'pravidla-provozu': return 'clanek'
    case 'nejcastejsi-dotazy': return 'info'
  }
}

const paras = (s: string | null | undefined) => (s ? s.split('\n\n').filter(Boolean) : [])

function TripTipsFullPage({ tips, destName }: { tips: CarRentalTripTip[]; destName: string }) {
  return (
    <div>
      <p className="lead" style={{ maxWidth: 'var(--article-max)', margin: '0 0 var(--space-6)' }}>
        Prozkoumej {destName} a okolí za volantem. Níže je {tips.length} tipů na výlety s orientačními vzdálenostmi a dobami jízdy.
      </p>
      <div className="z-grid-3">
        {tips.map((tip, i) => (
          <ItemCard
            key={i}
            title={tip.title}
            text={tip.description}
            icon="trasa"
            meta={<>
              {tip.distance_km ? <span><Icon name="trasa" />{tip.distance_km} km</span> : null}
              {tip.duration_h ? <span><Icon name="cas" />{tip.duration_h} h</span> : null}
            </>}
          />
        ))}
      </div>
    </div>
  )
}

function DrivingRulesFullPage({ aiData, country }: { aiData: CarRentalAIData; country: string }) {
  return (
    <div className="z-cardest__main" style={{ maxWidth: 'var(--article-max)' }}>
      {aiData.fuel_info && (
        <section>
          <div className="z-kicker">Pohonné hmoty</div>
          <h2 className="h2" style={{ margin: 'var(--space-2) 0 var(--space-4)' }}>pohonné hmoty v {country}<span className="z-dot">.</span></h2>
          <div className="z-prose">{paras(aiData.fuel_info).map((t, i) => <p key={i}>{t}</p>)}</div>
        </section>
      )}
      {aiData.driving_rules && (
        <section>
          <div className="z-kicker">Dopravní předpisy</div>
          <h2 className="h2" style={{ margin: 'var(--space-2) 0 var(--space-4)' }}>silniční pravidla v {country}<span className="z-dot">.</span></h2>
          <div className="z-prose">{paras(aiData.driving_rules).map((t, i) => <p key={i}>{t}</p>)}</div>
        </section>
      )}
      {aiData.practical_tips?.length > 0 && (
        <section>
          <div className="z-kicker">Tipy</div>
          <h2 className="h2" style={{ margin: 'var(--space-2) 0 var(--space-4)' }}>praktické rady před cestou<span className="z-dot">.</span></h2>
          <ul className="z-ticks" style={{ gridTemplateColumns: '1fr' }}>
            {aiData.practical_tips.map((tip, i) => <li key={i}><Icon name="ok" size="sm" />{tip}</li>)}
          </ul>
        </section>
      )}
    </div>
  )
}

function FAQFullPage({ faq, destName }: { faq: CarRentalFAQ[]; destName: string }) {
  return (
    <div style={{ maxWidth: 'var(--article-max)' }}>
      <p className="lead" style={{ margin: '0 0 var(--space-5)' }}>Odpovědi na {faq.length} nejčastějších otázek o půjčování aut v {destName}.</p>
      {faq.map((item, i) => (
        <details key={i} className="z-faq">
          <summary><span className="h4">{item.question}</span></summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  )
}
