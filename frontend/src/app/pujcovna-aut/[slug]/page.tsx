import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Icon, { type IconName } from '@/components/ui/Icon'
import Crumbs from '@/components/ui/Crumbs'
import CarRentalSearchForm from '@/components/CarRentalSearchForm'
import { getCarDestination, mergeDestinations, getRelatedDestinations } from '@/lib/carRental'
import {
  fetchDestinationPhoto, fetchDynamicCarDestinations, fetchCarRentalAI,
  type CarRentalAIData, type AirportInfo, type CarRentalTripTip, type CarRentalFAQ,
} from '@/lib/api'

export const revalidate = 86400
export const dynamicParams = true

export async function generateStaticParams() {
  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  return mergeDestinations(dynamic).map(d => ({ slug: d.slug }))
}

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  const dest = getCarDestination(params.slug, mergeDestinations(dynamic))
  if (!dest) return { title: 'Půjčovna aut | Zaleto' }

  const aiData = await fetchCarRentalAI(params.slug).catch(() => null)
  const cheapest = aiData?.car_examples?.length
    ? Math.min(...aiData.car_examples.map(c => c.price_from_eur).filter(Boolean))
    : null
  const year = new Date().getFullYear()
  const priceStr = cheapest ? ` od ${cheapest} €/den` : ''
  const title = `Půjčovna aut ${dest.name} ${year} – aktuální ceny${priceStr}`
  const description =
    `Půjč si auto v ${dest.name}${priceStr}. Srovnání 500+ půjčoven, pohonné hmoty, ` +
    `pravidla provozu a výlety autem po ${dest.country}.`
  const canonical = `https://zaleto.cz/pujcovna-aut/${dest.slug}`
  return {
    title, description,
    alternates: { canonical },
    openGraph: { title: `Půjčovna aut ${dest.name} ${year}${priceStr}`, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const paras = (s: string | null | undefined) => (s ? s.split('\n\n').filter(Boolean) : [])

export default async function PujcovnaAutSlugPage({ params }: Props) {
  const [dynamic, aiData] = await Promise.all([
    fetchDynamicCarDestinations().catch(() => []),
    fetchCarRentalAI(params.slug).catch(() => null),
  ])
  const allDests = mergeDestinations(dynamic)
  const dest = getCarDestination(params.slug, allDests)
  if (!dest) notFound()

  const heroPhoto =
    (await fetchDestinationPhoto(dest.name).catch(() => null)) ??
    (await fetchDestinationPhoto(dest.country).catch(() => null)) ??
    '/img/header-car.jpg'

  const related = getRelatedDestinations(params.slug, allDests, 8)
  const year = new Date().getFullYear()
  const hasContent = !!aiData?.intro
  const intro = paras(aiData?.intro)

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Půjčovna aut', item: 'https://zaleto.cz/pujcovna-aut' },
      { '@type': 'ListItem', position: 3, name: `Půjčovna aut ${dest.name}`, item: `https://zaleto.cz/pujcovna-aut/${dest.slug}` },
    ],
  }
  const howToSchema = {
    '@context': 'https://schema.org', '@type': 'HowTo',
    name: `Jak si půjčit auto v ${dest.name}`,
    description: `Postup rezervace půjčeného auta v ${dest.name} přes srovnávač Zaleto.`,
    step: [
      { '@type': 'HowToStep', position: 1, name: 'Zadej termín', text: `Vyber datum vyzvednutí a vrácení auta v ${dest.name}.` },
      { '@type': 'HowToStep', position: 2, name: 'Porovnej nabídky', text: 'Seřazené nabídky od 500+ půjčoven s cenou, typem auta a pojištěním.' },
      { '@type': 'HowToStep', position: 3, name: 'Rezervuj online', text: 'Rezervace je okamžitá. Platíš až na místě nebo online.' },
      { '@type': 'HowToStep', position: 4, name: 'Vyzvedni auto', text: 'Přijď na místo vyzvednutí s řidičákem, pasem a platební kartou.' },
    ],
  }
  const faqSchema = aiData?.faq?.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: aiData.faq.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  } : null

  const tabs: { href: string; label: string; icon: IconName }[] = []
  if (aiData?.airport_info) tabs.push({ href: '#letiste', label: 'Letiště', icon: 'letadlo' })
  if (aiData?.monthly_prices?.length === 12) tabs.push({ href: '#ceny-mesice', label: 'Ceny dle měsíce', icon: 'mena' })
  if (aiData?.trip_tips?.length) tabs.push({ href: `/pujcovna-aut/${dest.slug}/tipy-na-vylety-autem`, label: 'Výlety autem', icon: 'trasa' })
  if (aiData?.driving_rules) tabs.push({ href: `/pujcovna-aut/${dest.slug}/pravidla-provozu`, label: 'Pravidla provozu', icon: 'clanek' })
  if (aiData?.faq?.length) tabs.push({ href: `/pujcovna-aut/${dest.slug}/nejcastejsi-dotazy`, label: 'FAQ', icon: 'info' })

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={howToSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <Header />

      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Půjčovna aut', href: '/pujcovna-aut' }, { label: dest.name }]} />

        <div className="z-cardest">
          <div>
            <div className="z-kicker" style={{ marginTop: 'var(--space-5)' }}>Půjčovna aut · {dest.country}</div>
            <h1 className="h1" style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>{dest.name}<span className="z-dot">.</span></h1>
            {intro[0] && <p className="lead" style={{ margin: 0 }}>{intro[0]}</p>}
            {intro.length > 1 && (
              <details className="z-more-text">
                <summary className="z-more">Číst dále</summary>
                <div className="z-prose">{intro.slice(1).map((p, i) => <p key={i}>{p}</p>)}</div>
              </details>
            )}
            {tabs.length > 0 && (
              <nav aria-label="Rychlá navigace" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
                {tabs.map(t => (
                  t.href.startsWith('#')
                    ? <a key={t.label} href={t.href} className="z-chip z-chip--sky" style={{ textDecoration: 'none' }}><Icon name={t.icon} size="sm" />{t.label}</a>
                    : <Link key={t.label} href={t.href} className="z-chip z-chip--sky" style={{ textDecoration: 'none' }}><Icon name={t.icon} size="sm" />{t.label}</Link>
                ))}
              </nav>
            )}
          </div>
          <div className="z-cardest__photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroPhoto} alt={`Půjčovna aut ${dest.name} ${year}`} />
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-6)' }}>
          <CarRentalSearchForm destination={dest} />
        </div>

        {hasContent && (
          <>
            <div className="z-cardest__grid">
              <div className="z-cardest__main">
                {aiData!.airport_info && <AirportSection airport={aiData!.airport_info} destName={dest.name} />}
                {aiData!.monthly_prices?.length === 12 && <MonthlyPrices prices={aiData!.monthly_prices} destName={dest.name} />}
                <PracticalInfo aiData={aiData!} country={dest.country} slug={dest.slug} />
                {aiData!.trip_tips.length > 0 && <TripTips tips={aiData!.trip_tips} destName={dest.name} slug={dest.slug} />}
                {aiData!.practical_tips.length > 0 && <PracticalTips tips={aiData!.practical_tips} destName={dest.name} />}
                {aiData!.faq.length > 0 && <Faq faq={aiData!.faq} destName={dest.name} year={year} slug={dest.slug} />}
              </div>

              <aside className="z-cardest__side">
                <PriceBox aiData={aiData!} destName={dest.name} />
                <SubpageLinks dest={dest} />
                <RelatedCountry dest={dest} related={related} />
              </aside>
            </div>

            <RelatedWorld related={related} dest={dest} />
          </>
        )}
      </main>
    </>
  )
}

