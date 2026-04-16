import Image from 'next/image'
import Link from 'next/link'
import { CAR_DESTINATIONS } from '@/lib/carRental'
import { slugify } from '@/lib/slugify'
import { Car, ChevronRight, Shield, Clock } from 'lucide-react'

interface Props {
  place: string
  country: string
}

function findCarDest(place: string, country: string) {
  const norm = (s: string) => slugify(s)
  const byPlace = CAR_DESTINATIONS.find(d => norm(d.name) === norm(place) || d.slug === norm(place))
  if (byPlace) return byPlace
  const byCountry = CAR_DESTINATIONS.filter(d => norm(d.country) === norm(country))
  return byCountry.find(d => d.popular) ?? byCountry[0] ?? null
}

const TAGLINES = [
  'Vyrazte na vlastní pěst — bez autobusů, bez čekání.',
  'Skryté zátoky a horské vesničky dostupné jen autem.',
  'Svoboda jít kam chcete, kdy chcete.',
  'Auto z dovolené udělá úplně jiný zážitek.',
]

export default function CarRentalBanner({ place, country }: Props) {
  const dest      = findCarDest(place, country)
  const href      = dest ? `/pujcovna-aut/${dest.slug}` : '/pujcovna-aut'
  const destLabel = dest?.name ?? place ?? country
  const tagline   = TAGLINES[place.length % TAGLINES.length]

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row min-h-[160px]">

        {/* Photo strip */}
        <div className="relative sm:w-52 h-36 sm:h-auto flex-shrink-0 overflow-hidden bg-gradient-to-br from-sky-100 to-blue-50">
          <Image
            src="/img/header-car.jpg"
            alt="Půjčovna aut"
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 208px"
          />
          {/* Right-side fade into card body (desktop) */}
          <div
            className="absolute inset-0 hidden sm:block"
            style={{ background: 'linear-gradient(to right, transparent 50%, rgba(255,255,255,0.72) 100%)' }}
          />
          {/* Bottom fade (mobile) */}
          <div
            className="absolute inset-0 sm:hidden"
            style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(255,255,255,0.85) 100%)' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-4 sm:px-6 sm:py-5 flex flex-col justify-center gap-3">

          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 glass-pill rounded-full px-2.5 py-1 text-[10px] font-bold text-[#0068CC] uppercase tracking-[0.1em] mb-2">
                <Car className="w-3 h-3" />
                Půjčovna aut
              </div>
              <h3
                className="font-bold text-gray-900 leading-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(16px, 2.5vw, 20px)' }}
              >
                Prozkoumejte destinaci na vlastní pěst
              </h3>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-[13px] text-gray-500 leading-relaxed -mt-1">
            {tagline} Srovnejte přes <strong className="text-gray-700">500 půjčoven</strong> — garantovaná cena, bez skrytých poplatků.
          </p>

          {/* Trust pills + CTA */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 glass-pill px-2.5 py-1 rounded-full">
              <Shield className="w-3 h-3 text-[#0093FF]" />
              Pojištění v ceně
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 glass-pill px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3 text-[#0093FF]" />
              Zdarma storno 48 h
            </span>

            <Link href={href} className="btn-cta ml-auto py-2 px-4 text-[12px]">
              Srovnat ceny
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
