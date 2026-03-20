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
    icon: <PiMagnifyingGlass className="w-5 h-5 text-[#008afe]" />,
    title: 'Vyhledávání na jednom místě',
    desc: 'Prohledáme nabídky předních českých cestovních kanceláří najednou. Nemusíte procházet desítky webů.',
  },
  {
    icon: <PiArrowsLeftRight className="w-5 h-5 text-[#008afe]" />,
    title: 'Srovnání cen a termínů',
    desc: 'U každého hotelu vidíte všechny dostupné termíny, délky pobytu a varianty stravování seřazené od nejlevnějšího.',
  },
  {
    icon: <PiShieldCheck className="w-5 h-5 text-[#008afe]" />,
    title: 'Rezervace přímo u CK',
    desc: 'Nezprostředkováváme platby ani data. Kliknutím na Rezervovat vás přesměrujeme přímo na stránky cestovní kanceláře.',
  },
  {
    icon: <PiClock className="w-5 h-5 text-[#008afe]" />,
    title: 'Aktuální data',
    desc: 'Ceny a dostupnost termínů pravidelně stahujeme přímo ze zdrojů CK, aby byly výsledky co nejpřesnější.',
  },
]

export default function OZaletoPage() {
  return (
    <div className="min-h-screen">
      <JsonLd data={websiteSchema} />
      <Header />
      <main className="max-w-4xl mx-auto px-6 sm:px-8 py-12">

        <div className="mb-12 flex items-start justify-between gap-8">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">O projektu</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Co je Zaleto?</h1>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {features.map(f => (
            <div key={f.title} className="bg-white border border-gray-100 rounded-2xl p-6 hover:border-[#008afe]/20 hover:shadow-sm transition-all">
              <div className="w-9 h-9 rounded-xl bg-[#008afe]/8 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h2 className="text-[15px] font-semibold text-gray-900 mb-2">{f.title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Jak to funguje?</h2>
          <ol className="space-y-5">
            {[
              { n: '1', t: 'Zadejte destinaci a termín', d: 'Vyhledejte zájezd podle destinace, data odjezdu, počtu nocí nebo stravování.' },
              { n: '2', t: 'Porovnejte výsledky', d: 'Procházejte hotely v mřížce, seznamu nebo na mapě. U každého vidíte ceny od více CK.' },
              { n: '3', t: 'Otevřete detail hotelu', d: 'Prohlédněte si fotky, vybavení, recenze a všechny dostupné termíny s cenami.' },
              { n: '4', t: 'Rezervujte přímo u CK', d: 'Klikněte na Rezervovat — přesměrujeme vás na web CK, kde bezpečně dokončíte rezervaci.' },
            ].map(step => (
              <li key={step.n} className="flex items-start gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#008afe] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {step.n}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-gray-900 mb-0.5">{step.t}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/" className="inline-flex items-center gap-2 bg-[#008afe] hover:bg-[#0079e5] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
            Hledat zájezdy <PiArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/kontakt" className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-[#008afe]/40 text-gray-700 text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
            Kontakt
          </Link>
        </div>
      </main>
    </div>
  )
}
