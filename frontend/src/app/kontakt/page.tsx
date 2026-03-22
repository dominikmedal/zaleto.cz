import type { Metadata } from 'next'
import Header from '@/components/Header'
import Link from 'next/link'
import JsonLd from '@/components/JsonLd'
import { PiEnvelope, PiBuildings, PiQuestion, PiArrowRight } from 'react-icons/pi'

export const metadata: Metadata = {
  title: 'Kontakt',
  description: 'Kontaktujte tým Zaleto. Napište nám na info@zaleto.cz. Odpovíme do 24 hodin. Zaleto — srovnávač leteckých zájezdů od předních cestovních kanceláří.',
  alternates: { canonical: 'https://zaleto.cz/kontakt' },
  openGraph: {
    title: 'Kontakt | Zaleto',
    description: 'Máte dotaz? Napište nám na info@zaleto.cz. Rádi vám pomůžeme najít tu nejlepší dovolenou.',
    url: 'https://zaleto.cz/kontakt',
    type: 'website',
  },
}

const contactSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Bc. Dominik Medal',
  jobTitle: 'Provozovatel Zaleto',
  email: 'info@zaleto.cz',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Majerského 2032/9, Praha 4 - Chodov, 149 00',
    addressCountry: 'CZ',
  },
  worksFor: {
    '@type': 'Organization',
    name: 'Zaleto',
    url: 'https://zaleto.cz',
  },
}

export default function KontaktPage() {
  return (
    <div className="min-h-screen">
      <JsonLd data={contactSchema} />
      <Header />
      <main className="max-w-4xl mx-auto px-6 sm:px-8 py-12">

        <div className="mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Pomoc & Podpora</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Kontakt</h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-xl">
            Máte dotaz nebo potřebujete pomoc? Rádi vám pomůžeme najít tu nejlepší dovolenou.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">

          <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center hover:border-[#008afe]/25 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#008afe]/10 flex items-center justify-center mb-4">
              <PiEnvelope className="w-6 h-6 text-[#008afe]" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-2">Podpora Zaleto</h2>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">Napište nám email a odpovíme do 24 hodin.</p>
            <a
              href="mailto:info@zaleto.cz?subject=Dotaz ohledně Zaleto"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#008afe] hover:text-[#0079e5] transition-colors"
            >
              <PiEnvelope className="w-3.5 h-3.5" />
              info@zaleto.cz
            </a>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center hover:border-[#008afe]/25 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#008afe]/10 flex items-center justify-center mb-4">
              <PiBuildings className="w-6 h-6 text-[#008afe]" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-3">Fakturační údaje</h2>
            <address className="not-italic text-sm text-gray-500 leading-relaxed space-y-0.5 text-center">
              <p className="font-semibold text-gray-800">Bc. Dominik Medal</p>
              <p>Majerského 2032/9, Praha 4 - Chodov, 149 00</p>
              <p className="pt-1"><strong className="text-gray-700">IČO:</strong> 17271541</p>
              <p className="text-xs text-gray-400 pt-2">Zapsán v živnostenském rejstříku v&nbsp;Praze.<br />Nejsem plátce DPH.</p>
            </address>
          </div>

          <Link
            href="/faq"
            className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center hover:border-[#008afe]/25 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#008afe]/10 flex items-center justify-center mb-4">
              <PiQuestion className="w-6 h-6 text-[#008afe]" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-2">Časté otázky</h2>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">Odpovědi na nejčastější dotazy o Zaleto.</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#008afe] group-hover:gap-2.5 transition-all">
              Zobrazit FAQ <PiArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>

        <div className="rounded-2xl bg-gray-50 border border-gray-100 px-6 py-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            <strong className="text-gray-700">Poznámka:</strong> Zaleto je srovnávač zájezdů — rezervace se provádějí přímo u cestovních kanceláří.
            Pro dotazy k již provedené rezervaci se obracejte přímo na příslušnou CK.
          </p>
        </div>
      </main>
    </div>
  )
}
