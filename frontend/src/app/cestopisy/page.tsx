import type { Metadata } from 'next'
import Header from '@/components/Header'
import SectionHead from '@/components/ui/SectionHead'
import Crumbs from '@/components/ui/Crumbs'
import Button from '@/components/ui/Button'
import TravelogueCard from '@/components/ui/TravelogueCard'
import { approvedTravelogues } from '@/server/travelogues'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Cestopisy od čtenářů',
  description: 'Cestopisy od lidí, kteří tam byli. Skutečné zážitky a tipy z dovolených.',
  alternates: { canonical: 'https://zaleto.cz/cestopisy' },
}

export default async function CestopisyPage() {
  const trips = await approvedTravelogues({ limit: 60 })
  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Cestopisy' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker="Od čtenářů" title="cestopisy" moreHref="/cestopisy/napsat" moreLabel="Napsat cestopis" />
        {trips.length === 0 ? (
          <div className="z-info" style={{ padding: 'var(--space-6)' }}>
            <p className="body">Zatím tu žádný cestopis není. Buď první, kdo se podělí o svou cestu.</p>
            <Button href="/cestopisy/napsat">Napsat cestopis</Button>
          </div>
        ) : (
          <div className="z-grid-3w">{trips.map(t => <TravelogueCard key={t.slug} t={t} />)}</div>
        )}
      </main>
    </>
  )
}
