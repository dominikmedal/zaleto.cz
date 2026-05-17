import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import CarRentalSearchForm from '@/components/CarRentalSearchForm'
import {
  getCarDestination,
  mergeDestinations,
} from '@/lib/carRental'
import {
  fetchDestinationPhoto,
  fetchDynamicCarDestinations,
  fetchCarRentalAI,
  type CarRentalAIData,
  type CarExample,
  type CarRentalTripTip,
  type CarRentalFAQ,
} from '@/lib/api'
import { Car, ChevronRight, Fuel, BookOpen, CircleDollarSign, MapPin, MessageCircleQuestion, Star, Users, Briefcase, Zap, Route, Clock, CheckCircle2 } from 'lucide-react'

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

  const year = new Date().getFullYear()
  const title = `Půjčovna aut ${dest.name} ${year} – Aktuální ceny a tipy`
  const description =
    `Půjčte si auto v ${dest.name}. Ceny od předních půjčoven, pravidla silničního provozu, výlety autem a praktické tipy pro ${dest.country}. Garantovaná cena bez skrytých poplatků.`
  const canonical = `https://zaleto.cz/pujcovna-aut/${dest.slug}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `Půjčovna aut ${dest.name} ${year}`,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Zaleto',
      locale: 'cs_CZ',
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}


export default async function PujcovnaAutSlugPage({ params }: Props) {
  const dynamic = await fetchDynamicCarDestinations().catch(() => [])
  const dest = getCarDestination(params.slug, mergeDestinations(dynamic))
  if (!dest) notFound()

  const [heroPhoto, aiData] = await Promise.all([
    fetchDestinationPhoto(dest.name).catch(() => null),
    fetchCarRentalAI(params.slug).catch(() => null),
  ])

  const year = new Date().getFullYear()

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Půjčovna aut', item: 'https://zaleto.cz/pujcovna-aut' },
      { '@type': 'ListItem', position: 3, name: `Půjčovna aut ${dest.name}`, item: `https://zaleto.cz/pujcovna-aut/${dest.slug}` },
    ],
  }

  const faqSchema = aiData?.faq && aiData.faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: aiData.faq.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null

  return (
    <div className="min-h-screen">
      <JsonLd data={breadcrumbSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <Header />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {heroPhoto ? (
        <div className="relative h-[260px] sm:h-[340px]">
          <Image
            src={heroPhoto}
            alt={`Půjčovna aut ${dest.name}`}
            fill
            className="object-cover"
            style={{ filter: 'brightness(1.05) saturate(1.1)' }}
            priority
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, rgba(245,250,255,1) 0%, rgba(245,250,255,0.88) 32%, rgba(245,250,255,0.55) 60%, rgba(245,250,255,0.0) 100%)'
          }} />
          <div className="absolute inset-x-0 bottom-0 h-28" style={{
            background: 'linear-gradient(to top, rgba(245,250,255,1) 0%, rgba(245,250,255,0.5) 60%, transparent 100%)'
          }} />
          <div className="relative h-full flex items-center">
            <div className="max-w-[1680px] mx-auto px-4 sm:px-10 w-full">
              <BreadcrumbNav dest={dest} />
              <HeroTitle dest={dest} year={year} />
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-[1680px] mx-auto px-4 sm:px-10 pt-8 pb-2">
          <BreadcrumbNav dest={dest} />
          <HeroTitle dest={dest} year={year} />
        </div>
      )}

      {/* ── Search form ──────────────────────────────────────────────────── */}
      <section className="max-w-[1680px] mx-auto px-4 sm:px-8 py-8 pb-10">
        <CarRentalSearchForm destination={dest} />
      </section>

      {/* ── AI rich content ──────────────────────────────────────────────── */}
      {aiData?.intro && (
        <main className="max-w-[1680px] mx-auto px-4 sm:px-8 pb-16 space-y-14">

          {/* Intro text */}
          <IntroSection aiData={aiData} destName={dest.name} />

          {/* Car examples grid — SEO */}
          {aiData.car_examples && aiData.car_examples.length > 0 && (
            <CarExamplesSection examples={aiData.car_examples} destName={dest.name} />
          )}

          {/* Practical info: fuel + driving rules */}
          <PracticalInfoSection aiData={aiData} country={dest.country} />

          {/* Price overview + best car types */}
          <PriceSection aiData={aiData} />

          {/* Trip tips */}
          {aiData.trip_tips && aiData.trip_tips.length > 0 && (
            <TripTipsSection tips={aiData.trip_tips} destName={dest.name} />
          )}

          {/* Practical tips checklist */}
          {aiData.practical_tips && aiData.practical_tips.length > 0 && (
            <PracticalTipsSection tips={aiData.practical_tips} destName={dest.name} />
          )}

          {/* FAQ */}
          {aiData.faq && aiData.faq.length > 0 && (
            <FAQSection faq={aiData.faq} destName={dest.name} />
          )}

        </main>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function BreadcrumbNav({ dest }: { dest: ReturnType<typeof getCarDestination> & {} }) {
  return (
    <nav className="flex items-center flex-wrap gap-1 text-xs text-gray-400 mb-4">
      <Link href="/" className="hover:text-[#0093FF] transition-colors">Zaleto</Link>
      <ChevronRight className="w-3 h-3" />
      <Link href="/pujcovna-aut" className="hover:text-[#0093FF] transition-colors">Půjčovna aut</Link>
      <ChevronRight className="w-3 h-3" />
      <span className="text-gray-700 font-medium">{dest.name}</span>
    </nav>
  )
}

function HeroTitle({ dest, year }: { dest: ReturnType<typeof getCarDestination> & {}; year: number }) {
  return (
    <>
      <div className="inline-flex items-center gap-2 glass-pill rounded-full px-3 py-1.5 text-xs font-semibold text-[#0068CC] mb-3">
        <Car className="w-3.5 h-3.5" />
        Půjčovna aut · {dest.country}
      </div>
      <h1
        className="font-bold text-gray-900 leading-tight tracking-tight mb-3"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(26px, 4.5vw, 52px)' }}
      >
        Půjčovna aut {dest.name} {year}
      </h1>
      <p className="text-gray-600 text-sm sm:text-base leading-relaxed max-w-xl">
        Aktuální nabídky půjčoven aut — porovnání cen od více než{' '}
        <strong className="text-gray-800">500 půjčoven</strong>, garantovaná cena bez skrytých poplatků.
      </p>
    </>
  )
}

function IntroSection({ aiData, destName }: { aiData: CarRentalAIData; destName: string }) {
  const paragraphs = aiData.intro?.split('\n\n').filter(Boolean) ?? []
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
          Průvodce
        </p>
      </div>
      <h2
        className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.8vw, 34px)' }}
      >
        Půjčení auta v {destName} – vše, co potřebujete vědět
      </h2>
      <div className="prose prose-gray max-w-none">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-gray-600 leading-relaxed mb-4 text-sm sm:text-base">{p}</p>
        ))}
      </div>
    </section>
  )
}