// ─── Pomocné ────────────────────────────────────────────────────────────────

function Block({ id, kicker, title, more, children }: { id?: string; kicker: string; title: string; more?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section id={id} className="z-cardest__block">
      <div className="z-shead" style={{ marginBottom: 'var(--space-5)' }}>
        <div>
          <div className="z-kicker">{kicker}</div>
          <h2 style={{ fontSize: 32, lineHeight: '38px' }}>{title}<span className="z-dot">.</span></h2>
        </div>
        {more && <Link className="z-more" href={more.href}>{more.label}</Link>}
      </div>
      {children}
    </section>
  )
}

function AirportSection({ airport, destName }: { airport: AirportInfo; destName: string }) {
  return (
    <Block id="letiste" kicker="Letiště" title={`letiště ${destName}`}>
      <div className="z-tk z-tk--v" style={{ ['--stub' as string]: '170px' }}>
        <div className="z-tk__in z-airport">
          <div>
            <h3 className="h4">{airport.name}</h3>
            <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--ink-muted)' }}>{airport.description}</p>
          </div>
          <div className="z-airport__stub">
            <span className="code">{airport.iata}</span>
            <span className="z-data">{airport.distance_km} KM OD CENTRA</span>
          </div>
        </div>
      </div>
    </Block>
  )
}

const MONTHS_FULL = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const MONTHS_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čec', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

