import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import { CarRentalProvider, CarRentalForm, CarRentalResults } from '@/components/CarRentalSearchForm'
import { CAR_DESTINATIONS, buildDCHubUrl, mergeDestinations } from '@/lib/carRental'
import { fetchDestinationPhoto, fetchDynamicCarDestinations } from '@/lib/api'
import { Car, Shield, BadgeCheck, Clock, ChevronRight, MapPin } from 'lucide-react'

export const revalidate = 86400

const year = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Půjčovna aut v zahraničí ${year} – Srovnání cen | Zaleto`,
  description:
    `Porovnejte ceny půjčoven aut ve více než 20 destinacích – Řecko, Turecko, Chorvatsko, Španělsko a další. ` +
    `Vyberte si auto od ${year} snadno a rychle s garancí nejlepší ceny.`,
  alternates: { canonical: 'https://zaleto.cz/pujcovna-aut' },
  openGraph: {
    title: `Půjčovna aut v zahraničí ${year} | Zaleto`,
    description: 'Srovnejte ceny půjčoven aut ve více než 20 populárních destinacích. Bez skrytých poplatků.',
    url: 'https://zaleto.cz/pujcovna-aut',
    type: 'website',
    siteName: 'Zaleto',
    locale: 'cs_CZ',
  },
  twitter: { card: 'summary_large_image' },
}

const WHY_ITEMS = [
  {
    icon: <BadgeCheck className="w-5 h-5" />,
    title: 'Garantovaná cena',
    text: 'Cena zobrazená při rezervaci je finální. Žádné skryté poplatky na přepážce.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Pojištění v ceně',
    text: 'Základní pojištění CDW i TP je automaticky zahrnuté, bez nutnosti doplatku.',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'Zdarma zrušení',
    text: 'Většina nabídek umožňuje bezplatné storno až 48 hodin před vyzvednutím.',
  },
  {
    icon: <Car className="w-5 h-5" />,
    title: 'Přes 500 půjčoven',
    text: 'Srovnáváme nabídky Hertz, Europcar, Sixt, lokálních i malých půjčoven.',
  },
]

const STEPS = [
  { n: '01', title: 'Vyberte destinaci', text: 'Klikněte na destinaci níže nebo použijte vyhledávací formulář.' },
  { n: '02', title: 'Porovnejte nabídky', text: 'Na DiscoverCars.com uvidíte seřazené nabídky s fotografiemi aut a porovnáním cen.' },
  { n: '03', title: 'Rezervujte online', text: 'Rezervace je okamžitá a bezpečná. Platební karta jako záloha na přepážce.' },
]

const webPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `Půjčovna aut v zahraničí ${year}`,
  description: 'Srovnávač cen půjčoven aut v populárních turistických destinacích.',
  url: 'https://zaleto.cz/pujcovna-aut',
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
      { '@type': 'ListItem', position: 2, name: 'Půjčovna aut', item: 'https://zaleto.cz/pujcovna-aut' },
    ],
  },
}

export default async function PujcovnaAutPage() {
  const dynamicDests = await fetchDynamicCarDestinations().catch(() => [])
  const allDests = mergeDestinations(dynamicDests)

  // Stable insertion-order list of countries from merged list
  const COUNTRIES = Array.from(new Map(allDests.map(d => [d.country, d])).keys())
  const destsByCountry = allDests.reduce<Record<string, typeof allDests>>((acc, d) => {
    if (!acc[d.country]) acc[d.country] = []
    acc[d.country].push(d)
    return acc
  }, {})

  const photos = await Promise.all(
    COUNTRIES.map(country => fetchDestinationPhoto(country).catch(() => null))
  )
  const countryPhoto = Object.fromEntries(COUNTRIES.map((c, i) => [c, photos[i]]))

  return (
    <div className="min-h-screen">
      <JsonLd data={webPageSchema} />
      <Header />

      <CarRentalProvider>

        {/* ── Hero + search form ──────────────────────────────────────────── */}
        <div className="relative min-h-[420px] sm:min-h-[520px]">
          <Image
            src="/img/header-car.jpg"
            alt="Půjčovna aut v zahraničí"
            fill
            className="object-cover"
            style={{ filter: 'brightness(1.05) saturate(1.1)' }}
            priority
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to right, rgba(245,250,255,1) 0%, rgba(245,250,255,0.92) 38%, rgba(245,250,255,0.65) 65%, rgba(245,250,255,0.0) 100%)'
          }} />
          <div className="absolute inset-x-0 bottom-0 h-40" style={{
            background: 'linear-gradient(to top, rgba(245,250,255,1) 0%, rgba(245,250,255,0.6) 55%, transparent 100%)'
          }} />

          <div className="relative max-w-[1680px] mx-auto px-4 sm:px-10 pt-8 pb-12">
            <nav className="flex items-center gap-1 text-xs text-gray-400 mb-5">
              <Link href="/" className="hover:text-[#0093FF] transition-colors">Zaleto</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-700 font-medium">Půjčovna aut</span>
            </nav>
            <div className="inline-flex items-center gap-2 glass-pill rounded-full px-3 py-1.5 text-xs font-semibold text-[#0068CC] mb-3">
              <Car className="w-3.5 h-3.5" />
              Nejlepší český srovnávač půjčoven aut
            </div>
            <h1
              className="font-bold text-gray-900 leading-tight tracking-tight mb-3"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(26px, 4.5vw, 52px)' }}
            >
              Půjčovna aut v zahraničí
            </h1>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed max-w-xl mb-8">
              Porovnejte ceny více než <strong className="text-gray-800">500 půjčoven aut</strong> —
              Řecko, Turecko, Chorvatsko a desítky dalších destinací.
            </p>
            <CarRentalForm />
          </div>
        </div>

        <main className="max-w-[1680px] mx-auto px-4 sm:px-8 py-8 sm:py-14 space-y-16">

          {/* ── Search results ────────────────────────────────────────────── */}
          <CarRentalResults />

          {/* ── Countries ───────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-[#0093FF]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
                Destinace
              </p>
            </div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-6"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3vw, 36px)' }}
            >
              Kde si půjčit auto?
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {COUNTRIES.map(country => {
                const dests = destsByCountry[country] ?? []
                const photo = countryPhoto[country]
                return (
                  <div key={country} className="glass-card rounded-2xl overflow-hidden flex min-h-[120px]">

                    {/* Photo strip */}
                    <div className="relative w-32 sm:w-40 flex-shrink-0 overflow-hidden bg-gradient-to-br from-sky-100 to-blue-50">
                      {photo && (
                        <Image
                          src={photo}
                          alt={country}
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      )}
                      {/* Right-side fade into card body */}
                      <div className="absolute inset-0" style={{
                        background: 'linear-gradient(to right, transparent 40%, rgba(255,255,255,0.72) 100%)'
                      }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 px-5 py-4 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <h3
                          className="font-bold text-gray-900 leading-tight"
                          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.05rem' }}
                        >
                          {country}
                        </h3>
                        <span
                          className="glass-pill text-[10px] font-bold text-[#0068CC] px-2 py-0.5 rounded-full flex-shrink-0"
                        >
                          {dests.length} dest.
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {dests.map(d => (
                          <Link
                            key={d.slug}
                            href={`/pujcovna-aut/${d.slug}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-[#0093FF] transition-all px-2.5 py-1.5 rounded-xl hover:bg-[#0093FF]/06 border border-transparent hover:border-[#0093FF]/15"
                          >
                            {d.name}
                            <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                          </Link>
                        ))}
                      </div>
                    </div>

                  </div>
                )
              })}
            </div>
          </section>

          {/* ── How it works ──────────────────────────────────────────────── */}
          <section>
            <div className="text-center mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: '#0093FF' }}>
                Jak to funguje
              </p>
              <h2
                className="font-bold text-gray-900 tracking-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3vw, 36px)' }}
              >
                Rezervace ve 3 krocích
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map(s => (
                <div key={s.n} className="glass-card rounded-2xl p-7 relative overflow-hidden">
                  <div
                    className="absolute top-4 right-4 font-black text-5xl leading-none select-none"
                    style={{ color: 'rgba(0,147,255,0.07)', fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {s.n}
                  </div>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 font-bold text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)' }}
                  >
                    {s.n.replace('0', '')}
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Why Discover Cars ─────────────────────────────────────────── */}
          <section className="section-island">
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: '#0093FF' }}>
                Proč objednání auta přes portál Zaleto?
              </p>
              <h2
                className="font-bold text-gray-900 tracking-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.5vw, 32px)' }}
              >
                Garance nejlepší ceny a kvality
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {WHY_ITEMS.map(item => (
                <div key={item.title} className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)' }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm mb-0.5">{item.title}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>

          </section>

        </main>

      </CarRentalProvider>
    </div>
  )
}