function CarExamplesSection({ examples, destName }: { examples: CarExample[]; destName: string }) {
  const categoryColor: Record<string, string> = {
    Economy: '#0093FF', Compact: '#00B4A0', SUV: '#7C3AED',
    Minivan: '#D97706', Premium: '#DB2777', Ostatní: '#6B7280',
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Car className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
          Dostupná auta
        </p>
      </div>
      <h2
        className="font-bold text-gray-900 tracking-tight mb-2"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.8vw, 34px)' }}
      >
        Která auta si půjčit v {destName}
      </h2>
      <p className="text-gray-500 text-sm mb-6">
        Orientační přehled kategorií a modelů dostupných v destinaci. Konkrétní nabídky a aktuální ceny zobrazíte zadáním termínu výše.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {examples.map((car, i) => {
          const color = categoryColor[car.category] ?? '#0093FF'
          return (
            <div key={i} className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              {/* Category badge + name */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2"
                    style={{ background: `${color}18`, color }}
                  >
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

              {/* Specs */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {car.seats && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {car.seats} míst
                  </span>
                )}
                {car.bags && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5" /> {car.bags} kuf.
                  </span>
                )}
                {car.transmission && (
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> {car.transmission}
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-gray-500 leading-relaxed">{car.description}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PracticalInfoSection({ aiData, country }: { aiData: CarRentalAIData; country: string }) {
  if (!aiData.fuel_info && !aiData.driving_rules) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Fuel className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
          Praktické informace
        </p>
      </div>
      <h2
        className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.8vw, 34px)' }}
      >
        Pohonné hmoty a pravidla silničního provozu v {country}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {aiData.fuel_info && (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)' }}
              >
                <Fuel className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-gray-900">Pohonné hmoty</h3>
            </div>
            {aiData.fuel_info.split('\n\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-gray-600 leading-relaxed mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        )}
        {aiData.driving_rules && (
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)' }}
              >
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-gray-900">Pravidla silničního provozu</h3>
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

function PriceSection({ aiData }: { aiData: CarRentalAIData }) {
  if (!aiData.price_overview && !aiData.best_car_types) return null

  return (
    <section className="section-island">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {aiData.price_overview && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CircleDollarSign className="w-4 h-4 text-[#0093FF]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
                Ceny
              </p>
            </div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(18px, 2.2vw, 28px)' }}
            >
              Kolik stojí půjčení auta?
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
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
                Doporučení
              </p>
            </div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-4"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(18px, 2.2vw, 28px)' }}
            >
              Jaké auto si vybrat?
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

function TripTipsSection({ tips, destName }: { tips: CarRentalTripTip[]; destName: string }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Route className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
          Výlety autem
        </p>
      </div>
      <h2
        className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.8vw, 34px)' }}
      >
        Tipy na výlety z {destName}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tips.map((tip, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 relative overflow-hidden">
            <div
              className="absolute top-3 right-3 font-black text-4xl leading-none select-none"
              style={{ color: 'rgba(0,147,255,0.06)', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {i + 1}
            </div>
            <div className="flex items-center gap-3 mb-3">
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
            <h3 className="font-bold text-gray-900 mb-2 leading-tight">{tip.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{tip.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function PracticalTipsSection({ tips, destName }: { tips: string[]; destName: string }) {
  return (
    <section className="section-island">
      <div className="flex items-center gap-2 mb-2">
        <Star className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
          Tipy a rady
        </p>
      </div>
      <h2
        className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.8vw, 34px)' }}
      >
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

function FAQSection({ faq, destName }: { faq: CarRentalFAQ[]; destName: string }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <MessageCircleQuestion className="w-4 h-4 text-[#0093FF]" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
          Časté dotazy
        </p>
      </div>
      <h2
        className="font-bold text-gray-900 tracking-tight mb-6"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.8vw, 34px)' }}
      >
        Nejčastější dotazy – půjčovna aut {destName}
      </h2>

      <div className="space-y-4">
        {faq.map((item, i) => (
          <details key={i} className="glass-card rounded-2xl overflow-hidden group">
            <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none font-semibold text-gray-900 hover:text-[#0093FF] transition-colors select-none">
              <span>{item.question}</span>
              <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-90 text-gray-400" />
            </summary>
            <div className="px-6 pb-5">
              <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
