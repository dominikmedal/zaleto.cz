import type { Metadata } from 'next'
import type { ElementType, CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import CarRentalSearchForm from '@/components/CarRentalSearchForm'
import { getCarDestination, mergeDestinations, getRelatedDestinations } from '@/lib/carRental'
import {
  fetchDestinationPhoto, fetchDynamicCarDestinations, fetchCarRentalAI,
  type CarRentalAIData, type AirportInfo, type CarExample,
  type CarRentalTripTip, type CarRentalFAQ,
} from '@/lib/api'
import {
  Car, ChevronRight, Fuel, BookOpen, CircleDollarSign, MapPin,
  MessageCircleQuestion, Star, Users, Briefcase, Zap, Route, Clock,
  CheckCircle2, Plane, TrendingUp, ArrowRight, ExternalLink,
} from 'lucide-react'

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
  const cheapestPrice = aiData?.car_examples?.length
    ? Math.min(...aiData.car_examples.map(c => c.price_from_eur).filter(Boolean))
    : null

  const year = new Date().getFullYear()
  const priceStr = cheapestPrice ? ` od ${cheapestPrice} €/den` : ''
  const title = `Půjčovna aut ${dest.name} ${year} – Aktuální ceny${priceStr}`
  const description =
    `Půjčte si auto v ${dest.name}${priceStr}. Srovnání 500+ půjčoven, pohonné hmoty, ` +
    `pravidla provozu a výlety autem po ${dest.country}. Garantovaná cena bez skrytých poplatků.`
  const canonical = `https://zaleto.cz/pujcovna-aut/${dest.slug}`

  return {
    title, description,
    alternates: { canonical },
    openGraph: { title: `Půjčovna aut ${dest.name} ${year}${priceStr}`, description, url: canonical, type: 'website', siteName: 'Zaleto', locale: 'cs_CZ' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PujcovnaAutSlugPage({ params }: Props) {
  const [dynamic, aiData, heroPhoto] = await Promise.all([
    fetchDynamicCarDestinations().catch(() => []),
    fetchCarRentalAI(params.slug).catch(() => null),
    fetchDestinationPhoto(params.slug).catch(() => null),
  ])

  const allDests = mergeDestinations(dynamic)
  const dest = getCarDestination(params.slug, allDests)
  if (!dest) notFound()

  const relatedDests = getRelatedDestinations(params.slug, allDests, 6)
  const year = new Date().getFullYear()
  const hasContent = !!aiData?.intro

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
      { '@type': 'HowToStep', position: 1, name: 'Zadejte termín', text: `Vyberte datum vyzvednutí a vrácení auta v ${dest.name}.` },
      { '@type': 'HowToStep', position: 2, name: 'Porovnejte nabídky', text: 'Seřazené nabídky od 500+ půjčoven s cenou, typem auta a pojištěním.' },
      { '@type': 'HowToStep', position: 3, name: 'Rezervujte online', text: 'Rezervace je okamžitá. Platíte až na místě nebo online.' },
      { '@type': 'HowToStep', position: 4, name: 'Vyzvedněte auto', text: `Přijďte na místo vyzvednutí s řidičákem, pasem a platební kartou.` },
    ],
  }

  const carItemListSchema = aiData?.car_examples?.length ? {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: `Auta k pronájmu v ${dest.name} ${year}`,
    itemListElement: aiData.car_examples.map((car, i) => ({
      '@type': 'ListItem', position: i + 1,
      item: {
        '@type': 'Product',
        name: `${car.name} – pronájem ${dest.name}`,
        description: car.description,
        offers: { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: String(car.price_from_eur), offerCount: '50+', availability: 'https://schema.org/InStock' },
      },
    })),
  } : null

  const faqSchema = aiData?.faq?.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: aiData.faq.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  } : null

  return (
    <div className="min-h-screen">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={howToSchema} />
      {carItemListSchema && <JsonLd data={carItemListSchema} />}
      {faqSchema && <JsonLd data={faqSchema} />}
      <Header />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {heroPhoto ? (
        <div className="relative h-[300px] sm:h-[380px]">
          <Image src={heroPhoto} alt={`Půjčovna aut ${dest.name} ${year}`} fill className="object-cover"
            style={{ filter: 'brightness(1.05) saturate(1.1)' }} priority />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,0.90) 36%, rgba(255,255,255,0.55) 65%, rgba(255,255,255,0.0) 100%)'
          }} />
          <div className="absolute inset-x-0 bottom-0 h-28" style={{
            background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.5) 60%, transparent 100%)'
          }} />
          <div className="relative h-full flex items-center">
            <div className="max-w-[1680px] mx-auto px-4 sm:px-10 w-full">
              <BreadcrumbNav dest={dest} />
              <HeroTitle dest={dest} year={year} aiData={aiData} />
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-[1680px] mx-auto px-4 sm:px-10 pt-8 pb-4">
          <BreadcrumbNav dest={dest} />
          <HeroTitle dest={dest} year={year} aiData={aiData} />
        </div>
      )}

      {/* ── Search form ──────────────────────────────────────────────────── */}
      <section className="max-w-[1680px] mx-auto px-4 sm:px-8 py-8 pb-10">
        <CarRentalSearchForm destination={dest} />
      </section>

      {/* ── AI rich content ──────────────────────────────────────────────── */}
      {hasContent && (
        <main className="max-w-[1680px] mx-auto px-4 sm:px-8 pb-16 space-y-14">

          <IntroSection aiData={aiData!} destName={dest.name} year={year} />

          {aiData!.airport_info && (
            <AirportSection airport={aiData!.airport_info} destName={dest.name} />
          )}

          {aiData!.car_examples.length > 0 && (
            <CarExamplesSection examples={aiData!.car_examples} destName={dest.name} year={year} />
          )}

          {aiData!.monthly_prices?.length === 12 && (
            <MonthlyPricesSection prices={aiData!.monthly_prices} destName={dest.name} />
          )}

          <PracticalInfoSection aiData={aiData!} country={dest.country} destSlug={dest.slug} />

          <PriceSection aiData={aiData!} destName={dest.name} />

          {aiData!.trip_tips.length > 0 && (
            <TripTipsSection tips={aiData!.trip_tips} destName={dest.name} destSlug={dest.slug} />
          )}

          {aiData!.practical_tips.length > 0 && (
            <PracticalTipsSection tips={aiData!.practical_tips} destName={dest.name} />
          )}

          {aiData!.faq.length > 0 && (
            <FAQSection faq={aiData!.faq} destName={dest.name} year={year} destSlug={dest.slug} />
          )}

          <RelatedSection dest={dest} relatedDests={relatedDests} />
        </main>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function BreadcrumbNav({ dest }: { dest: ReturnType<typeof getCarDestination> & {} }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-4">
      <Link href="/" className="hover:text-[#0093FF] transition-colors">Zaleto</Link>
      <ChevronRight className="w-3 h-3" />
      <Link href="/pujcovna-aut" className="hover:text-[#0093FF] transition-colors">Půjčovna aut</Link>
      <ChevronRight className="w-3 h-3" />
      <span className="text-gray-700 font-medium">{dest.name}</span>
    </nav>
  )
}

const MONTHS_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čec', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

const NAV_TAB_STYLE: CSSProperties = {
  border: '1.5px solid rgba(0,147,255,0.14)',
  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
  background: '#fff',
}

function NavTab({ href, icon: Icon, label, isLink }: { href: string; icon: ElementType; label: string; isLink?: boolean }) {
  const inner = (
    <>
      <span className="flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0" style={{ background: '#EDF6FF' }}>
        <Icon style={{ width: 15, height: 15, color: '#0093FF' }} />
      </span>
      <span className="font-semibold text-gray-700 group-hover:text-[#0093FF] transition-colors" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
        {label}
      </span>
    </>
  )
  const cls = "group inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl whitespace-nowrap transition-colors duration-150 hover:border-[#0093FF]/30"
  return isLink
    ? <Link href={href} className={cls} style={NAV_TAB_STYLE}>{inner}</Link>
    : <a href={href} className={cls} style={NAV_TAB_STYLE}>{inner}</a>
}

function HeroTitle({ dest, year, aiData }: {
  dest: ReturnType<typeof getCarDestination> & {}
  year: number
  aiData: CarRentalAIData | null
}) {
  return (
    <>
      <p className="text-[11px] font-semibold text-[#0093FF] uppercase tracking-[0.12em] mb-3">
        Půjčovna aut · {dest.country}
      </p>
      <h1
        className="font-bold text-gray-900 leading-tight tracking-tight mb-2"
        style={{ fontSize: 'clamp(26px, 4.5vw, 52px)' }}
      >
        Půjčovna aut {dest.name} {year}
      </h1>
      <p className="text-gray-500 text-sm sm:text-base mb-5 max-w-[560px] leading-relaxed">
        Půjčovna aut {dest.name} {year} – kompletní průvodce k pronájmu auta, srovnání 500+ půjčoven a tipy na výlety.
      </p>

      {/* Section navigation */}
      {aiData?.intro && (
        <nav aria-label="Obsah stránky" className="flex flex-wrap gap-2">
          {aiData.airport_info && (
            <NavTab href="#letiste" icon={Plane} label="Letiště" />
          )}
          <NavTab href="#auta" icon={Car} label="Dostupná auta" />
          <NavTab href="#ceny-mesice" icon={TrendingUp} label="Ceny dle měsíce" />
          {aiData.trip_tips?.length > 0 && (
            <NavTab href={`/pujcovna-aut/${dest.slug}/tipy-na-vylety-autem`} icon={Route} label="Výlety autem" isLink />
          )}
          {aiData.driving_rules && (
            <NavTab href={`/pujcovna-aut/${dest.slug}/pravidla-provozu`} icon={BookOpen} label="Pravidla provozu" isLink />
          )}
          {aiData.faq?.length > 0 && (
            <NavTab href={`/pujcovna-aut/${dest.slug}/nejcastejsi-dotazy`} icon={MessageCircleQuestion} label="FAQ" isLink />
          )}
        </nav>
      )}
    </>
  )
}

function IntroSection({ aiData, destName, year }: { aiData: CarRentalAIData; destName: string; year: number }) {
  const paragraphs = aiData.intro?.split('\n\n').filter(Boolean) ?? []
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Průvodce</p>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
        Půjčovna aut {destName} {year} – kompletní průvodce
      </h2>
      <div className="max-w-3xl">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-gray-600 leading-relaxed mb-4 text-sm sm:text-base">{p}</p>
        ))}
      </div>
    </section>
  )
}

