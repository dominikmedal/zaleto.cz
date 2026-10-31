import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import JsonLd from '@/components/JsonLd'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import WindowCard from '@/components/ui/WindowCard'
import { fetchDestinations, fetchDestinationPhoto } from '@/lib/api'
import { slugify } from '@/lib/slugify'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Všechny destinace — přehled zájezdů | Zaleto.cz',
  description: 'Vyber zemi, oblast nebo středisko a najdi nejlepší nabídky od českých cestovních kanceláří.',
  alternates: { canonical: 'https://zaleto.cz/destinace' },
  openGraph: { title: 'Destinace zájezdů — Zaleto.cz', url: 'https://zaleto.cz/destinace', type: 'website' },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Zaleto', item: 'https://zaleto.cz' },
    { '@type': 'ListItem', position: 2, name: 'Destinace', item: 'https://zaleto.cz/destinace' },
  ],
}

/** Fotky hotelů od CK (content4travel) nejsou fotky destinace. */
const isHotelPhoto = (u: string | null) => !u || /content4travel\.com/.test(u)

interface Row { country: string; destination: string; resort_town: string | null; hotel_count: number }

const regionOf = (dest: string) => {
  const parts = dest.split('/').map(s => s.trim())
  return parts.length >= 2 ? parts[1] : parts[0]
}

function group(rows: Row[]) {
  const m = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!r.country) continue
    const reg = regionOf(r.destination)
    const inner = m.get(r.country) ?? new Map<string, number>()
    inner.set(reg, (inner.get(reg) ?? 0) + r.hotel_count)
    m.set(r.country, inner)
  }
  return [...m.entries()]
    .map(([name, regions]) => {
      const list = [...regions.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
      return { name, total: list.reduce((s, r) => s + r.count, 0), regions: list }
    })
    .sort((a, b) => b.total - a.total)
}

export default async function DestinacePage() {
  const rows = await fetchDestinations().catch(() => [] as Row[])
  const countries = group(rows)
  // Pravé fotky destinací (stejné jako na detailu), ne fotky hotelů od cestovních kanceláří.
  const candidates = countries.slice(0, 30)
  const candidatePhotos = await Promise.all(candidates.map(c => fetchDestinationPhoto(c.name).catch(() => null)))
  const picked = candidates.map((c, i) => ({ c, photo: candidatePhotos[i] })).filter(x => !isHotelPhoto(x.photo)).slice(0, 12)
  const top = picked.map(x => x.c)
  const photos = picked.map(x => x.photo)
  const totalHotels = countries.reduce((s, c) => s + c.total, 0)

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Destinace' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" keepKicker kicker={`${countries.length} zemí · ${totalHotels.toLocaleString('cs-CZ')} hotelů`} title="kam letos" />

        <div className="z-grid-4 z-windows z-windows--sm">
          {top.map((c, i) => (
            <WindowCard key={c.name} href={`/destinace/${slugify(c.name)}`} name={c.name} photo={photos[i]} count={c.total} countLabel="hotelů" />
          ))}
        </div>

        <div className="z-section">
          <SectionHead kicker="Abecední přehled" title="všechny země" />
          <div className="z-grid-3w" style={{ rowGap: 'var(--space-6)' }}>
            {[...countries].sort((a, b) => a.name.localeCompare(b.name, 'cs')).map(c => (
              <section key={c.name}>
                <h3 className="h3" style={{ marginBottom: 'var(--space-2)' }}>
                  <Link href={`/destinace/${slugify(c.name)}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{c.name}</Link>
                  <span className="z-dot">.</span>
                </h3>
                <div className="z-data" style={{ marginBottom: 'var(--space-3)' }}>{c.total} HOTELŮ</div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {c.regions.slice(0, 8).map(r => (
                    <li key={r.label}>
                      <Link className="z-chip" href={`/destinace/${slugify(r.label)}`} style={{ textDecoration: 'none' }}>{r.label} · {r.count}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
