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
  '@type': 'Person',
  name: 'Bc. Dominik Medal',
  jobTitle: 'Provozovatel Zaleto',
  email: 'info@zaleto.cz',
  address: { '@type': 'PostalAddress', streetAddress: 'Majerského 2032/9, Praha 4 - Chodov, 149 00', addressCountry: 'CZ' },
  worksFor: { '@type': 'Organization', name: 'Zaleto', url: 'https://zaleto.cz' },
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

        <div className="z-grid-3">
          <a href="mailto:info@zaleto.cz?subject=Dotaz ohledně Zaleto" className="z-tk z-tk--h" style={{ ['--cut' as string]: '76px' }}>
            <div className="z-tk__in" style={{ padding: 'var(--space-5)', minHeight: 230, display: 'flex', flexDirection: 'column' }}>
              <Icon name="envelope" size="lg" />
              <h2 className="h3" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}>podpora</h2>
              <p style={{ margin: 0, color: 'var(--ink-muted)' }}>Napiš nám e-mail, odpovíme do 24 hodin.</p>
              <div className="z-data" style={{ marginTop: 'auto', paddingTop: 'var(--space-5)', color: 'var(--ink)' }}>INFO@ZALETO.CZ</div>
            </div>
          </a>

          <div className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', minHeight: 230 }}>
            <Icon name="mena" size="lg" />
            <h2 className="h3" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}>fakturační údaje</h2>
            <address style={{ fontStyle: 'normal', color: 'var(--ink-muted)' }}>
              <strong style={{ color: 'var(--ink)' }}>Bc. Dominik Medal</strong><br />
              Majerského 2032/9, Praha 4 - Chodov, 149&nbsp;00<br />
              IČO: 17271541<br />
              <span className="z-data">Zapsán v živnostenském rejstříku v Praze. Nejsem plátce DPH.</span>
            </address>
          </div></div>

          <div className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)', minHeight: 230, display: 'flex', flexDirection: 'column' }}>
            <Icon name="info" size="lg" />
            <h2 className="h3" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}>časté otázky</h2>
            <p style={{ margin: '0 0 var(--space-4)', color: 'var(--ink-muted)' }}>Odpovědi na nejčastější dotazy o Zaleto.</p>
            <div style={{ marginTop: 'auto' }}><Button href="/faq" small>Zobrazit FAQ</Button></div>
          </div></div>
        </div>

        <p className="z-data" style={{ marginTop: 'var(--space-6)', maxWidth: 640 }}>
          Zaleto je srovnávač zájezdů, rezervace probíhají přímo u cestovních kanceláří. S dotazy k provedené rezervaci se obrať na příslušnou CK.
        </p>
      </main>
    </>
  )
}
