import { resolveDestination } from '@/app/destinace/[slug]/resolve'
import { LinkList } from '@/components/ui/SeoBlocks'
import { fetchArticles, fetchLandingList, fetchDynamicCarDestinations } from '@/lib/api'
import { mergeDestinations } from '@/lib/carRental'
import { slugify } from '@/lib/slugify'

type Kind = 'guide' | 'hotels' | 'tours' | 'weather' | 'car'

/**
 * Vnitřní prolinkování místa na jednom místě: průvodce, hotely, zájezdy, počasí, půjčovna aut,
 * přehledy zájezdů země a články o lokalitě. `skip` vynechá odkazy na právě zobrazenou stránku.
 * Vkládá se dovnitř `<main className="z-container">`.
 */
export default async function PlaceLinks({ slug, skip = [] }: { slug: string; skip?: Kind[] }) {
  const dest = await resolveDestination(slug)
  if (!dest) return null
  const [landings, articles, carRaw] = await Promise.all([
    dest.country ? fetchLandingList() : Promise.resolve([]),
    fetchArticles(3, dest.name).catch(() => []),
    fetchDynamicCarDestinations().catch(() => []),
  ])
  const countrySlug = dest.country ? slugify(dest.country) : null
  const has = (k: Kind) => !skip.includes(k)

  // počasí existuje pro země a oblasti; u střediska vedeme na počasí země
  const weatherHref = dest.type === 'country' ? `/pocasi/${slug}`
    : dest.type === 'region' && countrySlug ? `/pocasi/${countrySlug}/${slug}`
    : countrySlug ? `/pocasi/${countrySlug}` : null
  const weatherLabel = dest.type === 'region' ? dest.name : dest.country ?? dest.name

  const car = mergeDestinations(carRaw).find(d => d.slug === slug || slugify(d.name) === slug)

  const place = [
    ...(has('guide') ? [{ href: `/destinace/${slug}`, label: `Průvodce: ${dest.name}`, hint: 'kdy jet, pro koho, kolik stojí' }] : []),
    ...(has('hotels') ? [{ href: `/destinace/${slug}/hotely`, label: `Hotely: ${dest.name}`, hint: 'všechny hotely s termínem' }] : []),
    ...(has('tours') ? [{ href: `/zajezdy?destination=${encodeURIComponent(dest.name)}`, label: `Zájezdy: ${dest.name}`, hint: 'vyhledávání s filtry' }] : []),
    ...(has('weather') && weatherHref ? [{ href: weatherHref, label: `Počasí: ${weatherLabel}`, hint: 'klima po měsících' }] : []),
    ...(has('car') && car ? [{ href: `/pujcovna-aut/${car.slug}`, label: `Půjčovna aut: ${car.name}`, hint: 'srovnání cen' }] : []),
    ...(dest.type !== 'country' && countrySlug && has('guide') ? [{ href: `/destinace/${countrySlug}`, label: `Průvodce: ${dest.country}`, hint: 'celá země' }] : []),
  ]
  const order = { meal: 0, stars: 1, month: 2 } as const
  const overviews = landings.filter(l => l.country === dest.country)
    .sort((a, b) => order[a.type] - order[b.type] || b.hotel_count - a.hotel_count).slice(0, 8)
    .map(l => ({ href: `/zajezdy/${l.slug}`, label: l.title, hint: `${l.hotel_count} hotelů` }))
  const reads = articles.slice(0, 3).map(a => ({ href: `/clanky/${a.slug}`, label: a.title }))

  if (!place.length && !overviews.length && !reads.length) return null
  return (
    <div style={{ marginTop: 'var(--space-7)' }}>
      <LinkList title={`Související stránky: ${dest.name}`} links={place} />
      <LinkList title={`Přehledy zájezdů${dest.country ? `: ${dest.country}` : ''}`} links={overviews} />
      <LinkList title="Čti dál" links={reads} />
      <div style={{ height: 'var(--space-7)' }} />
    </div>
  )
}
