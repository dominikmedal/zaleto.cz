import Photo from '@/components/ui/Photo'
import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/Header'
import Crumbs from '@/components/ui/Crumbs'
import Icon from '@/components/ui/Icon'
import { formatPrice } from '@/components/ui/format'
import { siteSearch } from '@/server/search'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Hledání | Zaleto', alternates: { canonical: 'https://zaleto.cz/hledat' }, robots: { index: false, follow: true } }

interface Props { searchParams: { q?: string | string[] } }

export default async function SearchPage({ searchParams }: Props) {
  const q = (Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q)?.trim() ?? ''
  const r = await siteSearch({ q, limit: '12' }).catch(() => null)
  const total = r ? r.destinations.length + r.hotels.length + r.articles.length + r.cars.length + r.places.length + r.trips.length + r.pages.length : 0

  return (
    <>
      <Header />
      <main className="z-container" style={{ paddingTop: 'var(--space-6)' }}>
        <Crumbs items={[{ label: 'Zaleto', href: '/' }, { label: 'Hledání' }]} />
        <h1 className="h1" style={{ margin: 'var(--space-4) 0 var(--space-5)' }}>{q ? <>„{q}“</> : 'hledání'}<span className="z-dot">.</span></h1>

        <form action="/hledat" method="get" className="z-searchpage__form" role="search">
          <label className="z-adm-search">
            <Icon name="hledat" />
            <input type="search" name="q" defaultValue={q} placeholder="Destinace, hotel, článek…" aria-label="Hledat" />
          </label>
          <button className="z-btn z-btn--primary" type="submit">Hledat<span className="z-btn__go"><Icon name="hledat" /></span></button>
        </form>

        {q.length >= 2 && total === 0 && (
          <div className="z-info" style={{ marginTop: 'var(--space-6)' }}>
            <h2 className="z-info__title">nic jsme nenašli<span className="z-dot">.</span></h2>
            <p style={{ margin: 'var(--space-3) 0 0' }}>Zkus kratší nebo jiný výraz, nebo projdi <Link href="/zajezdy" className="z-more">všechny zájezdy</Link> či <Link href="/destinace" className="z-more">destinace</Link>.</p>
          </div>
        )}
        {q.length > 0 && q.length < 2 && <p className="z-data" style={{ marginTop: 'var(--space-5)' }}>ZADEJ ALESPOŇ 2 ZNAKY</p>}

        {r && r.destinations.length > 0 && (
          <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>
            <h2 className="h3">destinace<span className="z-dot">.</span></h2>
            <div className="z-chips" style={{ marginTop: 'var(--space-4)' }}>
              {r.destinations.map(d => (
                <Link key={d.href} href={d.href} className="z-chip z-chip--sky" style={{ textDecoration: 'none' }}><Icon name="poloha" />{d.name}{d.country ? `, ${d.country}` : ''} · {d.count} hotelů</Link>
              ))}
            </div>
          </section>
        )}

        {r && r.hotels.length > 0 && (
          <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>
            <h2 className="h3">zájezdy<span className="z-dot">.</span></h2>
            <div className="z-searchpage__grid">
              {r.hotels.map(h => (
                <Link key={h.slug} href={h.href} className="z-sr-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {h.photo ? <Photo widths={[240, 480]} sizes="(max-width: 767px) 104px, 300px" src={h.photo} alt="" loading="lazy" /> : <span className="z-sr-card__ph" />}
                  <span className="z-sr-card__body">
                    <b>{h.name}</b>
                    <small>{h.place}{h.stars ? <span className="z-sr-stars">{Array.from({ length: h.stars }).map((_, i) => <Icon key={i} name="hvezda" size="sm" />)}</span> : null}</small>
                    {h.price ? <span className="z-price" style={{ fontSize: 20 }}>od {formatPrice(h.price)}</span> : null}
                  </span>
                </Link>
              ))}
            </div>
            <p style={{ margin: 'var(--space-4) 0 0' }}><Link className="z-more" href={`/zajezdy?destination=${encodeURIComponent(q)}`}>Zobrazit zájezdy pro „{q}“</Link></p>
          </section>
        )}

        {r && r.places.length > 0 && (
          <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>
            <h2 className="h3">pláže a místa<span className="z-dot">.</span></h2>
            <div className="z-searchpage__list">
              {r.places.map(p => (
                <Link key={p.href} href={p.href} className="z-sr-item" style={{ textDecoration: 'none' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.photo ? <Photo widths={[240, 480]} sizes="(max-width: 767px) 104px, 300px" src={p.photo} alt="" loading="lazy" /> : <span className="z-sr-item__icon"><Icon name={({ plaze: 'plaz', klastery: 'mesto', pamatky: 'kompas', priroda: 'hory', vesnicky: 'srdce' } as const)[p.section as 'plaze'] ?? 'poloha'} /></span>}
                  <span className="z-sr-item__text"><b>{p.name}</b><small>{p.kind} · {p.sub}</small></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {r && r.trips.length > 0 && (
          <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>
            <h2 className="h3">cestopisy<span className="z-dot">.</span></h2>
            <div className="z-searchpage__list">
              {r.trips.map(t => (
                <Link key={t.href} href={t.href} className="z-sr-item" style={{ textDecoration: 'none' }}>
                  <span className="z-sr-item__icon"><Icon name="trasa" /></span>
                  <span className="z-sr-item__text"><b>{t.title}</b><small>{t.destination} · {t.author}</small></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {r && r.articles.length > 0 && (
          <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>
            <h2 className="h3">články<span className="z-dot">.</span></h2>
            <div className="z-searchpage__list">
              {r.articles.map(a => (
                <Link key={a.slug} href={a.href} className="z-sr-item" style={{ textDecoration: 'none' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.image ? <Photo widths={[240, 480]} sizes="(max-width: 767px) 104px, 300px" src={a.image} alt="" loading="lazy" /> : <span className="z-sr-item__icon"><Icon name="clanek" /></span>}
                  <span className="z-sr-item__text"><b>{a.title}</b><small>{a.excerpt ?? a.location}</small></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {r && (r.cars.length > 0 || r.pages.length > 0) && (
          <section className="z-section" style={{ paddingTop: 'var(--space-7)' }}>
            <h2 className="h3">další na webu<span className="z-dot">.</span></h2>
            <div className="z-searchpage__list">
              {r.cars.map(c => (
                <Link key={c.href} href={c.href} className="z-sr-item" style={{ textDecoration: 'none' }}>
                  <span className="z-sr-item__icon"><Icon name="auto" /></span>
                  <span className="z-sr-item__text"><b>Půjčovna aut {c.name}</b><small>{c.country}</small></span>
                </Link>
              ))}
              {r.pages.map(p => (
                <Link key={p.href} href={p.href} className="z-sr-item" style={{ textDecoration: 'none' }}>
                  <span className="z-sr-item__icon"><Icon name="sipka" /></span>
                  <span className="z-sr-item__text"><b>{p.title}</b><small>{p.text}</small></span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}