function AirportSection({ airport, destName }: { airport: AirportInfo; destName: string }) {
  return (
    <section id="letiste" className="scroll-mt-20">
      <div className="flex items-center gap-2 mb-2">
        <Plane className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Letiště</p>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-5"
        style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
        Půjčovna aut {destName} letiště
      </h2>
      <div className="glass-card rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:items-start">
        <div className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl text-white font-black text-xl bg-[#0093FF]">
          {airport.iata}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h3 className="font-bold text-gray-900 text-lg leading-tight">{airport.name}</h3>
            <span className="glass-pill text-[11px] font-bold text-[#0068CC] px-2.5 py-1 rounded-full">
              {airport.distance_km} km od centra
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{airport.description}</p>
        </div>
      </div>
    </section>
  )
}

const CATEGORY_COLOR: Record<string, string> = {
  Economy: '#0093FF', Compact: '#00B4A0', SUV: '#7C3AED',
  Minivan: '#D97706', Premium: '#DB2777', Ostatní: '#6B7280',
}

function CarExamplesSection({ examples, destName, year }: { examples: CarExample[]; destName: string; year: number }) {
  return (
    <section id="auta" className="scroll-mt-20">
      <div className="flex items-center gap-2 mb-2">
        <Car className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Dostupná auta</p>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-2"
        style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
        Která auta si půjčit v {destName}
      </h2>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Přehled kategorií a modelů nejčastěji dostupných v destinaci. Konkrétní nabídky a aktuální ceny {year} zobrazíte zadáním termínu výše.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {examples.map((car, i) => {
          const color = CATEGORY_COLOR[car.category] ?? '#0093FF'
          return (
            <article key={i} className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2"
                    style={{ background: `${color}18`, color }}>
                    {car.category}
                  </span>
                  <h3 className="font-bold text-gray-900 leading-tight">{car.name}</h3>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[11px] text-gray-400">od</div>
                  <div className="font-black text-lg text-gray-900">{car.price_from_eur} €</div>
                  <div className="text-[11px] text-gray-400">/den</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {car.seats && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {car.seats} míst</span>}
                {car.bags  && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {car.bags} kuf.</span>}
                {car.transmission && <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> {car.transmission}</span>}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{car.description}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

const MONTHS_CS_FULL = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const MONTHS_CS_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čec', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro']

function priceColor(idx: number) {
  if (idx <= 75)  return '#22C55E'
  if (idx <= 105) return '#F59E0B'
  if (idx <= 140) return '#F97316'
  return '#EF4444'
}

function MonthlyPricesSection({ prices, destName }: { prices: number[]; destName: string }) {
  const max = Math.max(...prices)
  return (
    <section id="ceny-mesice" className="scroll-mt-20">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Kdy jet</p>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-2"
        style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
        Ceny půjčovny aut {destName} podle měsíce
      </h2>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Orientační přehled cenové hladiny — 100 = roční průměr. Přesné ceny závisí na termínu a kategorii.
      </p>
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-end gap-1.5 sm:gap-2 h-28 mb-3">
          {prices.map((val, i) => {
            const heightPct = Math.round((val / max) * 100)
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-gray-900 text-white text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap">
                    {MONTHS_CS_FULL[i]}: {val}
                  </div>
                </div>
                <div className="w-full rounded-t-md transition-opacity hover:opacity-80"
                  style={{ height: `${heightPct}%`, background: priceColor(val), minHeight: 4 }} />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          {MONTHS_CS_SHORT.map(m => (
            <div key={m} className="flex-1 text-center text-[9px] sm:text-[10px] font-semibold text-gray-400">{m}</div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 pt-4 border-t border-gray-100">
          {[{ color: '#22C55E', label: 'Levná sezóna' }, { color: '#F59E0B', label: 'Průměr' }, { color: '#F97316', label: 'Dražší' }, { color: '#EF4444', label: 'Hlavní sezóna' }].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>{MONTHS_CS_SHORT.map(m => <th key={m} className="py-2 px-1 text-center font-semibold text-gray-500 bg-gray-50 border border-gray-100 min-w-[48px]">{m}</th>)}</tr>
          </thead>
          <tbody>
            <tr>{prices.map((val, i) => <td key={i} className="py-2 px-1 text-center font-bold border border-gray-100" style={{ color: priceColor(val), background: `${priceColor(val)}12` }}>{val}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PracticalInfoSection({ aiData, country, destSlug }: { aiData: CarRentalAIData; country: string; destSlug: string }) {
  if (!aiData.fuel_info && !aiData.driving_rules) return null
  return (
    <section id="pravidla" className="scroll-mt-20">
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-[#0093FF]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Praktické informace</p>
        </div>
        <Link href={`/pujcovna-aut/${destSlug}/pravidla-provozu`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0068CC] hover:underline">
          Celá stránka <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
        Pohonné hmoty a pravidla silničního provozu v {country}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {aiData.fuel_info && (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 bg-[#0093FF]">
                <Fuel className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-gray-900">Pohonné hmoty v {country}</h3>
            </div>
            {aiData.fuel_info.split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        )}
        {aiData.driving_rules && (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 bg-violet-600">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-gray-900">Pravidla silničního provozu v {country}</h3>
            </div>
            {aiData.driving_rules.split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function PriceSection({ aiData, destName }: { aiData: CarRentalAIData; destName: string }) {
  if (!aiData.price_overview && !aiData.best_car_types) return null
  return (
    <section id="ceny" className="section-island scroll-mt-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {aiData.price_overview && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CircleDollarSign className="w-4 h-4 text-[#0093FF]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Ceny</p>
            </div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}>
              Kolik stojí půjčení auta v {destName}?
            </h2>
            {aiData.price_overview.split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        )}
        {aiData.best_car_types && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-4 h-4 text-[#0093FF]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Doporučení</p>
            </div>
            <h2 className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}>
              Jaké auto si vybrat pro {destName}?
            </h2>
            {aiData.best_car_types.split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function TripTipsSection({ tips, destName, destSlug }: { tips: CarRentalTripTip[]; destName: string; destSlug: string }) {
  // Show only first 2 on main page, link to sub-page for full list
  const preview = tips.slice(0, 2)
  const hasMore = tips.length > 2
  return (
    <section id="vylety" className="scroll-mt-20">
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-[#0093FF]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Výlety autem</p>
        </div>
        <Link href={`/pujcovna-aut/${destSlug}/tipy-na-vylety-autem`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0068CC] hover:underline">
          Všechny výlety ({tips.length}) <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
        Tipy na výlety autem z {destName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {preview.map((tip, i) => (
          <article key={i} className="glass-card rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-3 right-3 font-black text-4xl leading-none select-none"
              style={{ color: 'rgba(0,147,255,0.06)',  }}>
              {i + 1}
            </div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {tip.distance_km && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0068CC] glass-pill px-2 py-0.5 rounded-full"><MapPin className="w-3 h-3" /> {tip.distance_km} km</span>}
              {tip.duration_h  && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 glass-pill px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> {tip.duration_h} h</span>}
            </div>
            <h3 className="font-bold text-gray-900 mb-2 leading-tight">{tip.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{tip.description}</p>
          </article>
        ))}
      </div>
      {hasMore && (
        <div className="mt-4">
          <Link href={`/pujcovna-aut/${destSlug}/tipy-na-vylety-autem`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0093FF] glass-pill px-4 py-2 rounded-full hover:bg-[#0093FF]/10 transition-colors">
            Zobrazit všechny výlety <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  )
}

function PracticalTipsSection({ tips, destName }: { tips: string[]; destName: string }) {
  return (
    <section id="tipy" className="section-island scroll-mt-20">
      <div className="flex items-center gap-2 mb-2">
        <Star className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Tipy a rady</p>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
        Praktické tipy pro půjčení auta v {destName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#0093FF] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 leading-relaxed">{tip}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FAQSection({ faq, destName, year, destSlug }: { faq: CarRentalFAQ[]; destName: string; year: number; destSlug: string }) {
  const preview = faq.slice(0, 4)
  const hasMore = faq.length > 4
  return (
    <section id="faq" className="scroll-mt-20">
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4 text-[#0093FF]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Časté dotazy</p>
        </div>
        <Link href={`/pujcovna-aut/${destSlug}/nejcastejsi-dotazy`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0068CC] hover:underline">
          Všechny dotazy ({faq.length}) <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
        Nejčastější dotazy – půjčovna aut {destName} {year}
      </h2>
      <div className="space-y-3 max-w-3xl">
        {preview.map((item, i) => (
          <details key={i} className="glass-card rounded-2xl overflow-hidden group">
            <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-semibold text-gray-900 hover:text-[#0093FF] transition-colors select-none text-sm">
              <span>{item.question}</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-90 text-gray-400" />
            </summary>
            <div className="px-5 pb-4">
              <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
      {hasMore && (
        <div className="mt-4">
          <Link href={`/pujcovna-aut/${destSlug}/nejcastejsi-dotazy`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0093FF] glass-pill px-4 py-2 rounded-full hover:bg-[#0093FF]/10 transition-colors">
            Zobrazit všechny otázky <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  )
}

function RelatedSection({ dest, relatedDests }: {
  dest: ReturnType<typeof getCarDestination> & {}
  relatedDests: ReturnType<typeof getRelatedDestinations>
}) {
  const sameCountry = relatedDests.filter(d => d.country === dest.country)
  const otherCountry = relatedDests.filter(d => d.country !== dest.country)

  const subpageLinks = [
    { href: `/pujcovna-aut/${dest.slug}/tipy-na-vylety-autem`, label: `Výlety autem z ${dest.name}`, sub: 'Trasy, tipy a zajímavá místa' },
    { href: `/pujcovna-aut/${dest.slug}/pravidla-provozu`,     label: `Pravidla provozu v ${dest.country}`, sub: 'Limity, předpisy, pokuty' },
    { href: `/pujcovna-aut/${dest.slug}/nejcastejsi-dotazy`,   label: 'Nejčastější dotazy', sub: 'Odpovědi na vaše otázky' },
    { href: `/pocasi/${dest.countrySlug}`,                     label: `Počasí v ${dest.country}`, sub: 'Teploty a srážky podle měsíce' },
    { href: `/destinace/${dest.countrySlug}`,                  label: `Hotely v ${dest.country}`, sub: 'Zájezdy a ubytování' },
  ]

  return (
    <section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-bold text-gray-900 tracking-tight mb-5"
            style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}>
            Půjčovny aut v {dest.country}
          </h2>
          {sameCountry.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {sameCountry.map(d => (
                <Link key={d.slug} href={`/pujcovna-aut/${d.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-[#0093FF] transition-all px-3.5 py-2 rounded-xl glass-card hover:shadow-md border border-transparent hover:border-[#0093FF]/15">
                  {d.name}
                  <ArrowRight className="w-3.5 h-3.5 opacity-40" />
                </Link>
              ))}
            </div>
          )}
          {otherCountry.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-4">Populární světové destinace</p>
              <div className="flex flex-wrap gap-2">
                {otherCountry.map(d => (
                  <Link key={d.slug} href={`/pujcovna-aut/${d.slug}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-[#0093FF] transition-all px-3.5 py-2 rounded-xl glass-card hover:shadow-md border border-transparent hover:border-[#0093FF]/15">
                    {d.name}
                    <ArrowRight className="w-3.5 h-3.5 opacity-40" />
                  </Link>
                ))}
              </div>
            </>
          )}
          <div className="mt-4">
            <Link href="/pujcovna-aut" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0093FF] hover:underline">
              Zobrazit všechny destinace <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 mb-3">Stránky půjčovny</p>
          <div className="space-y-2">
            {subpageLinks.map(({ href, label, sub }) => (
              <Link key={href} href={href}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#f9fafb] border border-gray-100 hover:border-[#0093FF]/20 hover:bg-[#f0f7ff] transition-all group">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 text-sm group-hover:text-[#0093FF] transition-colors leading-tight">{label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#0093FF] transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
