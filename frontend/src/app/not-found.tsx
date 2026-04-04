import type { Metadata } from 'next'
import Header from '@/components/Header'
import Link from 'next/link'
import { PiArrowLeft, PiMagnifyingGlass, PiQuestion, PiEnvelope } from 'react-icons/pi'

export const metadata: Metadata = {
  title: '404 – Stránka nenalezena',
  description: 'Stránka, kterou hledáte, neexistuje nebo byla přesunuta. Vraťte se na úvodní stránku Zaleto.',
  robots: { index: false, follow: false },
}

export default function NotFoundPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-6 sm:px-8 py-12">

        <div className="mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Chyba 404</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Stránka nenalezena</h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-xl">
            Stránka, kterou hledáte, neexistuje nebo byla přesunuta. Zkuste se vrátit zpět nebo využijte
            vyhledávání zájezdů.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">

          <Link
            href="/"
            className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center hover:border-[#008afe]/25 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#008afe]/10 flex items-center justify-center mb-4">
              <PiMagnifyingGlass className="w-6 h-6 text-[#008afe]" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-2">Hledat zájezdy</h2>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">Prohledejte nabídky leteckých zájezdů od předních českých CK.</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#008afe] group-hover:gap-2.5 transition-all">
              Přejít na úvod <PiArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </span>
          </Link>

          <Link
            href="/faq"
            className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center hover:border-[#008afe]/25 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#008afe]/10 flex items-center justify-center mb-4">
              <PiQuestion className="w-6 h-6 text-[#008afe]" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-2">Časté otázky</h2>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">Odpovědi na nejčastější dotazy o Zaleto a vyhledávání zájezdů.</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#008afe] group-hover:gap-2.5 transition-all">
              Zobrazit FAQ <PiArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </span>
          </Link>

          <Link
            href="/kontakt"
            className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center text-center hover:border-[#008afe]/25 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#008afe]/10 flex items-center justify-center mb-4">
              <PiEnvelope className="w-6 h-6 text-[#008afe]" />
            </div>
            <h2 className="text-[15px] font-semibold text-gray-900 mb-2">Kontakt</h2>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">Nefunguje něco? Napište nám a rádi pomůžeme.</p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#008afe] group-hover:gap-2.5 transition-all">
              Kontaktovat <PiArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </span>
          </Link>

        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/" className="btn-cta">
            <PiArrowLeft className="w-4 h-4" /> Zpět na úvod
          </Link>
          <Link href="/kontakt" className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-[#008afe]/40 text-gray-700 text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
            Nahlásit problém
          </Link>
        </div>

      </main>
    </div>
  )
}
