import { ogCard, OG_SIZE, OG_TYPE } from '@/lib/ogCard'
import { fetchHotel } from '@/lib/api'
import { formatPrice } from '@/components/ui/format'

export const revalidate = 3600
export const size = OG_SIZE
export const contentType = OG_TYPE
export const alt = 'Hotel na Zaleto'

export default async function Image({ params }: { params: { slug: string } }) {
  const hotel = await fetchHotel(params.slug).catch(() => null)
  if (!hotel) return ogCard({ kicker: 'Hotel', title: 'Srovnání zájezdů' })
  return ogCard({
    kicker: 'Zájezd do hotelu',
    title: hotel.name,
    meta: [[hotel.resort_town, hotel.country].filter(Boolean).join(', '), hotel.stars ? `${hotel.stars}*` : ''].filter(Boolean).join(' · '),
    price: hotel.min_price ? `od ${formatPrice(hotel.min_price)}` : undefined,
    photo: hotel.thumbnail_url,
  })
}
