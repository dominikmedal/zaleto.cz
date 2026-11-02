import Photo from '@/components/ui/Photo'
import PersonsField from '@/components/ui/PersonsField'
import RememberFilters from '@/components/RememberFilters'
import type { Metadata } from 'next'
import { Fragment } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Icon from '@/components/ui/Icon'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import InfiniteHotels from '@/components/InfiniteHotels'
import DestinationSuggest from '@/components/ui/DestinationSuggest'
import { DateRangeField } from '@/components/DateRangePicker'
import { fetchFilters, fetchHotels, fetchDestinations, fetchDestinationAI, fetchDestinationPhoto } from '@/lib/api'
import { slugify } from '@/lib/slugify'

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

const KEYS = ['destination', 'date_from', 'date_to', 'duration', 'min_price', 'max_price', 'stars', 'meal_plan', 'transport', 'tour_type', 'departure_city', 'sort'] as const
const SORTS: [string, string][] = [
  ['price_asc', 'Nejlevnější'], ['price_desc', 'Nejdražší'], ['date_asc', 'Nejbližší odlet'], ['stars_desc', 'Nejvíc hvězd'], ['name_asc', 'Podle názvu'],
]
const LIMIT = 24

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const dest = one(searchParams.destination)
  const type = one(searchParams.tour_type)
  const hasFilters = KEYS.some(k => k !== 'sort' && one(searchParams[k]))
  let title = 'Zájezdy 2026 — srovnání cen od českých CK | Zaleto'
  if (type === 'last_minute') title = 'Last minute zájezdy — srovnání cen CK | Zaleto'
  else if (type === 'first_minute') title = 'First minute zájezdy — srovnání cen CK | Zaleto'
  else if (dest && !dest.includes(',')) title = `Zájezdy ${dest} — srovnání cen CK | Zaleto`
  return {
    title,
    description: 'Porovnej zájezdy od českých cestovních kanceláří podle destinace, termínu, stravování a ceny.',
    alternates: { canonical: 'https://zaleto.cz/zajezdy' },
    robots: hasFilters ? { index: false, follow: true } : undefined,
  }
}

