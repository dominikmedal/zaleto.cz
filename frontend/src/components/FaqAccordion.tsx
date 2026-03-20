'use client'
import { useState } from 'react'
import { PiCaretDown } from 'react-icons/pi'

export const FAQS = [
  {
    q: 'Jak mohu rezervovat zájezd?',
    a: 'Na Zaleto nevybíráte zájezd přímo — fungujeme jako srovnávač. Najděte hotel, který vás zajímá, vyberte termín a klikněte na tlačítko „Rezervovat". Přesměrujeme vás přímo na stránku cestovní kanceláře, kde dokončíte rezervaci bezpečně a za jejích podmínek.',
  },
  {
    q: 'Jsou ceny na Zaleto skutečně nejlevnější?',
    a: 'Ceny zobrazujeme přímo z dat jednotlivých cestovních kanceláří a pravidelně je aktualizujeme. Protože srovnáváme nabídky z více zdrojů, velmi často najdete na Zaleto nejnižší dostupnou cenu. Mějte na paměti, že ceny jsou orientační — aktuální cena bude vždy potvrzena na stránce CK před dokončením rezervace.',
  },
  {
    q: 'Jak funguje vyhledávání?',
    a: 'Zadejte destinaci, termín odjezdu a počet cestujících. Výsledky lze dále filtrovat podle počtu nocí, stravování, dopravy, hvězdičkového hodnocení nebo cenového rozpětí. Hotely lze zobrazit v přehledové mřížce, detailním seznamu nebo na interaktivní mapě.',
  },
  {
    q: 'Mohu zrušit nebo změnit rezervaci?',
    a: 'Rezervace se provádí přímo na webu příslušné cestovní kanceláře, nikoliv přes Zaleto. Veškeré změny, storna a reklamace proto řešte přímo s danou CK dle jejich podmínek. Kontakt na CK najdete vždy na jejich stránkách, na které vás přesměrujeme.',
  },
  {
    q: 'Jsou v cenách zahrnuty všechny poplatky?',
    a: 'Zobrazená cena je cena za osobu tak, jak ji poskytuje cestovní kancelář. Letištní taxy, pobytové poplatky nebo volitelné příplatky (pojištění, transfer apod.) mohou být účtovány zvlášť a budou upřesněny při dokončení rezervace u CK.',
  },
  {
    q: 'Jak mohu kontaktovat cestovní kancelář?',
    a: 'Na detailu každého hotelu je uveden název CK, jejíž nabídku zobrazujeme. Kliknutím na „Rezervovat" se dostanete přímo na jejich web. Kontaktní údaje (telefon, email, pobočky) najdete na webu příslušné CK.',
  },
  {
    q: 'Funguje Zaleto i na mobilních zařízeních?',
    a: 'Ano, Zaleto je plně responzivní a optimalizovaný pro telefony i tablety. Vyhledávání, filtry, galerie i mapa fungují na všech moderních zařízeních a prohlížečích.',
  },
  {
    q: 'Jak často se aktualizují ceny?',
    a: 'Data z cestovních kanceláří stahujeme pravidelně — cílem jsou aktualizace několikrát denně. I přesto mohou ceny v reálném čase kolísat, proto vždy doporučujeme ověřit aktuální cenu přímo na stránce CK před dokončením rezervace.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold text-gray-900">{q}</span>
        <PiCaretDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
          <p className="pt-4">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function FaqAccordion() {
  return (
    <div className="space-y-2.5">
      {FAQS.map(faq => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
    </div>
  )
}
