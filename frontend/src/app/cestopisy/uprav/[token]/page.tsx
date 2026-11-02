import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import SectionHead from '@/components/ui/SectionHead'
import TravelogueForm from '@/components/TravelogueForm'
import { getByToken } from '@/server/travelogues'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Upravit cestopis', robots: { index: false, follow: false } }

export default async function UpravPage({ params }: { params: { token: string } }) {
  const t = await getByToken(params.token)
  if (!t) notFound()
  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-8)', maxWidth: 820 }}>
        <SectionHead as="h1" kicker={t.status === 'approved' ? 'Zveřejněno' : t.status === 'rejected' ? 'Zamítnuto' : 'Čeká na schválení'} title="uprav cestopis" />
        <p className="body" style={{ marginBottom: 'var(--space-6)' }}>Po uložení úprav cestopis znovu projde schválením.</p>
        <TravelogueForm token={params.token} destinations={[]} initial={{ title: t.title, body: t.body, author_name: t.author_name, destination: t.destination }} />
      </main>
    </>
  )
}
