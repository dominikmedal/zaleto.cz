'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon, { type IconName } from '@/components/ui/Icon'
import { fetchAdminStats, AdminStats } from '@/lib/adminApi'

function fmtKc(n: number | null): string {
  if (n == null) return '—'
  return `${n.toLocaleString('cs-CZ')} Kč`
}
const fmtDate = (s: string) => new Date(s).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })

const fmtDateTime = (s: string) => new Date(s).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** „před 5 min“, „před 3 h“, „před 2 dny“… */
function ago(s: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(s).getTime()) / 60000))
  if (min < 1) return 'právě teď'
  if (min < 60) return `před ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `před ${h} h`
  const d = Math.round(h / 24)
  if (d < 60) return `před ${d} ${d === 1 ? 'dnem' : 'dny'}`
  return `před ${Math.round(d / 30)} měs.`
}
/** čerstvé / starší / zastaralé podle stáří v hodinách (výchozí 7 dní) */
function freshness(s: string, okHours = 24 * 7): 'ok' | 'warn' | 'old' {
  const h = (Date.now() - new Date(s).getTime()) / 3600000
  return h <= okHours ? 'ok' : h <= okHours * 4 ? 'warn' : 'old'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { fetchAdminStats().then(setStats).catch(e => setError(e.message)) }, [])

  if (error) return <div className="z-info"><h2 className="z-info__title">něco se nepovedlo<span className="z-dot">.</span></h2><p style={{ margin: 'var(--space-3) 0 0' }}>{error}</p></div>
  if (!stats) return <div className="z-admin__loading" style={{ minHeight: 240 }}><Icon name="spinner" size="lg" className="animate-spin" /></div>

  const tiles: { label: string; value: string | number; sub: string; icon: IconName; href: string }[] = [
    { label: 'Hotely', value: stats.hotels.toLocaleString('cs-CZ'), sub: `${stats.agencies} CK`, icon: 'hotel', href: '/admin/hotely' },
    { label: 'Termíny', value: stats.tours.toLocaleString('cs-CZ'), sub: 'nadcházející', icon: 'letadlo', href: '/admin/zajezdy' },
    { label: 'Články', value: stats.articles, sub: 'celkem', icon: 'clanek', href: '/admin/clanky' },
    { label: 'Destinace', value: stats.destinations.toLocaleString('cs-CZ'), sub: `${stats.customPhotos} vlastních fotek`, icon: 'poloha', href: '/admin/destinace' },
    { label: 'Nejnižší cena', value: fmtKc(stats.minPrice), sub: 'aktuálně', icon: 'mena', href: '/admin/zajezdy' },
  ]

  return (
    <div className="z-admin__stack">
      <div>
        <div className="z-kicker">Stav databáze</div>
        <h1>přehled<span className="z-dot">.</span></h1>
      </div>

      <div className="z-admin__tiles">
        {tiles.map(t => (
          <Link key={t.label} href={t.href} className="z-tk z-admintile">
            <div className="z-tk__in">
              <span className="z-admintile__ic"><Icon name={t.icon} /></span>
              <span className="z-admintile__value">{t.value}</span>
              <span className="z-kicker">{t.label}</span>
              <span className="z-data" style={{ textTransform: 'none' }}>{t.sub}</span>
            </div>
          </Link>
        ))}
      </div>

      <section className="z-info" style={{ padding: 'var(--space-5)' }}>
        <div className="z-info__head" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 className="z-info__title" style={{ fontSize: 24, lineHeight: '28px' }}>co se naposledy aktualizovalo<span className="z-dot">.</span></h2>
        </div>
        <div className="z-adminact">
          {stats.activity.content.map(c => (
            <div key={c.key} className="z-adminact__card" data-empty={c.total === 0 || undefined}>
              <div className="z-adminact__top">
                <b>{c.href ? <Link href={c.href}>{c.label}</Link> : c.label}</b>
                <span className="z-data">{c.total.toLocaleString('cs-CZ')} ks</span>
              </div>
              <div className="z-adminact__last">
                {c.last_at ? <><span className={`z-adminact__dot z-adminact__dot--${freshness(c.last_at)}`} />{ago(c.last_at)}<small>{fmtDateTime(c.last_at)}</small></> : <span className="z-data" style={{ textTransform: 'none' }}>zatím nic</span>}
              </div>
              {c.recent.length > 0 && (
                <ul>
                  {c.recent.map((r, i) => <li key={i}><span>{r.name}</span><time>{ago(r.at)}</time></li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="z-info" style={{ padding: 'var(--space-5)' }}>
        <div className="z-info__head" style={{ marginBottom: 'var(--space-3)' }}>
          <h2 className="z-info__title" style={{ fontSize: 24, lineHeight: '28px' }}>data od cestovních kanceláří<span className="z-dot">.</span></h2>
        </div>
        <ul className="z-adminlist">
          {stats.activity.agencies.map(a => (
            <li key={a.agency}>
              <div><b>{a.agency}</b><small>{a.hotels.toLocaleString('cs-CZ')} hotelů</small></div>
              {a.last_at
                ? <span className="z-data"><span className={`z-adminact__dot z-adminact__dot--${freshness(a.last_at, 36)}`} />{ago(a.last_at)} · {fmtDateTime(a.last_at)}</span>
                : <span className="z-data">—</span>}
            </li>
          ))}
        </ul>
      </section>

      <div className="z-grid-2">
        <section className="z-info" style={{ padding: 'var(--space-5)' }}>
          <div className="z-info__head" style={{ marginBottom: 'var(--space-3)' }}>
            <h2 className="z-info__title" style={{ fontSize: 24, lineHeight: '28px' }}>nedávno aktualizované hotely<span className="z-dot">.</span></h2>
            <Link href="/admin/hotely" className="z-more">Vše</Link>
          </div>
          <ul className="z-adminlist">
            {stats.recentHotels.map(h => (
              <li key={h.id}>
                <div><b>{h.name}</b><small>{[h.country, h.agency].filter(Boolean).join(' · ')}</small></div>
                {h.stars ? <span className="z-meta"><span><Icon name="hvezda" />{h.stars}</span></span> : null}
                <span className="z-data">{fmtDate(h.updated_at)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="z-info" style={{ padding: 'var(--space-5)' }}>
          <div className="z-info__head" style={{ marginBottom: 'var(--space-3)' }}>
            <h2 className="z-info__title" style={{ fontSize: 24, lineHeight: '28px' }}>nejnovější články<span className="z-dot">.</span></h2>
            <Link href="/admin/clanky" className="z-more">Vše</Link>
          </div>
          <ul className="z-adminlist">
            {stats.recentArticles.map(a => (
              <li key={a.id}>
                <div><b>{a.title}</b><small>{[a.category, a.location].filter(Boolean).join(' · ')}</small></div>
                <span className="z-data">{fmtDate(a.published_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
