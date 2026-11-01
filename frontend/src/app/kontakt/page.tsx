import type { Metadata } from 'next'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import Icon from '@/components/ui/Icon'
import Button from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Kontakt',
  description: 'Kontaktuj tým Zaleto. Napiš nám na info@zaleto.cz, odpovíme do 24 hodin.',
  alternates: { canonical: 'https://zaleto.cz/kontakt' },
  openGraph: {
    title: 'Kontakt | Zaleto',
    description: 'Máš dotaz? Napiš nám na info@zaleto.cz.',
    url: 'https://zaleto.cz/kontakt',
    type: 'website',
  },
}

const contactSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Zaleto',
  url: 'https://zaleto.cz',
  email: 'info@zaleto.cz',
}

export default function KontaktPage() {
  return (
    <>
      <JsonLd data={contactSchema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Kontakt' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Pomoc" title="kontakt" />

        <div className="z-grid-2">
          <a href="mailto:info@zaleto.cz?subject=Dotaz ohledně Zaleto" className="z-tk z-tk--h" style={{ ['--cut' as string]: '76px' }}>
            <div className="z-tk__in" style={{ padding: 'var(--space-5)', minHeight: 230, display: 'flex', flexDirection: 'column' }}>
              <Icon name="envelope" size="lg" />
              <h2 className="h3" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}>podpora</h2>
              <p style={{ margin: 0, color: 'var(--ink-muted)' }}>Napiš nám e-mail, odpovíme do 24 hodin.</p>
              <div className="z-data" style={{ marginTop: 'auto', paddingTop: 'var(--space-5)', color: 'var(--ink)' }}>INFO@ZALETO.CZ</div>
            </div>
          </a>

          <div className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', minHeight: 230, display: 'flex', flexDirection: 'column' }}>
            <Icon name="info" size="lg" />
            <h2 className="h3" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}>časté otázky</h2>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-muted)' }}>Odpovědi na nejčastější dotazy o Zaleto.</p>
            <div style={{ marginTop: 'auto' }}><Button href="/faq" small>Zobrazit FAQ</Button></div>
          </div></div>
        </div>

        <section className="z-section" style={{ paddingTop: 'var(--space-7)', maxWidth: 'var(--article-max)' }}>
          <h2 className="h3">s čím ti poradíme<span className="z-dot">.</span></h2>
          <div className="z-prose" style={{ marginTop: 'var(--space-3)' }}>
            <p>
              Zaleto je nezávislý srovnávač zájezdů a půjčoven aut. Napiš nám, pokud si nevíš rady s hledáním zájezdu, chybí ti
              nějaká destinace, narazil jsi na chybnou cenu nebo termín, nebo máš tip, co bychom na webu měli zlepšit.
              Odpovídáme v pracovní dny, obvykle do 24 hodin.
            </p>
            <p>
              Rezervace a platby zájezdů probíhají přímo u cestovních kanceláří, proto s provedenou rezervací, fakturou nebo reklamací
              prosím kontaktuj příslušnou cestovní kancelář. Informace o tom, jak nakládáme s tvými údaji, najdeš v&nbsp;
              <a href="/ochrana-osobnich-udaju">zásadách ochrany osobních údajů</a>, a jak Zaleto funguje, vysvětlujeme na stránce <a href="/o-zaleto">Co je Zaleto</a>.
            </p>
          </div>
        </section>

        <p className="z-data" style={{ marginTop: 'var(--space-6)', maxWidth: 640 }}>
          Zaleto je srovnávač zájezdů, rezervace probíhají přímo u cestovních kanceláří. S dotazy k provedené rezervaci se obrať na příslušnou CK.
        </p>
      </main>
    </>
  )
}