function level(idx: number) {
  if (idx <= 75) return { color: 'var(--success)', label: 'Levná sezóna' }
  if (idx <= 105) return { color: 'var(--brand-strong)', label: 'Průměr' }
  if (idx <= 140) return { color: 'var(--accent)', label: 'Dražší' }
  return { color: 'var(--danger)', label: 'Hlavní sezóna' }
}

function MonthlyPrices({ prices, destName }: { prices: number[]; destName: string }) {
  const max = Math.max(...prices)
  return (
    <Block id="ceny-mesice" kicker="Kdy jet" title={`ceny aut v ${destName} podle měsíce`}>
      <p style={{ margin: '0 0 var(--space-5)', color: 'var(--ink-muted)', maxWidth: 640 }}>
        Orientační cenová hladina, 100 = roční průměr. Přesné ceny závisí na termínu a kategorii.
      </p>
      <div className="z-info" style={{ padding: 'var(--space-5)' }}>
        <div className="z-bars" role="img" aria-label={`Cenový index po měsících: ${prices.map((v, i) => `${MONTHS_FULL[i]} ${v}`).join(', ')}`}>
          {prices.map((v, i) => (
            <div key={i} className="z-bars__col" title={`${MONTHS_FULL[i]}: ${v} (${level(v).label})`}>
              <span className="z-bars__val">{v}</span>
              <span className="z-bars__bar" style={{ height: `${Math.max(6, Math.round((v / max) * 100))}%`, background: level(v).color }} />
              <span className="z-bars__m">{MONTHS_SHORT[i]}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2) var(--space-5)', marginTop: 'var(--space-4)' }}>
          {['Levná sezóna', 'Průměr', 'Dražší', 'Hlavní sezóna'].map((l, i) => (
            <span key={l} className="z-data" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: level([60, 100, 120, 160][i]).color }} />{l}
            </span>
          ))}
        </div>
      </div>
    </Block>
  )
}

function TextCard({ icon, title, text }: { icon: IconName; title: string; text: string | null }) {
  if (!text) return null
  return (
    <div className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', height: '100%' }}>
      <Icon name={icon} size="lg" />
      <h3 className="h4" style={{ margin: 'var(--space-3) 0' }}>{title}</h3>
      {paras(text).map((p, i) => <p key={i} style={{ margin: '0 0 var(--space-3)', color: 'var(--ink-muted)' }}>{p}</p>)}
    </div></div>
  )
}

function PracticalInfo({ aiData, country, slug }: { aiData: CarRentalAIData; country: string; slug: string }) {
  if (!aiData.fuel_info && !aiData.driving_rules) return null
  return (
    <Block id="pravidla" kicker="Praktické informace" title={`pohonné hmoty a pravidla – ${country}`} more={{ href: `/pujcovna-aut/${slug}/pravidla-provozu`, label: 'Celá stránka' }}>
      <div className="z-grid-2">
        <TextCard icon="fuel" title={`Pohonné hmoty – ${country}`} text={aiData.fuel_info} />
        <TextCard icon="clanek" title={`Pravidla provozu – ${country}`} text={aiData.driving_rules} />
      </div>
    </Block>
  )
}

function TripTips({ tips, destName, slug }: { tips: CarRentalTripTip[]; destName: string; slug: string }) {
  return (
    <Block id="vylety" kicker="Výlety autem" title={`tipy na výlety – ${destName}`} more={{ href: `/pujcovna-aut/${slug}/tipy-na-vylety-autem`, label: `Všechny výlety (${tips.length})` }}>
      <div className="z-grid-2">
        {tips.slice(0, 4).map((tip, i) => (
          <article key={i} className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', height: '100%' }}>
            <div className="z-meta" style={{ marginBottom: 'var(--space-3)' }}>
              {tip.distance_km ? <span><Icon name="trasa" />{tip.distance_km} km</span> : null}
              {tip.duration_h ? <span><Icon name="cas" />{tip.duration_h} h</span> : null}
            </div>
            <h3 className="h4">{tip.title}</h3>
            <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--ink-muted)' }}>{tip.description}</p>
          </div></article>
        ))}
      </div>
    </Block>
  )
}

function PracticalTips({ tips, destName }: { tips: string[]; destName: string }) {
  return (
    <Block id="tipy" kicker="Tipy a rady" title={`praktické tipy – ${destName}`}>
      <ul className="z-ticks">
        {tips.map((t, i) => <li key={i}><Icon name="ok" size="sm" />{t}</li>)}
      </ul>
    </Block>
  )
}

