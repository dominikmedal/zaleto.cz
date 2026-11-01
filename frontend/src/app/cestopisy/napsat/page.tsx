import type { Metadata } from 'next'
import Header from '@/components/Header'
import SectionHead from '@/components/ui/SectionHead'
import Crumbs from '@/components/ui/Crumbs'
import TravelogueForm from '@/components/TravelogueForm'
import { fetchDestinations } from '@/lib/api'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Napsat cestopis | Zaleto',
  description: 'Podělte se o svou cestu. Cestopis po schválení zveřejníme u destinace.',
  alternates: { canonical: 'https://zaleto.cz/cestopisy/napsat' },
}

export default async function NapsatPage() {
  const all = await fetchDestinations().catch(() => [])
  const names = new Set<string>()
  for (const d of all) {
    const parts = d.destination.split('/').map(x => x.trim()).filter(Boolean)
    for (const p of [d.country, parts[1], d.resort_town]) if (p) names.add(p)
  }
  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)', maxWidth: 820 }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Cestopisy', href: '/cestopisy' }, { label: 'Napsat' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Podělte se" title="napiš cestopis" />
        <p className="body" style={{ marginBottom: 'var(--space-6)' }}>Žádná registrace. Pošli text, my ho přečteme a zveřejníme u destinace. Po odeslání dostaneš tajný odkaz pro pozdější úpravy.</p>
        <TravelogueForm destinations={[...names].sort((a, b) => a.localeCompare(b, 'cs'))} />
      </main>
    </>
  )
}
