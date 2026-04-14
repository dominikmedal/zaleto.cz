import Image from 'next/image'
import Link from 'next/link'
import { PiMapPin } from 'react-icons/pi'
import { slugify } from '@/lib/slugify'

interface Item {
  region: string
  country: string
  minPrice: number | null
  thumb: string | null
}

const fmt = (n: number) =>
  n >= 1_000 ? `${Math.round(n / 1000)} tis. Kč` : `${n.toLocaleString('cs-CZ')} Kč`

export default function DestinationCards({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.slice(0, 3).map(({ region, country, minPrice, thumb }) => (
        <Link
          key={region}
          href={`/destinace/${slugify(region)}`}
          className="group relative rounded-2xl overflow-hidden bg-gray-200 block"
          style={{ aspectRatio: '4/3' }}
        >
          {thumb ? (
            <Image
              src={thumb}
              alt={region}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
             
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#0093FF] to-blue-700" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

          {/* Location badge */}
          <div className="absolute top-3 left-3">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-white/90"
              style={{ background: 'rgba(255,255,255,0.16)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.22)' }}
            >
              <PiMapPin className="w-2.5 h-2.5 flex-shrink-0" />
              {country}
            </span>
          </div>

          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <p
              className="text-white font-bold leading-tight tracking-tight mb-1"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(20px, 2.5vw, 26px)' }}
            >
              {region}
            </p>
            {minPrice != null && (
              <p className="text-white/60 text-xs font-medium uppercase tracking-wide">
                od {fmt(minPrice)}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