function Faq({ faq, destName, year, slug }: { faq: CarRentalFAQ[]; destName: string; year: number; slug: string }) {
  return (
    <Block id="faq" kicker="Časté dotazy" title={`dotazy – ${destName} ${year}`} more={{ href: `/pujcovna-aut/${slug}/nejcastejsi-dotazy`, label: `Všechny dotazy (${faq.length})` }}>
      <div>
        {faq.slice(0, 5).map((f, i) => (
          <details key={i} className="z-faq">
            <summary><span className="z-kicker" style={{ color: 'var(--brand-strong)' }}>{String(i + 1).padStart(2, '0')}</span><span className="h4">{f.question}</span></summary>
            <p>{f.answer}</p>
          </details>
        ))}
      </div>
    </Block>
  )
}

// ─── Postranní panel ───────────────────────────────────────────────────────

function PriceBox({ aiData, destName }: { aiData: CarRentalAIData; destName: string }) {
  if (!aiData.price_overview && !aiData.best_car_types) return null
  return (
    <div className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)' }}>
      {aiData.price_overview && (
        <>
          <div className="z-kicker">Ceny</div>
          <h3 className="h4" style={{ margin: 'var(--space-2) 0 var(--space-3)' }}>Kolik stojí auto – {destName}?</h3>
          {paras(aiData.price_overview).map((p, i) => <p key={i} style={{ margin: '0 0 var(--space-3)', color: 'var(--ink-muted)' }}>{p}</p>)}
        </>
      )}
      {aiData.best_car_types && (
        <>
          <div className="z-kicker" style={{ marginTop: 'var(--space-4)' }}>Doporučení</div>
          <h3 className="h4" style={{ margin: 'var(--space-2) 0 var(--space-3)' }}>Jaké auto si vybrat?</h3>
          {paras(aiData.best_car_types).map((p, i) => <p key={i} style={{ margin: '0 0 var(--space-3)', color: 'var(--ink-muted)' }}>{p}</p>)}
        </>
      )}
    </div></div>
  )
}

function SubpageLinks({ dest }: { dest: NonNullable<ReturnType<typeof getCarDestination>> }) {
  const links = [
    { href: `/pujcovna-aut/${dest.slug}/tipy-na-vylety-autem`, label: `Výlety autem – ${dest.name}` },
    { href: `/pujcovna-aut/${dest.slug}/pravidla-provozu`, label: `Pravidla provozu – ${dest.country}` },
    { href: `/pujcovna-aut/${dest.slug}/nejcastejsi-dotazy`, label: 'Nejčastější dotazy' },
    { href: `/pocasi/${dest.countrySlug}`, label: `Počasí – ${dest.country}` },
    { href: `/destinace/${dest.countrySlug}`, label: `Hotely – ${dest.country}` },
  ]
  return (
    <div className="z-info" style={{ padding: 'var(--space-5)' }}>
      <div className="z-kicker" style={{ marginBottom: 'var(--space-3)' }}>Stránky půjčovny</div>
      <ul className="z-linklist">
        {links.map(l => <li key={l.href}><Link href={l.href}>{l.label}<Icon name="sipka" size="sm" /></Link></li>)}
      </ul>
    </div>
  )
}

function RelatedCountry({ dest, related }: { dest: NonNullable<ReturnType<typeof getCarDestination>>; related: ReturnType<typeof getRelatedDestinations> }) {
  const same = related.filter(d => d.country === dest.country).slice(0, 6)
  if (!same.length) return null
  return (
    <div>
      <div className="z-kicker" style={{ marginBottom: 'var(--space-3)' }}>Půjčovny aut – {dest.country}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {same.map(d => <Link key={d.slug} className="z-chip" href={`/pujcovna-aut/${d.slug}`} style={{ textDecoration: 'none' }}>{d.name}</Link>)}
      </div>
    </div>
  )
}

function RelatedWorld({ related, dest }: { related: ReturnType<typeof getRelatedDestinations>; dest: NonNullable<ReturnType<typeof getCarDestination>> }) {
  const world = related.filter(d => d.country !== dest.country)
  if (!world.length) return null
  return (
    <section style={{ marginTop: 'var(--space-8)' }}>
      <div className="z-kicker" style={{ marginBottom: 'var(--space-4)' }}>Populární světové destinace</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {world.map(d => <Link key={d.slug} className="z-chip" href={`/pujcovna-aut/${d.slug}`} style={{ textDecoration: 'none' }}>{d.name}</Link>)}
      </div>
    </section>
  )
}
