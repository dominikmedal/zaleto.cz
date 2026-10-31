import type { Metadata } from 'next'
import { Fragment } from 'react'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import Header from '@/components/Header'
import Icon from '@/components/ui/Icon'
import Crumbs from '@/components/ui/Crumbs'
import SectionHead from '@/components/ui/SectionHead'
import TourCard from '@/components/ui/TourCard'
import TourAd from '@/components/ui/TourAd'
import { fetchFilters, fetchHotels } from '@/lib/api'
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

export default async function ZajezdyPage({ searchParams }: { searchParams: SP }) {
  const f = Object.fromEntries(KEYS.map(k => [k, one(searchParams[k])])) as Record<(typeof KEYS)[number], string | undefined>
  const page = Math.max(1, parseInt(one(searchParams.page) ?? '1') || 1)
  const sort = f.sort || 'price_asc'

  // /zajezdy?destination=X bez dalších filtrů → kanonická stránka destinace
  const onlyDest = f.destination && !f.destination.includes(',') && KEYS.every(k => k === 'destination' || k === 'sort' || !f[k])
  if (onlyDest) permanentRedirect(`/destinace/${slugify(f.destination!)}${sort !== 'price_asc' ? `?sort=${sort}` : ''}`)

  const [meta, result] = await Promise.all([
    fetchFilters().catch(() => null),
    fetchHotels({
      destination: f.destination, date_from: f.date_from, date_to: f.date_to, duration: f.duration,
      min_price: f.min_price ? parseFloat(f.min_price) : undefined, max_price: f.max_price ? parseFloat(f.max_price) : undefined,
      stars: f.stars, meal_plan: f.meal_plan, transport: f.transport, tour_type: f.tour_type,
      departure_city: f.departure_city, sort, page, limit: LIMIT,
    }).catch(() => null),
  ])

  const hotels = result?.hotels ?? []
  const pg = result?.pagination
  const adHotel = hotels.find(h => h.thumbnail_url) ?? null
  const active = KEYS.filter(k => k !== 'sort' && f[k]).length
  const title = f.tour_type === 'last_minute' ? 'last minute' : f.tour_type === 'first_minute' ? 'first minute' : f.destination ? f.destination.toLowerCase() : 'všechny zájezdy'

  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Zájezdy' }]} />
        <div style={{ height: 'var(--space-6)' }} />
        <SectionHead as="h1" kicker={pg ? `${pg.total.toLocaleString('cs-CZ')} hotelů s volným termínem` : 'Zájezdy'} title={title} />

        <form method="get" action="/zajezdy" className="z-filter" style={{ marginBottom: 'var(--space-7)' }}>
          <div className="z-tk"><div className="z-tk__in z-filter__in">
            <label className="z-sfield"><span className="z-sfield__label"><Icon name="poloha" />Kam</span>
              <input name="destination" defaultValue={f.destination} placeholder="Kamkoli" /></label>
            <label className="z-sfield"><span className="z-sfield__label"><Icon name="letadlo" />Odkud</span>
              <select name="departure_city" defaultValue={f.departure_city ?? ''}>
                <option value="">Odkudkoli</option>
                {meta?.departureCities.slice(0, 12).map(c => <option key={c.departure_city} value={c.departure_city}>{c.departure_city}</option>)}
              </select></label>
            <label className="z-sfield"><span className="z-sfield__label"><Icon name="kalendar" />Odlet od</span>
              <input name="date_from" type="date" defaultValue={f.date_from} /></label>
            <label className="z-sfield"><span className="z-sfield__label"><Icon name="kalendar" />Návrat do</span>
              <input name="date_to" type="date" defaultValue={f.date_to} /></label>
          </div></div>

          <details className="z-filter__more" open={!!(f.duration || f.meal_plan || f.stars || f.max_price || f.min_price || f.tour_type)}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-5)', alignItems: 'stretch' }}>
            {hotels.map((h, i) => (
              <Fragment key={h.slug}>
                <TourCard hotel={h} priority={i < 3} />
                {i === 5 && adHotel && <div style={{ display: 'flex' }}><div style={{ width: '100%' }}><TourAd hotel={adHotel} /></div></div>}
              </Fragment>
            ))}
          </div>
        )}

        {pg && pg.totalPages > 1 && (
          <nav aria-label="Stránkování" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-7)' }}>
            {page > 1 ? <Link className="z-more" href={`/zajezdy${qs(searchParams, { page: String(page - 1) })}`}>Předchozí</Link> : <span />}
            <span className="z-data">STRANA {page} / {pg.totalPages}</span>
            {pg.hasMore ? <Link className="z-more" href={`/zajezdy${qs(searchParams, { page: String(page + 1) })}`}>Další</Link> : <span />}
          </nav>
        )}
      </main>
    </>
  )
}
