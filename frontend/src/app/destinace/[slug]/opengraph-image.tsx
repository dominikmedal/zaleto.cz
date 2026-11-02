import { ogCard, OG_SIZE, OG_TYPE } from '@/lib/ogCard'
import { fetchHotels, fetchDestinationPhoto } from '@/lib/api'
import { formatPrice } from '@/components/ui/format'
import { seasonYear } from '@/lib/seo'
import { resolveDestination } from './resolve'

export const revalidate = 3600
export const size = OG_SIZE
export const contentType = OG_TYPE
export const alt = 'Destinace na Zaleto'

export default async function Image({ params }: { params: { slug: string } }) {
  const dest = await resolveDestination(params.slug)
  if (!dest) return ogCard({ kicker: 'Destinace', title: 'Srovnání zájezdů' })
  const [result, photo] = await Promise.all([
    fetchHotels({ destination: dest.name, sort: 'price_asc', page: 1, limit: 1 }).catch(() => null),
    fetchDestinationPhoto(dest.name).then(u => u ?? (dest.country && dest.country !== dest.name ? fetchDestinationPhoto(dest.country) : null)),
  ])
  const from = result?.hotels[0]?.min_price
  const total = result?.pagination.total
  return ogCard({
    kicker: `Zájezdy ${seasonYear()}`,
    title: dest.name,
    meta: total ? `${total.toLocaleString('cs-CZ')} hotelů s volným termínem` : undefined,
    price: from ? `od ${formatPrice(from)}` : undefined,
    photo,
  })
}
