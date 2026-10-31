import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import { openapi } from '@/lib/openapi'

export const metadata: Metadata = {
  title: 'Zaleto API – dokumentace pro vývojáře a AI agenty',
  description:
    'Veřejné API Zaleta: zájezdy od českých cestovních kanceláří, destinace, počasí, články a půjčovny aut. Bez klíčů, jen pro čtení, s OpenAPI specifikací.',
  alternates: { canonical: 'https://zaleto.cz/developers' },
}

const ENDPOINTS = Object.entries(openapi.paths).map(([path, item]) => {
  const op = (item as unknown as { get: { operationId: string; summary: string; tags: readonly string[] } }).get
  return { path, id: op.operationId, summary: op.summary, tag: op.tags[0] }
})

const QUICKSTART = `# 1) Najdi zájezdy: Turecko, all inclusive, 7 nocí, od nejlevnějších
curl -s "https://zaleto.cz/api/hotels?destination=Turecko&meal_plan=All%20Inclusive&duration=7&sort=price_asc&limit=5"

# 2) Detail hotelu a jeho termíny
curl -s "https://zaleto.cz/api/hotels/cd-studia-sofia"
curl -s "https://zaleto.cz/api/hotels/cd-studia-sofia/tours?sort=price_asc&limit=5"

# 3) Hledání napříč webem (destinace, hotely, články, půjčovny aut)
curl -s "https://zaleto.cz/api/search?q=kreta"

# 4) Libovolná stránka webu jako Markdown (pro AI agenty)
curl -s -H "Accept: text/markdown" "https://zaleto.cz/destinace/turecko"`

const ERROR_EXAMPLE = `{
  "error": "date_from and date_to required",
  "code": "bad_request",
  "status": 400,
  "message": "date_from and date_to required",
  "hint": "Zkontroluj povinné parametry a jejich formát (např. datum RRRR-MM-DD) podle OpenAPI specifikace.",
  "docs": "https://zaleto.cz/openapi.json"
}`

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebAPI',
  name: 'Zaleto API',
  description: 'Veřejné API pro čtení nabídek zájezdů, destinací, počasí, článků a půjčoven aut.',
  url: 'https://zaleto.cz/developers',
  documentation: 'https://zaleto.cz/openapi.json',
  provider: { '@type': 'Organization', name: 'Zaleto', url: 'https://zaleto.cz' },
}

export default function DevelopersPage() {
  return (
    <>
      <JsonLd data={schema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Zaleto API' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Pro vývojáře a AI agenty" title="zaleto api" />
        <p className="lead" style={{ maxWidth: 'var(--article-max)', marginBottom: 'var(--space-6)' }}>
          Zaleto API je veřejné rozhraní jen pro čtení. Vrací zájezdy od českých cestovních kanceláří, destinace, klima, cestovní články a průvodce
          půjčením auta. Nepotřebuješ klíč ani registraci, specifikace je v <a href="/openapi.json">OpenAPI 3.1 (openapi.json)</a>.
        </p>

        <div className="z-prose" style={{ maxWidth: 'var(--article-max)' }}>
          <h2>Základní informace</h2>
          <ul>
            <li><strong>Base URL:</strong> <code>https://zaleto.cz</code>, všechny endpointy jsou pod <code>/api</code></li>
            <li><strong>Autentizace:</strong> žádná (veřejná data, jen metoda GET)</li>
            <li><strong>Formát:</strong> JSON v UTF-8, jazyk textů je čeština, ceny jsou v Kč za osobu při 2 dospělých a jsou orientační</li>
            <li><strong>CORS:</strong> povolené odkudkoli pro čtení</li>
            <li><strong>Cache a limity:</strong> odpovědi se cachují (obvykle 5 minut). Žádné klíče ani pevné limity nemáme, ale prosíme o rozumnou frekvenci (jednotky dotazů za sekundu). Potřebuješ víc? Napiš na <a href="mailto:info@zaleto.cz">info@zaleto.cz</a>.</li>
            <li><strong>Sandbox:</strong> není potřeba, protože API nic nemění; všechny dotazy jsou bezpečné.</li>
            <li><strong>Rezervace:</strong> přes API nejsou možné. Termíny mají adresu u cestovní kanceláře a na webu vedou na partnera přes odkaz s provizí.</li>
          </ul>

          <h2>Rychlý start</h2>
          <pre className="z-code"><code>{QUICKSTART}</code></pre>

          <h2>Endpointy</h2>
          <p>Úplný popis parametrů a schémat odpovědí je v <a href="/openapi.json">openapi.json</a>. Každá operace má unikátní <code>operationId</code> a je použitelná i jako funkce pro LLM (function calling).</p>
        </div>

        <div className="z-searchpage__list" style={{ maxWidth: 'var(--article-max)', margin: 'var(--space-4) 0 var(--space-6)' }}>
          {ENDPOINTS.map(e => (
            <div key={e.path} className="z-dev-endpoint">
              <span className="z-chip z-chip--sky">GET</span>
              <code>{e.path}</code>
              <span className="z-dev-endpoint__text"><b>{e.summary}</b><small>{e.id} · {e.tag}</small></span>
            </div>
          ))}
        </div>

        <div className="z-prose" style={{ maxWidth: 'var(--article-max)' }}>
          <h2>Chyby</h2>
          <p>
            Každá chyba má stav HTTP a JSON tělo: strojově čitelný <code>code</code>, popis, <code>hint</code> s doporučením, jak požadavek opravit, a odkaz na specifikaci.
            Pole <code>error</code> je text se stejným významem jako <code>message</code>.
          </p>
          <pre className="z-code"><code>{ERROR_EXAMPLE}</code></pre>

          <h2>Pro AI agenty</h2>
          <ul>
            <li><Link href="/llms.txt">llms.txt</Link>: kdy Zaleto použít, jak volat vyhledávání a přehled stránek</li>
            <li><strong>Markdown:</strong> každá stránka webu vrací při hlavičce <code>Accept: text/markdown</code> Markdown místo HTML</li>
            <li><Link href="/sitemap.xml">sitemap.xml</Link>: všechny stránky webu</li>
            <li><a href="/openapi.json">openapi.json</a>: strojově čitelný popis API</li>
          </ul>
        </div>
      </main>
    </>
  )
}
