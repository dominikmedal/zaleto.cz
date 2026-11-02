import { LinkList } from '@/components/ui/SeoBlocks'
import { fetchLandingList } from '@/lib/api'

/**
 * Přehledy zájezdů bez země (strava, hvězdičky, měsíce): odkazy z rozcestníků webu
 * (destinace, počasí, články, cestopisy, úvodní strana). Vkládá se dovnitř `<main className="z-container">`.
 */
export default async function LandingOverviews({ title = 'Přehledy zájezdů', container = false }: { title?: string; container?: boolean }) {
  const landings = await fetchLandingList()
  const order = { meal: 0, stars: 1, month: 2 } as const
  const now = new Date().getMonth() + 1
  const links = landings.filter(l => !l.country)
    // měsíce od nejbližšího, ostatní typy podle počtu hotelů
    .sort((a, b) => order[a.type] - order[b.type]
      || (a.type === 'month' ? ((Number(a.value) - now + 12) % 12) - ((Number(b.value) - now + 12) % 12) : b.hotel_count - a.hotel_count))
    .slice(0, 12)
    .map(l => ({ href: `/zajezdy/${l.slug}`, label: l.title, hint: `${l.hotel_count} hotelů` }))
  if (!links.length) return null
  return (
    <div className={container ? 'z-container' : undefined} style={{ marginTop: 'var(--space-7)' }}>
      <LinkList title={title} links={links} />
      <div style={{ height: 'var(--space-7)' }} />
    </div>
  )
}
