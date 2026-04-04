import type { Metadata } from 'next'
import Header from '@/components/Header'
import Link from 'next/link'
import Image from 'next/image'
import JsonLd from '@/components/JsonLd'
import { PiMagnifyingGlass, PiArrowsLeftRight, PiShieldCheck, PiClock, PiArrowRight } from 'react-icons/pi'

export const metadata: Metadata = {
  title: 'Co je Zaleto?',
  description: 'Zaleto je český srovnávač leteckých zájezdů. Agregujeme nabídky předních cestovních kanceláří na jednom místě. Ušetřete čas a snadno najděte nejlepší dovolenou.',
  alternates: { canonical: 'https://zaleto.cz/o-zaleto' },
  openGraph: {
    title: 'Co je Zaleto? | Srovnávač zájezdů',
    description: 'Zaleto agreguje nabídky leteckých zájezdů od předních českých CK. Porovnejte ceny, termíny a rezervujte přímo u cestovní kanceláře.',
    url: 'https://zaleto.cz/o-zaleto',
    type: 'website',
  },
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Zaleto',
  url: 'https://zaleto.cz',
  description: 'Zaleto je český srovnávač leteckých zájezdů od předních cestovních kanceláří.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://zaleto.cz/?destination={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

const features = [
  {
    Icon: PiMagnifyingGlass,
    title: 'Vyhledávání na jednom místě',
    desc: 'Prohledáme nabídky předních českých cestovních kanceláří najednou. Nemusíte procházet desítky webů.',
  },
  {
    Icon: PiArrowsLeftRight,
    title: 'Srovnání cen a termínů',
    desc: 'U každého hotelu vidíte všechny dostupné termíny, délky pobytu a varianty stravování seřazené od nejlevnějšího.',
  },
  {
    Icon: PiShieldCheck,
    title: 'Rezervace přímo u CK',
    desc: 'Nezprostředkováváme platby ani data. Kliknutím na Rezervovat vás přesměrujeme přímo na stránky cestovní kanceláře.',
  },
  {
    Icon: PiClock,
    title: 'Aktuální data',
    desc: 'Ceny a dostupnost termínů pravidelně stahujeme přímo ze zdrojů CK, aby byly výsledky co nejpřesnější.',
  },
]

const HOW_STEPS = [
  { t: 'Zadejte destinaci a termín', d: 'Vyhledejte zájezd podle destinace, data odjezdu, počtu nocí nebo stravování.' },
  { t: 'Porovnejte výsledky', d: 'Procházejte hotely v mřížce, seznamu nebo na mapě. U každého vidíte ceny od více CK.' },
  { t: 'Otevřete detail hotelu', d: 'Prohlédněte si fotky, vybavení, recenze a všechny dostupné termíny s cenami.' },
  { t: 'Rezervujte přímo u CK', d: 'Klikněte na Rezervovat — přesměrujeme vás na web CK, kde bezpečně dokončíte rezervaci.' },
]

export default function OZaletoPage() {
  return (
    <div className="min-h-screen">
      <JsonLd data={websiteSchema} />
      <Header />
      <main className="max-w-4xl mx-auto px-6 sm:px-8 py-12">

        {/* Hero */}
        <div className="mb-12 flex items-start justify-between gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: '#0093FF' }}>
              O projektu
            </p>
            <h1
              className="font-bold text-gray-900 leading-tight tracking-tight mb-4"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 4.5vw, 52px)' }}
            >
              Co je <em className="not-italic" style={{ color: '#0093FF' }}>Zaleto</em>?
            </h1>
            <p className="text-gray-500 text-base leading-relaxed max-w-xl">
              Zaleto je český vyhledávač zájezdů. Agregujeme nabídky leteckých zájezdů od předních
              cestovních kanceláří a zobrazujeme je přehledně na jednom místě — abyste ušetřili čas
              a snadno našli tu nejlepší dovolenou.
            </p>
          </div>
          <div className="hidden sm:block flex-shrink-0">
            <Image
              src="/img/logo/logo.png"
              alt="Zaleto — srovnávač zájezdů"
              width={130}
              height={44}
              className="h-10 w-auto object-contain opacity-80"
            />
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {features.map(f => (
            <div
              key={f.title}
              className="glass-card rounded-2xl p-6 transition-all hover:shadow-[0_8px_32px_rgba(0,147,255,0.12)]"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,147,255,0.09)' }}
              >
                <f.Icon className="w-5 h-5 text-[#0093FF]" />
              </div>
              <h2 className="text-[15px] font-semibold text-gray-900 mb-2">{f.title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div
          className="rounded-2xl p-8 mb-8"
          style={{
            background: 'rgba(245,248,255,0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(200,227,255,0.65)',
            boxShadow: '0 4px 24px rgba(0,80,200,0.07)',
          }}
        >
          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,147,255,0.09)' }}>
              <PiArrowRight className="w-3.5 h-3.5 text-[#0093FF]" />
            </div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">Jak to funguje?</h2>
          </div>

          <ol className="space-y-5">
            {HOW_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-xl text-white text-xs font-bold flex items-center justify-center mt-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
                    boxShadow: '0 2px 8px rgba(0,147,255,0.28)',
                  }}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-gray-900 mb-0.5">{step.t}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/" className="btn-cta">
            Hledat zájezdy <PiArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/kontakt"
            className="btn-secondary"
          >
            Kontakt
          </Link>
        </div>

      </main>
    </div>
  )
}