function qs(sp: SP, over: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const k of [...KEYS, 'page']) {
    const v = k in over ? over[k] : one(sp[k])
    if (v) p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

interface DestInfo { name: string; slug: string; text: string | null; photo: string | null; weatherHref: string | null }

async function loadDestInfo(name: string): Promise<DestInfo | null> {
  const [rows, ai, photo] = await Promise.all([
    fetchDestinations().catch(() => []),
    fetchDestinationAI(name).catch(() => null),
    fetchDestinationPhoto(name).catch(() => null),
  ])
  const n = name.toLowerCase()
  const regionOf = (d: string | null) => { const p = (d ?? '').split('/').map(x => x.trim()); return p.length >= 2 ? p[1] : p[0] }
  let weatherHref: string | null = null
  const asCountry = rows.find(r => r.country?.toLowerCase() === n)
  if (asCountry?.country) weatherHref = `/pocasi/${slugify(asCountry.country)}`
  else {
    const asRegion = rows.find(r => regionOf(r.destination).toLowerCase() === n)
    if (asRegion?.country) weatherHref = `/pocasi/${slugify(asRegion.country)}/${slugify(regionOf(asRegion.destination))}`
  }
  const first = ai?.description?.split(/\n\n+/)[0] ?? null
  const text = first ? first.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ') : null
  return { name, slug: slugify(name), text, photo, weatherHref }
}

export default async function ZajezdyPage({ searchParams }: { searchParams: SP }) {
  const f = Object.fromEntries(KEYS.map(k => [k, one(searchParams[k])])) as Record<(typeof KEYS)[number], string | undefined>
  const page = Math.max(1, parseInt(one(searchParams.page) ?? '1') || 1)
  const sort = f.sort || 'price_asc'

  // Jedna destinace → pod nadpisem ukážeme mini info (průvodce, počasí); výsledky jsou rovnou vyfiltrované.
  const singleDest = f.destination && !f.destination.includes(',') ? f.destination.trim() : null

  const [meta, result, destInfo] = await Promise.all([
    fetchFilters().catch(() => null),
    fetchHotels({
      destination: f.destination, date_from: f.date_from, date_to: f.date_to, date_flex: one(searchParams.date_flex), duration: f.duration,
      min_price: f.min_price ? parseFloat(f.min_price) : undefined, max_price: f.max_price ? parseFloat(f.max_price) : undefined,
      stars: f.stars, meal_plan: f.meal_plan, transport: f.transport, tour_type: f.tour_type,
      departure_city: f.departure_city, sort, page, limit: LIMIT,
    }).catch(() => null),
    singleDest ? loadDestInfo(singleDest) : Promise.resolve(null),
  ])

  const hotels = result?.hotels ?? []
  const pg = result?.pagination
  const active = KEYS.filter(k => k !== 'sort' && f[k]).length
  const title = f.tour_type === 'last_minute' ? 'last minute' : f.tour_type === 'first_minute' ? 'first minute' : f.destination ? f.destination.toLowerCase() : 'všechny zájezdy'

  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Zájezdy' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" keepKicker kicker={pg ? `${pg.total.toLocaleString('cs-CZ')} hotelů s volným termínem` : 'Zájezdy'} title={title} />

        {destInfo && (
          <aside className="z-destmini" aria-label={`O destinaci ${destInfo.name}`}>
            {destInfo.photo && (
              <div className="z-destmini__photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Photo widths={[240, 480]} sizes="120px" src={destInfo.photo} alt="" />
              </div>
            )}
            <div className="z-destmini__body">
              <h2 className="h3">{destInfo.name}<span className="z-dot">.</span></h2>
              {destInfo.text && <p>{destInfo.text}</p>}
              <div className="z-meta">
                {pg ? <span><Icon name="hotel" />{pg.total.toLocaleString('cs-CZ')} hotelů s termínem</span> : null}
                {hotels[0] ? <span><Icon name="mena" />od {Math.round(hotels[0].min_price).toLocaleString('cs-CZ')} Kč</span> : null}
              </div>
            </div>
            <div className="z-destmini__links">
              <Link className="z-btn z-btn--line z-btn--sm" href={`/destinace/${destInfo.slug}`}>Celý průvodce<span className="z-btn__go"><Icon name="sipka" /></span></Link>
              {destInfo.weatherHref && <Link className="z-more" href={destInfo.weatherHref}>Počasí a klima</Link>}
            </div>
          </aside>
        )}

        <RememberFilters params={{ adults: one(searchParams.adults), date_from: f.date_from, date_to: f.date_to, departure_city: f.departure_city }} />
        <form method="get" action="/zajezdy" className="z-filter" style={{ marginBottom: 'var(--space-7)' }}>
          <div className="z-tk"><div className="z-tk__in z-filter__in">
            <div className="z-sfield"><span className="z-sfield__label"><Icon name="poloha" />Kam</span>
              <DestinationSuggest name="destination" defaultValue={f.destination} /></div>
            <label className="z-sfield"><span className="z-sfield__label"><Icon name="letadlo" />Odkud</span>
              <select name="departure_city" defaultValue={f.departure_city ?? ''}>
                <option value="">Odkudkoli</option>
                {meta?.departureCities.slice(0, 12).map(c => <option key={c.departure_city} value={c.departure_city}>{c.departure_city}</option>)}
              </select></label>
            <div className="z-sfield z-sfield--wide"><span className="z-sfield__label"><Icon name="kalendar" />Termín</span>
              <DateRangeField defaultFrom={f.date_from ?? ''} defaultTo={f.date_to ?? ''} defaultFlex={one(searchParams.date_flex) !== '0'} /></div>
            <PersonsField defaultValue={parseInt(one(searchParams.adults) ?? '2') || 2} />
          </div></div>

          <details className="z-filter__more">
            <summary className="z-more">Další filtry</summary>
            <div className="z-filter__grid">
              <label className="z-sfield"><span className="z-sfield__label"><Icon name="cas" />Délka</span>
                <select name="duration" defaultValue={f.duration ?? ''}>
                  <option value="">Libovolná</option>
                  {meta?.durations.filter(d => d.duration >= 2 && d.duration <= 21).map(d => <option key={d.duration} value={d.duration}>{d.duration} nocí</option>)}
                </select></label>
              <label className="z-sfield"><span className="z-sfield__label"><Icon name="jidlo" />Strava</span>
                <select name="meal_plan" defaultValue={f.meal_plan ?? ''}>
                  <option value="">Jakákoli</option>
                  {meta?.mealPlans.map(m => <option key={m.meal_plan} value={m.meal_plan}>{m.meal_plan}</option>)}
                </select></label>
              <label className="z-sfield"><span className="z-sfield__label"><Icon name="hvezda" />Hvězdy</span>
                <select name="stars" defaultValue={f.stars ?? ''}>
                  <option value="">Libovolné</option>
                  <option value="5">5</option><option value="4,5">4 a víc</option><option value="3,4,5">3 a víc</option>
                </select></label>
              <label className="z-sfield"><span className="z-sfield__label"><Icon name="mena" />Cena do (Kč)</span>
                <input name="max_price" type="number" min="0" step="500" defaultValue={f.max_price} placeholder="Bez limitu" /></label>
              <label className="z-sfield"><span className="z-sfield__label"><Icon name="slunce" />Typ</span>
                <select name="tour_type" defaultValue={f.tour_type ?? ''}>
                  <option value="">Všechny</option><option value="last_minute">Last minute</option><option value="first_minute">First minute</option>
                </select></label>
              <label className="z-sfield"><span className="z-sfield__label"><Icon name="filtr" />Řazení</span>
                <select name="sort" defaultValue={sort}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            </div>
          </details>

          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
            <button type="submit" className="z-btn z-btn--primary">Najít zájezd<span className="z-btn__go"><Icon name="hledat" /></span></button>
            {active > 0 && <Link href="/zajezdy" className="z-more">Zrušit filtry ({active})</Link>}
          </div>
        </form>

        {hotels.length === 0 ? (
          <div className="z-info"><h2 className="z-info__title">nic jsme nenašli<span className="z-dot">.</span></h2>
            <p style={{ margin: 'var(--space-3) 0 0' }}>Zkus rozšířit termín nebo zrušit některý filtr.</p></div>
        ) : (
          <InfiniteHotels
            initial={hotels}
            total={pg?.total ?? hotels.length}
            limit={LIMIT}
            query={{
              destination: f.destination, date_from: f.date_from, date_to: f.date_to, date_flex: one(searchParams.date_flex),
              duration: f.duration, min_price: f.min_price, max_price: f.max_price, stars: f.stars, meal_plan: f.meal_plan,
              transport: f.transport, tour_type: f.tour_type, departure_city: f.departure_city, sort,
            }}
          />
        )}
      </main>
    </>
  )
}
