import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import { CarRentalProvider, CarRentalForm, CarRentalResults } from '@/components/CarRentalSearchForm'
import { CAR_DESTINATIONS, buildDCHubUrl, mergeDestinations } from '@/lib/carRental'
import { fetchDestinationPhoto, fetchDynamicCarDestinations, fetchCarRentalAI } from '@/lib/api'
import { Car, Shield, BadgeCheck, Clock, ChevronRight, MapPin } from 'lucide-react'

export const revalidate = 86400

const year = new Date().getFullYear()

export const metadata: Metadata = {
  title: `Půjčovna aut v zahraničí ${year} – Srovnání cen`,
  description:
    `Porovnejte ceny půjčoven aut ve více než 20 destinacích – Řecko, Turecko, Chorvatsko, Španělsko a další. ` +
    `Vyberte si auto od ${year} snadno a rychle s garancí nejlepší ceny.`,
  alternates: { canonical: 'https://zaleto.cz/pujcovna-aut' },
  openGraph: {
    title: `Půjčovna aut v zahraničí ${year}`,
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

  // Fetch AI data for all destinations in parallel, filter to those with full content
  const aiResults = await Promise.all(allDests.map(d => fetchCarRentalAI(d.slug).catch(() => null)))
  const aiCompleteDests = allDests.filter((_, i) => {
    const ai = aiResults[i]
    return ai?.airport_info && ai?.monthly_prices?.length === 12 &&
      ai?.trip_tips?.length > 0 && ai?.driving_rules && ai?.faq?.length > 0
  })

  const destPhotos = await Promise.all(
    aiCompleteDests.map(d => fetchDestinationPhoto(d.slug).catch(() => null))
  )
  const destPhotoMap = Object.fromEntries(aiCompleteDests.map((d, i) => [d.slug, destPhotos[i]]))

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
            background: 'linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,0.90) 38%, rgba(255,255,255,0.55) 65%, rgba(255,255,255,0.0) 100%)'
          }} />
          <div className="absolute inset-x-0 bottom-0 h-40" style={{
            background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.6) 55%, transparent 100%)'
          }} />

          <div className="relative max-w-[1680px] mx-auto px-4 sm:px-10 pt-8 pb-12">
            <nav className="flex items-center gap-1 text-xs text-gray-400 mb-5">
              <Link href="/" className="hover:text-[#0093FF] transition-colors">Zaleto</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-gray-700 font-medium">Půjčovna aut</span>
            </nav>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0093FF] uppercase tracking-[0.12em] mb-3">
              <Car className="w-3.5 h-3.5 flex-shrink-0" />
              Nejlepší český srovnávač půjčoven aut
            </p>
            <h1
              className="font-bold text-gray-900 leading-tight tracking-tight mb-3"
              style={{ fontSize: 'clamp(26px, 4.5vw, 52px)' }}
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

          {/* ── Destinations ────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-[#0093FF]" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#0093FF' }}>
                Destinace
              </p>
            </div>
            <h2
              className="font-bold text-gray-900 tracking-tight mb-6"
              style={{ fontSize: 'clamp(22px, 3vw, 36px)' }}
            >
              Kde si půjčit auto?
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {aiCompleteDests.map(dest => {
                const photo = destPhotoMap[dest.slug]
                return (
                  <Link
                    key={dest.slug}
                    href={`/pujcovna-aut/${dest.slug}`}
                    className="group relative block rounded-2xl overflow-hidden bg-gray-100"
                    style={{ aspectRatio: '4/3' }}
                  >
                    {photo ? (
                      <Image
                        src={photo}
                        alt={dest.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-sky-300 to-blue-500" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                      <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-0.5 leading-none">{dest.country}</p>
                      <p className="text-white font-bold text-[15px] sm:text-base leading-tight tracking-tight">{dest.name}</p>
                    </div>
                  </Link>
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
                style={{ fontSize: 'clamp(22px, 3vw, 36px)' }}
              >
                Rezervace ve 3 krocích
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map(s => (
                <div key={s.n} className="glass-card rounded-2xl p-7 relative overflow-hidden">
                  <div
                    className="absolute top-4 right-4 font-black text-5xl leading-none select-none"
                    style={{ color: 'rgba(0,147,255,0.07)',  }}
                  >
                    {s.n}
                  </div>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 font-bold text-white text-sm"
                    style={{ background: '#0093FF' }}
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
                style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}
              >
                Garance nejlepší ceny a kvality
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {WHY_ITEMS.map(item => (
                <div key={item.title} className="flex gap-4">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white"
                    style={{ background: '#0093FF' }}
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
