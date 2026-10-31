import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { CAR_DESTINATIONS } from '@/lib/carRental'
import { slugify } from '@/lib/slugify'

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
  'Vyraz na vlastní pěst, bez autobusů a bez čekání.',
  'Skryté zátoky a horské vesničky dostupné jen autem.',
  'Svoboda jít kam chceš a kdy chceš.',
  'Auto z dovolené udělá úplně jiný zážitek.',
]

/** Reklamní lístek půjčovny aut na detailu hotelu (vodorovná perforace, ústřižek s tlačítkem). */
export default function CarRentalBanner({ place, country }: Props) {
  const dest = findCarDest(place, country)
  const href = dest ? `/pujcovna-aut/${dest.slug}` : '/pujcovna-aut'
  const tagline = TAGLINES[place.length % TAGLINES.length]

  return (
    <div className="z-tk z-tk--v z-carbanner" style={{ ['--stub' as string]: '210px' }}>
      <div className="z-tk__in z-carbanner__in">
        <div className="z-carbanner__photo" aria-hidden="true" />
        <div className="z-carbanner__body">
          <div className="z-kicker" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="auto" size="sm" />Půjčovna aut</div>
          <h3 className="h3" style={{ margin: 'var(--space-2) 0' }}>prozkoumej destinaci na vlastní pěst<span className="z-dot">.</span></h3>
          <p style={{ margin: 0, color: 'var(--ink-muted)' }}>
            {tagline} Srovnáme přes <strong style={{ color: 'var(--ink)' }}>500 půjčoven</strong>, cena předem bez skrytých poplatků.
          </p>
          <div className="z-meta" style={{ marginTop: 'var(--space-3)' }}>
            <span><Icon name="shield" />Pojištění v ceně</span>
            <span><Icon name="cas" />Storno zdarma 48 h</span>
          </div>
        </div>
        <div className="z-carbanner__stub">
          <Link className="z-btn z-btn--offer z-btn--sm" href={href}>
            Srovnat ceny<span className="z-btn__go"><Icon name="sipka" /></span>
          </Link>
        </div>
      </div>
    </div>
  )
}
