import type { Metadata } from 'next'
import Header from '@/components/Header'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import WindowCard from '@/components/ui/WindowCard'
import { fetchDestinations, fetchDestinationPhoto } from '@/lib/api'
import { slugify } from '@/lib/slugify'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Počasí na dovolené — kdy jet a kam? Průvodce klimatem',
  description: 'Zjisti, kdy je v dané destinaci nejlépe. Průměrné teploty vzduchu i moře, sluneční hodiny a nejlepší měsíce pro dovolenou.',
  alternates: { canonical: 'https://zaleto.cz/pocasi' },
  openGraph: {
    title: 'Počasí na dovolené — kdy jet a kam?',
    description: 'Klimatické průvodce, teploty moře a nejlepší měsíce pro každou destinaci.',
    url: 'https://zaleto.cz/pocasi',
    type: 'website',
    siteName: 'Zaleto',
    locale: 'cs_CZ',
  },
}

export default async function PocasiPage() {
  const destinations = await fetchDestinations().catch(() => [])
  const counts = new Map<string, number>()
  for (const d of destinations) if (d.country) counts.set(d.country, (counts.get(d.country) ?? 0) + (d.hotel_count ?? 0))
  const countries = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count, slug: slugify(name) }))
  const photos = await Promise.all(countries.slice(0, 20).map(c => fetchDestinationPhoto(c.name).catch(() => null)))

  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Počasí' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Klima a počasí" title="kdy kam" />
        <p className="lead" style={{ maxWidth: 'var(--article-max)', marginBottom: 'var(--space-7)' }}>
          Průměrné teploty vzduchu i moře, sluneční hodiny a nejlepší měsíce pro dovolenou. Vyber zemi.
        </p>
        <div className="z-grid-4">
          {countries.map((c, i) => (
            <WindowCard key={c.slug} href={`/pocasi/${c.slug}`} name={c.name} photo={photos[i] ?? null} />
          ))}
        </div>
      </main>
    </>
  )
}
