'use client'
import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { CAR_DESTINATIONS, buildDCUrl } from '@/lib/carRental'
import { slugify } from '@/lib/slugify'

interface Props {
  place: string
  country: string
}

interface QuoteCar { name: string; image: string | null; savingPct: number | null; bookUrl: string | null }
interface Quote { cars: QuoteCar[]; days: number; pickup: string; dropoff: string; searchUrl: string }

function findCarDest(place: string, country: string) {
  const norm = (s: string) => slugify(s)
  const byPlace = CAR_DESTINATIONS.find(d => norm(d.name) === norm(place) || d.slug === norm(place))
  if (byPlace) return byPlace
  const byCountry = CAR_DESTINATIONS.filter(d => norm(d.country) === norm(country))
  return byCountry.find(d => d.popular) ?? byCountry[0] ?? null
}

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
const short = (d: string) => { const [, m, day] = d.split('-'); return `${Number(day)}. ${Number(m)}.` }
const click = (url: string) => `/api/car-rental/click?url=${encodeURIComponent(url)}`

/**
 * Banner půjčovny aut: tmavý lístek (odlišený od obsahu) s nadpisem, tlačítkem a čtyřmi konkrétními auty (nejlevnější modely,
 * cena za den). Každé auto i tlačítko vedou rovnou k partnerovi (DiscoverCars) s vyhledáním dané oblasti, jako „Rezervovat“
 * u aut. Nabídky se dotahují až při zobrazení banneru (server je drží 6 hodin); bez nich zůstane nadpis s tlačítkem.
 */
export default function CarRentalBanner({ place, country }: Props) {
  const dest = findCarDest(place, country)
  const ref = useRef<HTMLDivElement>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')

  useEffect(() => {
    const el = ref.current
    if (!el || !dest) return
    let started = false
    const obs = new IntersectionObserver(entries => {
      if (started || !entries[0].isIntersecting) return
      started = true
      obs.disconnect()
      setState('loading')
      fetch(`/api/car-rental/quote?slug=${encodeURIComponent(dest.slug)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(q => { if (q && Array.isArray(q.cars) && q.cars.length) setQuote(q) })
        .catch(() => { /* bez nabídek zůstane jen nadpis s tlačítkem */ })
        .finally(() => setState('done'))
    }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [dest])

  const placeName = dest?.name ?? place
  const searchTarget = !dest ? null : (quote?.searchUrl || buildDCUrl({ dcPath: dest.dcPath, pickupDate: iso(21), dropoffDate: iso(28) }))
  const searchHref = searchTarget ? click(searchTarget) : '/pujcovna-aut'
  const external = !!searchTarget
  const linkProps = external ? { target: '_blank', rel: 'noopener noreferrer sponsored' } : {}

  return (
    <div ref={ref} className="z-cars">
      <div className="z-cars__head">
        <div className="z-kicker z-cars__kicker"><Icon name="auto" size="sm" />Půjčovna aut · {placeName}</div>
        <h3 className="z-cars__title">skvělé nabídky půjčoven aut<span className="z-dot">.</span></h3>
        <p className="z-cars__sub">
          {quote ? `Nabídky na ${quote.days} dní, ${short(quote.pickup)}–${short(quote.dropoff)}. ` : 'Srovnáme přes 500 půjčoven. '}
        </p>
        <a className="z-btn z-btn--offer z-cars__btn" href={searchHref} {...linkProps}>Zobrazit vše<span className="z-btn__go"><Icon name="sipka" /></span></a>
      </div>

      {(state === 'loading' || quote) && (
        <ul className="z-cars__grid" aria-busy={state === 'loading'}>
          {quote
            ? quote.cars.map(c => (
                <li key={c.name}>
                  <a className="z-cars__car" href={click(c.bookUrl || quote.searchUrl || searchTarget || '')} {...linkProps}>
                    <span className="z-cars__img">
                      {c.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={c.image} alt="" loading="lazy" />
                        : <Icon name="auto" size="lg" />}
                    </span>
                    <span className="z-cars__name">{c.name}</span>
                    {c.savingPct
                      ? <span className="z-cars__deal"><b>−{c.savingPct} %</b><small>levněji než průměr</small></span>
                      : <span className="z-cars__deal z-cars__deal--plain">Zobrazit nabídku</span>}
                  </a>
                </li>
              ))
            : [0, 1, 2, 3].map(i => <li key={i}><span className="z-cars__car z-cars__car--skeleton" aria-hidden="true" /></li>)}
        </ul>
      )}
    </div>
  )
}
