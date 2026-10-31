import type { Metadata } from 'next'
import Header from '@/components/Header'
import Button from '@/components/ui/Button'

export const metadata: Metadata = {
  title: '404 – Stránka nenalezena',
  description: 'Stránka, kterou hledáš, neexistuje nebo byla přesunuta.',
  robots: { index: false, follow: false },
}

export default function NotFoundPage() {
  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-8)' }}>
        <div className="z-kicker">Chyba 404</div>
        <h1 className="display" style={{ margin: 'var(--space-4) 0' }}>tady nic není<span className="z-dot">.</span></h1>
        <p className="lead" style={{ maxWidth: 560, marginBottom: 'var(--space-6)' }}>
          Stránka neexistuje nebo se přestěhovala. Vrať se na začátek, nebo si rovnou vyber zájezd.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <Button href="/">Zpět na úvod</Button>
          <Button href="/zajezdy" variant="line">Najít zájezd</Button>
        </div>
      </main>
    </>
  )
}
