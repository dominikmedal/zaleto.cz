import type { Metadata } from 'next'
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
import {
  Car, ChevronRight, Fuel, BookOpen, CircleDollarSign, MapPin,
  MessageCircleQuestion, Route, Clock, CheckCircle2, ArrowLeft, ArrowRight,
} from 'lucide-react'

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
  if (!isValidSection(params.section)) return { title: 'Půjčovna aut | Zaleto' }

  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  const dest = getCarDestination(params.slug, mergeDestinations(dynamic))
  if (!dest) return { title: 'Půjčovna aut | Zaleto' }

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
    <div className="min-h-screen">
      <JsonLd data={breadcrumbSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      {tripItemListSchema && <JsonLd data={tripItemListSchema} />}
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="max-w-[1680px] mx-auto px-4 sm:px-10 pt-8 pb-4">
        <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-4">
          <Link href="/" className="hover:text-[#0093FF] transition-colors">Zaleto</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/pujcovna-aut" className="hover:text-[#0093FF] transition-colors">Půjčovna aut</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/pujcovna-aut/${dest.slug}`} className="hover:text-[#0093FF] transition-colors">
            {dest.name}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-700 font-medium">{sectionLabel(section)}</span>
        </nav>

        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0093FF] uppercase tracking-[0.12em] mb-3">
          <Car className="w-3.5 h-3.5 flex-shrink-0" />
          Půjčovna aut · {dest.country}
        </p>

        <h1
          className="font-bold text-gray-900 leading-tight tracking-tight mb-4"
          style={{ fontSize: 'clamp(24px, 4vw, 48px)' }}
        >
          {SECTION_META[section].heading(dest.name, dest.country, year)}
        </h1>

        {/* Cross-links to sibling sub-pages */}
        <nav aria-label="Další sekce" className="flex flex-wrap gap-2 mb-6">
          <Link href={`/pujcovna-aut/${dest.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#0093FF] glass-pill px-3 py-1.5 rounded-full transition-colors">
            <ArrowLeft className="w-3 h-3" /> Přehled {dest.name}
          </Link>
          {otherSections.map(s => (
            <Link key={s} href={`/pujcovna-aut/${dest.slug}/${s}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#0093FF] glass-pill px-3 py-1.5 rounded-full transition-colors">
              {sectionIcon(s)}
              {sectionLabel(s)}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <main className="max-w-[1680px] mx-auto px-4 sm:px-8 pb-16">
        {section === 'tipy-na-vylety-autem' && aiData?.trip_tips && (
          <TripTipsFullPage tips={aiData.trip_tips} destName={dest.name} />
        )}
        {section === 'pravidla-provozu' && aiData && (
          <DrivingRulesFullPage aiData={aiData} country={dest.country} />
        )}
        {section === 'nejcastejsi-dotazy' && aiData?.faq && (
          <FAQFullPage faq={aiData.faq} destName={dest.name} year={year} />
        )}

        {/* ── CTA: search form ──────────────────────────────────────────────── */}
        <div className="mt-14 pt-10 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign className="w-4 h-4 text-[#0093FF]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Rezervace</p>
          </div>
          <h2 className="font-bold text-gray-900 tracking-tight mb-6"
            style={{ fontSize: 'clamp(20px, 2.8vw, 34px)' }}>
            Půjčit auto – {dest.name}
          </h2>
          <CarRentalSearchForm destination={dest} />
        </div>

        {/* ── Back link ─────────────────────────────────────────────────────── */}
        <div className="mt-10 flex items-center gap-3">
          <Link href={`/pujcovna-aut/${dest.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0093FF] glass-pill px-4 py-2 rounded-full hover:bg-[#0093FF]/10 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Zpět na přehled půjčovny aut {dest.name}
          </Link>
        </div>
      </main>
    </div>
  )
}

// ─── Helper functions ──────────────────────────────────────────────────────────

function sectionLabel(s: Section): string {
  switch (s) {
    case 'tipy-na-vylety-autem': return 'Výlety autem'
    case 'pravidla-provozu':     return 'Pravidla provozu'
    case 'nejcastejsi-dotazy':   return 'Časté dotazy'
  }
}

function sectionIcon(s: Section) {
  switch (s) {
    case 'tipy-na-vylety-autem': return <Route className="w-3 h-3" />
    case 'pravidla-provozu':     return <BookOpen className="w-3 h-3" />
    case 'nejcastejsi-dotazy':   return <MessageCircleQuestion className="w-3 h-3" />
  }
}

// ─── Section components ────────────────────────────────────────────────────────

function TripTipsFullPage({ tips, destName }: { tips: CarRentalTripTip[]; destName: string }) {
  return (
    <div className="space-y-10">
      <p className="text-gray-500 text-sm max-w-2xl">
        Prozkoumejte {destName} a okolí za volantem. Níže najdete {tips.length} tipů na výlety
        s orientačními vzdálenostmi a dobami jízdy.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tips.map((tip, i) => (
          <article key={i} className="glass-card rounded-2xl p-5 relative overflow-hidden flex flex-col gap-3">
            <div className="absolute top-3 right-3 font-black text-5xl leading-none select-none"
              style={{ color: 'rgba(0,147,255,0.05)',  }}>
              {i + 1}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {tip.distance_km && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0068CC] glass-pill px-2 py-0.5 rounded-full">
                  <MapPin className="w-3 h-3" /> {tip.distance_km} km
                </span>
              )}
              {tip.duration_h && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 glass-pill px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> {tip.duration_h} h
                </span>
              )}
            </div>
            <h2 className="font-bold text-gray-900 leading-tight text-base">{tip.title}</h2>
            <p className="text-sm text-gray-500 leading-relaxed flex-1">{tip.description}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function DrivingRulesFullPage({ aiData, country }: { aiData: CarRentalAIData; country: string }) {
  return (
    <div className="space-y-10 max-w-3xl">
      {aiData.fuel_info && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Fuel className="w-4 h-4 text-[#0093FF]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Pohonné hmoty</p>
          </div>
          <h2 className="font-bold text-gray-900 tracking-tight mb-5"
            style={{ fontSize: 'clamp(20px, 2.5vw, 30px)' }}>
            Pohonné hmoty v {country}
          </h2>
          <div className="glass-card rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)' }}>
                <Fuel className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Ceny paliva a typy pohonných hmot</h3>
            </div>
            {aiData.fuel_info.split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-4 last:mb-0">{p}</p>
            ))}
          </div>
        </section>
      )}

      {aiData.driving_rules && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-[#0093FF]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Dopravní předpisy</p>
          </div>
          <h2 className="font-bold text-gray-900 tracking-tight mb-5"
            style={{ fontSize: 'clamp(20px, 2.5vw, 30px)' }}>
            Silniční pravidla v {country}
          </h2>
          <div className="glass-card rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)' }}>
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Dopravní předpisy a omezení</h3>
            </div>
            {aiData.driving_rules.split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-4 last:mb-0">{p}</p>
            ))}
          </div>
        </section>
      )}

      {aiData.practical_tips?.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-[#0093FF]" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>Tipy</p>
          </div>
          <h2 className="font-bold text-gray-900 tracking-tight mb-5"
            style={{ fontSize: 'clamp(20px, 2.5vw, 30px)' }}>
            Praktické rady před cestou
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {aiData.practical_tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#0093FF] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function FAQFullPage({ faq, destName, year }: { faq: CarRentalFAQ[]; destName: string; year: number }) {
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-gray-500 text-sm mb-6">
        Odpovědi na {faq.length} nejčastějších otázek o půjčování aut v {destName}.
      </p>
      {faq.map((item, i) => (
        <details key={i} className="glass-card rounded-2xl overflow-hidden group">
          <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-semibold text-gray-900 hover:text-[#0093FF] transition-colors select-none">
            <span>{item.question}</span>
            <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-90 text-gray-400" />
          </summary>
          <div className="px-5 pb-5">
            <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
