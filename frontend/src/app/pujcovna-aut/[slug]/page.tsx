import type { Metadata } from 'next'
import type { ReactNode } from 'react'
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

  const relatedDests = getRelatedDestinations(params.slug, allDests, 8)
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
      { '@type': 'HowToStep', position: 4, name: 'Vyzvedněte auto', text: 'Přijďte na místo vyzvednutí s řidičákem, pasem a platební kartou.' },
    ],
  }

  const faqSchema = aiData?.faq?.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: aiData.faq.map(f => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  } : null

  const displayPhoto = heroPhoto ?? '/img/header-car.jpg'
  const introParagraphs = aiData?.intro?.split('\n\n').filter(Boolean) ?? []

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={howToSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <Header />

      {/* ── Hero — always full-width dark cinematic ── */}
      <div className="relative h-[420px] sm:h-[560px] overflow-hidden">
        <Image
          src={displayPhoto}
          alt={`Půjčovna aut ${dest.name} ${year}`}
          fill
          className="object-cover"
          style={{ filter: 'brightness(0.82) saturate(1.15)' }}
          priority
        />
        {/* Dark cinematic gradient */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to top, rgba(8,12,28,0.90) 0%, rgba(8,12,28,0.50) 45%, rgba(8,12,28,0.15) 100%)'
        }} />

        {/* Breadcrumb — top */}
        <div className="absolute inset-x-0 top-0 pt-5 max-w-[1680px] mx-auto px-4 sm:px-10 w-full">
          <nav className="flex items-center gap-1.5 text-xs text-white/55">
            <Link href="/" className="hover:text-white transition-colors">Zaleto</Link>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <Link href="/pujcovna-aut" className="hover:text-white transition-colors">Půjčovna aut</Link>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <span className="text-white/80 font-medium">{dest.name}</span>
          </nav>
        </div>

        {/* Title + nav — bottom */}
        <div className="absolute inset-x-0 bottom-0 pb-8 sm:pb-10 max-w-[1680px] mx-auto px-4 sm:px-10 w-full">
          <p className="text-white/55 text-[11px] font-semibold uppercase tracking-[0.22em] mb-3">
            Půjčovna aut · {dest.country}
          </p>
          <h1 className="font-black leading-none tracking-tight mb-5">
            <span className="text-white block" style={{ fontSize: 'clamp(38px, 6vw, 78px)', textShadow: '0 2px 30px rgba(0,0,0,0.6)' }}>
              {dest.name}
            </span>
            <span className="text-white/45 font-bold block mt-1.5" style={{ fontSize: 'clamp(14px, 1.6vw, 20px)', letterSpacing: '0.01em' }}>
              Půjčovna aut {year}
            </span>
          </h1>

          {/* Glass nav tabs */}
          {aiData?.intro && (
            <nav className="flex flex-wrap gap-2">
              {aiData.airport_info && <GlassTab href="#letiste" label="Letiště" />}
              {aiData.monthly_prices?.length === 12 && <GlassTab href="#ceny-mesice" label="Ceny dle měsíce" />}
              {aiData.trip_tips?.length > 0 && <GlassTab href={`/pujcovna-aut/${dest.slug}/tipy-na-vylety-autem`} label="Výlety autem" isLink />}
              {aiData.driving_rules && <GlassTab href={`/pujcovna-aut/${dest.slug}/pravidla-provozu`} label="Pravidla provozu" isLink />}
              {aiData.faq?.length > 0 && <GlassTab href={`/pujcovna-aut/${dest.slug}/nejcastejsi-dotazy`} label="FAQ" isLink />}
            </nav>
          )}
        </div>
      </div>

      {/* ── Lead paragraph ── */}
      {introParagraphs.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="max-w-[1680px] mx-auto px-4 sm:px-10 py-7">
            <p className="text-gray-700 text-base sm:text-lg leading-relaxed max-w-[800px]">
              {introParagraphs[0]}
            </p>
            {introParagraphs.length > 1 && (
              <details className="group mt-2">
                <summary className="list-none cursor-pointer select-none">
                  <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0093FF] group-open:hidden">
                    Číst dále
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span className="hidden group-open:inline-flex items-center gap-1 text-[13px] font-semibold text-gray-400">
                    Skrýt
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </summary>
                <div className="mt-4 space-y-3 max-w-[800px]">
                  {introParagraphs.slice(1).map((p, i) => (
                    <p key={i} className="text-gray-600 text-sm sm:text-base leading-relaxed">{p}</p>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* ── Search form band ── */}
      <div style={{ background: 'linear-gradient(135deg, #f0f7ff 0%, #f8faff 100%)' }} className="border-b border-blue-100/70">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-8 py-8 pb-10">
          <CarRentalSearchForm destination={dest} />
        </div>
      </div>

      {/* ── Content: 2-column editorial layout ── */}
      {hasContent && (
        <div className="max-w-[1680px] mx-auto px-4 sm:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 xl:gap-16 items-start">

            {/* ── Left: main content ── */}
            <div className="min-w-0 space-y-14">

              {aiData!.airport_info && (
                <AirportSection airport={aiData!.airport_info} destName={dest.name} />
              )}

              {aiData!.monthly_prices?.length === 12 && (
                <MonthlyPricesSection prices={aiData!.monthly_prices} destName={dest.name} />
              )}

              <PracticalInfoSection aiData={aiData!} country={dest.country} destSlug={dest.slug} />

              {aiData!.trip_tips.length > 0 && (
                <TripTipsSection tips={aiData!.trip_tips} destName={dest.name} destSlug={dest.slug} />
              )}

              {aiData!.practical_tips.length > 0 && (
                <PracticalTipsSection tips={aiData!.practical_tips} destName={dest.name} />
              )}

              {aiData!.faq.length > 0 && (
                <FAQSection faq={aiData!.faq} destName={dest.name} year={year} destSlug={dest.slug} />
              )}

            </div>

            {/* ── Right: sidebar ── */}
            <div className="space-y-5 lg:sticky lg:top-24">

              <PriceSection aiData={aiData!} destName={dest.name} />

              <SubpageLinksCard dest={dest} />

              <RelatedInCountryCard dest={dest} relatedDests={relatedDests} />

            </div>
          </div>

          {/* ── World destinations — full width below grid ── */}
          <RelatedWorldSection relatedDests={relatedDests} dest={dest} />
        </div>
      )}
    </div>
  )
}

// ─── Utility components ────────────────────────────────────────────────────────

function GlassTab({ href, label, isLink }: { href: string; label: string; isLink?: boolean }) {
  const cls = "inline-flex items-center px-4 py-2 rounded-full text-white text-[13px] font-semibold transition-all hover:bg-white/25"
  const style = { background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' }
  return isLink
    ? <Link href={href} className={cls} style={style}>{label}</Link>
    : <a href={href} className={cls} style={style}>{label}</a>
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-[3px] h-4 rounded-full bg-[#0093FF] flex-shrink-0" />
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0093FF]">{children}</p>
    </div>
  )
}

// ─── Section components ────────────────────────────────────────────────────────

function AirportSection({ airport, destName }: { airport: AirportInfo; destName: string }) {
  return (
    <section id="letiste" className="scroll-mt-24">
      <SectionLabel>Letiště</SectionLabel>
      <h2 className="font-bold text-gray-900 tracking-tight mb-5" style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}>
        Letiště {destName}
      </h2>
      <div className="flex flex-col sm:flex-row gap-5 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-[#0093FF] flex items-center justify-center text-white font-black text-xl">
          {airport.iata}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="font-bold text-gray-900 text-base leading-tight">{airport.name}</h3>
            <span className="text-xs font-semibold text-[#0068CC] bg-[#EDF6FF] px-2.5 py-1 rounded-full flex-shrink-0">
              {airport.distance_km} km od centra
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{airport.description}</p>
        </div>
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
    <section id="ceny-mesice" className="scroll-mt-24">
      <SectionLabel>Kdy jet</SectionLabel>
      <h2 className="font-bold text-gray-900 tracking-tight mb-2" style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}>
        Ceny půjčovny aut {destName} podle měsíce
      </h2>
      <p className="text-gray-500 text-sm mb-6 max-w-2xl">
        Orientační přehled cenové hladiny — 100 = roční průměr. Přesné ceny závisí na termínu a kategorii.
      </p>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
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
                <div className="w-full rounded-t-sm transition-opacity hover:opacity-80"
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
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>{MONTHS_CS_SHORT.map(m => <th key={m} className="py-2 px-1 text-center font-semibold text-gray-500 bg-gray-50 border border-gray-100 min-w-[44px]">{m}</th>)}</tr>
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
    <section id="pravidla" className="scroll-mt-24">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <SectionLabel>Praktické informace</SectionLabel>
        <Link href={`/pujcovna-aut/${destSlug}/pravidla-provozu`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0068CC] hover:underline flex-shrink-0">
          Celá stránka <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-6" style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}>
        Pohonné hmoty a pravidla provozu – {country}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {aiData.fuel_info && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 bg-[#0093FF]">
                <Fuel className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-gray-900">Pohonné hmoty – {country}</h3>
            </div>
            {aiData.fuel_info.split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        )}
        {aiData.driving_rules && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 bg-[#0093FF]">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-gray-900">Pravidla silničního provozu – {country}</h3>
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
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      {aiData.price_overview && (
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign className="w-3.5 h-3.5 text-[#0093FF]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0093FF]">Ceny</p>
          </div>
          <h3 className="font-bold text-gray-900 text-base mb-3">Kolik stojí půjčení auta – {destName}?</h3>
          {aiData.price_overview.split('\n\n').filter(Boolean).map((p, i) => (
            <p key={i} className="text-sm text-gray-600 leading-relaxed mb-2 last:mb-0">{p}</p>
          ))}
        </div>
      )}
      {aiData.best_car_types && (
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Car className="w-3.5 h-3.5 text-[#0093FF]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0093FF]">Doporučení</p>
          </div>
          <h3 className="font-bold text-gray-900 text-base mb-3">Jaké auto si vybrat – {destName}?</h3>
          {aiData.best_car_types.split('\n\n').filter(Boolean).map((p, i) => (
            <p key={i} className="text-sm text-gray-600 leading-relaxed mb-2 last:mb-0">{p}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function TripTipsSection({ tips, destName, destSlug }: { tips: CarRentalTripTip[]; destName: string; destSlug: string }) {
  const preview = tips.slice(0, 3)
  const hasMore = tips.length > 3
  return (
    <section id="vylety" className="scroll-mt-24">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <SectionLabel>Výlety autem</SectionLabel>
        <Link href={`/pujcovna-aut/${destSlug}/tipy-na-vylety-autem`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0068CC] hover:underline flex-shrink-0">
          Všechny výlety ({tips.length}) <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-6" style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}>
        Tipy na výlety autem – {destName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {preview.map((tip, i) => (
          <article key={i} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {tip.distance_km && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0068CC] bg-[#EDF6FF] px-2.5 py-1 rounded-full">
                  <MapPin className="w-3 h-3" /> {tip.distance_km} km
                </span>
              )}
              {tip.duration_h && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                  <Clock className="w-3 h-3" /> {tip.duration_h} h
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 leading-tight">{tip.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed flex-1">{tip.description}</p>
          </article>
        ))}
      </div>
      {hasMore && (
        <div className="mt-5">
          <Link href={`/pujcovna-aut/${destSlug}/tipy-na-vylety-autem`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0093FF] bg-[#EDF6FF] hover:bg-[#0093FF]/15 px-5 py-2.5 rounded-full transition-colors">
            Zobrazit všechny výlety <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  )
}

function PracticalTipsSection({ tips, destName }: { tips: string[]; destName: string }) {
  return (
    <section id="tipy" className="scroll-mt-24">
      <SectionLabel>Tipy a rady</SectionLabel>
      <h2 className="font-bold text-gray-900 tracking-tight mb-6" style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}>
        Praktické tipy – půjčovna aut {destName}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-[#EDF6FF] flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0093FF]" />
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FAQSection({ faq, destName, year, destSlug }: { faq: CarRentalFAQ[]; destName: string; year: number; destSlug: string }) {
  const preview = faq.slice(0, 5)
  const hasMore = faq.length > 5
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <SectionLabel>Časté dotazy</SectionLabel>
        <Link href={`/pujcovna-aut/${destSlug}/nejcastejsi-dotazy`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0068CC] hover:underline flex-shrink-0">
          Všechny dotazy ({faq.length}) <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <h2 className="font-bold text-gray-900 tracking-tight mb-5" style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}>
        Nejčastější dotazy – půjčovna aut {destName} {year}
      </h2>
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100 max-w-3xl">
        {preview.map((item, i) => (
          <details key={i} className="group">
            <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none font-semibold text-gray-800 hover:text-[#0093FF] transition-colors select-none text-sm">
              <span>{item.question}</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform duration-200 group-open:rotate-90 text-gray-300 group-hover:text-[#0093FF]" />
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
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0093FF] bg-[#EDF6FF] hover:bg-[#0093FF]/15 px-5 py-2.5 rounded-full transition-colors">
            Zobrazit všechny otázky <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  )
}

// ─── Sidebar components ────────────────────────────────────────────────────────

function SubpageLinksCard({ dest }: { dest: ReturnType<typeof getCarDestination> & {} }) {
  const links = [
    { href: `/pujcovna-aut/${dest.slug}/tipy-na-vylety-autem`, label: `Výlety autem – ${dest.name}`, sub: 'Trasy a zajímavá místa' },
    { href: `/pujcovna-aut/${dest.slug}/pravidla-provozu`,     label: `Pravidla provozu – ${dest.country}`, sub: 'Limity, předpisy, pokuty' },
    { href: `/pujcovna-aut/${dest.slug}/nejcastejsi-dotazy`,   label: 'Nejčastější dotazy', sub: 'Odpovědi na vaše otázky' },
    { href: `/pocasi/${dest.countrySlug}`,                     label: `Počasí – ${dest.country}`, sub: 'Teploty a srážky měsíčně' },
    { href: `/destinace/${dest.countrySlug}`,                  label: `Hotely – ${dest.country}`, sub: 'Zájezdy a ubytování' },
  ]
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-2 border-b border-gray-50">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Stránky půjčovny</p>
      </div>
      <div className="divide-y divide-gray-50">
        {links.map(({ href, label, sub }) => (
          <Link key={href} href={href}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#f8faff] transition-colors group">
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 text-sm group-hover:text-[#0093FF] transition-colors leading-tight truncate">{label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-[#0093FF] transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function RelatedInCountryCard({ dest, relatedDests }: {
  dest: ReturnType<typeof getCarDestination> & {}
  relatedDests: ReturnType<typeof getRelatedDestinations>
}) {
  const sameCountry = relatedDests.filter(d => d.country === dest.country).slice(0, 6)
  if (!sameCountry.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 mb-3">
        Půjčovny aut – {dest.country}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sameCountry.map(d => (
          <Link key={d.slug} href={`/pujcovna-aut/${d.slug}`}
            className="text-sm font-semibold text-gray-700 hover:text-[#0093FF] bg-gray-50 hover:bg-[#EDF6FF] px-3 py-1.5 rounded-full transition-colors">
            {d.name}
          </Link>
        ))}
      </div>
      <Link href="/pujcovna-aut" className="inline-flex items-center gap-1 text-xs font-semibold text-[#0093FF] hover:underline mt-3">
        Všechny destinace <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  )
}

function RelatedWorldSection({ relatedDests, dest }: {
  relatedDests: ReturnType<typeof getRelatedDestinations>
  dest: ReturnType<typeof getCarDestination> & {}
}) {
  const world = relatedDests.filter(d => d.country !== dest.country)
  if (!world.length) return null
  return (
    <div className="mt-16 pt-10 border-t border-gray-100">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-4">Populární světové destinace</p>
      <div className="flex flex-wrap gap-2">
        {world.map(d => (
          <Link key={d.slug} href={`/pujcovna-aut/${d.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-[#0093FF] bg-white border border-gray-100 hover:border-[#0093FF]/25 px-4 py-2 rounded-xl shadow-sm transition-all">
            {d.name}
            <ArrowRight className="w-3.5 h-3.5 opacity-30" />
          </Link>
        ))}
      </div>
    </div>
  )
}
