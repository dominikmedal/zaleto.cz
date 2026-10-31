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
