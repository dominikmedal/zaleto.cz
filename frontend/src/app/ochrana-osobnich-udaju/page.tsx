import type { Metadata } from 'next'
import Header from '@/components/Header'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'

export const metadata: Metadata = {
  title: 'Ochrana osobních údajů',
  description: 'Jak Zaleto nakládá s osobními údaji: správce, účely zpracování, příjemci, cookies a tvoje práva.',
  alternates: { canonical: 'https://zaleto.cz/ochrana-osobnich-udaju' },
}

const UPDATED = '31. 10. 2026'

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Ochrana osobních údajů' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Právní informace" title="ochrana osobních údajů" />
        <p className="z-data" style={{ marginBottom: 'var(--space-5)' }}>PLATNÉ OD {UPDATED}</p>

        <div className="z-prose" style={{ maxWidth: 'var(--article-max)' }}>
          <p className="z-lead">
            Zaleto je srovnávač zájezdů a půjčoven aut. Osobních údajů sbíráme co nejméně. Tady je stručně a srozumitelně vysvětleno,
            které údaje zpracováváme, proč, komu je předáváme a jaká máš práva.
          </p>

          <h2>Kdo je správcem</h2>
          <p>
            Správcem osobních údajů je Bc. Dominik Medal, Majerského 2032/9, Praha 4 – Chodov, 149 00, IČO 17271541, zapsaný
            v živnostenském rejstříku v Praze (dále „Zaleto“). Kontakt ve věcech ochrany údajů: <a href="mailto:info@zaleto.cz">info@zaleto.cz</a>.
          </p>

          <h2>Jaké údaje zpracováváme a proč</h2>
          <h3>Zprávy z kontaktního formuláře a chatu „Poradíme s výběrem“</h3>
          <p>
            Když nám napíšeš, zpracováváme e-mail, který uvedeš, volitelně jméno, text zprávy a adresu stránky, ze které jsi psal(a).
            Údaje použijeme jen k tomu, abychom ti odpověděli a vyřídili tvůj dotaz. Právním základem je náš oprávněný zájem na vyřízení dotazů
            a případné kroky před uzavřením smlouvy na tvoji žádost. Zprávu ukládáme v databázi a posíláme ji na naši e-mailovou schránku.
            Uchováváme ji po dobu nezbytnou k vyřízení dotazu a navazující komunikace, poté ji mažeme.
          </p>

          <h3>Měření návštěvnosti</h3>
          <p>
            Pro anonymní statistiky o používání webu využíváme Google Analytics. Ten ukládá cookies a zpracovává technické údaje o zařízení
            a chování na webu (např. navštívené stránky, přibližnou polohu, typ prohlížeče). Měření slouží ke zlepšování webu. Cookies můžeš
            kdykoli smazat nebo zablokovat v nastavení prohlížeče či doplňkem pro blokování sledování.
          </p>

          <h3>Údaje uložené jen v tvém prohlížeči</h3>
          <p>
            Oblíbené hotely a poslední hledání (termín, odletové město, počet osob) se ukládají přímo v tvém prohlížeči (localStorage a sessionStorage)
            a neodesíláme je na naše servery. Smažeš je vymazáním dat webu v prohlížeči. Dialog s nabídkou se zobrazuje nejvýš jednou za relaci a
            k tomu si pamatuje jen příznak v prohlížeči.
          </p>

          <h3>Technické záznamy</h3>
          <p>
            Provozovatel hostingu (Vercel) a databáze (Neon) zpracovává při běžném provozu technické záznamy, například IP adresu a čas přístupu,
            a to kvůli bezpečnosti a stabilitě služby.
          </p>

          <h2>Odkazy na cestovní kanceláře a půjčovny aut</h2>
          <p>
            Zaleto zájezdy ani auta neprodává. Po kliknutí na nabídku tě přesměrujeme na web cestovní kanceláře nebo půjčovny. Odkazy jsou
            affiliate odkazy: pokud si na partnerském webu něco zarezervuješ, můžeme získat provizi, cena pro tebe se tím nemění. Od chvíle,
            kdy opustíš Zaleto, se zpracování tvých údajů řídí zásadami dané cestovní kanceláře nebo půjčovny.
          </p>

          <h2>Komu údaje předáváme</h2>
          <p>
            Údaje zpracovávají naši poskytovatelé služeb: Vercel Inc. (hosting webu), Neon (databáze), Seznam.cz, a.s. (odesílání a přijímání e-mailů)
            a Google (měření návštěvnosti). Tito zpracovatelé mohou údaje zpracovávat i mimo Evropský hospodářský prostor na základě standardních
            smluvních doložek nebo rozhodnutí o odpovídající ochraně. Údaje neprodáváme.
          </p>

          <h2>Tvoje práva</h2>
          <p>
            Máš právo na přístup ke svým osobním údajům, na jejich opravu nebo výmaz, na omezení zpracování, na přenositelnost a právo vznést námitku
            proti zpracování. Stačí napsat na <a href="mailto:info@zaleto.cz">info@zaleto.cz</a>. Pokud se domníváš, že s údaji nakládáme v rozporu
            s právními předpisy, můžeš podat stížnost u Úřadu pro ochranu osobních údajů (<a href="https://uoou.gov.cz" rel="noopener noreferrer">uoou.gov.cz</a>).
          </p>

          <h2>Změny těchto zásad</h2>
          <p>
            Zásady můžeme průběžně aktualizovat, např. při změně služeb, které používáme. Aktuální znění najdeš vždy na této stránce včetně data platnosti.
          </p>
        </div>
      </main>
    </>
  )
}
