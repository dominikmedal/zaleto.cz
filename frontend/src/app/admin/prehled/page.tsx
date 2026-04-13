'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchAdminStats, AdminStats } from '@/lib/adminApi'
import {
  PiBuildings, PiAirplane, PiNewspaper, PiMapPin, PiSpinner,
  PiArrowRight, PiStar, PiCurrencyCircleDollar
} from 'react-icons/pi'

function fmtKc(n: number | null): string {
  if (n == null) return '—'
  if (n >= 10_000) return `${Math.round(n / 1000)} tis. Kč`
  return `${n.toLocaleString('cs-CZ')} Kč`
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAdminStats()
      .then(setStats)
      .catch(e => setError(e.message))
  }, [])

  if (error) return (
    <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-red-700 text-sm">{error}</div>
  )

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <PiSpinner className="w-8 h-8 text-[#0093FF] animate-spin" />
    </div>
  )

  const tiles = [
    { label: 'Hotely',       value: stats.hotels,      sub: `${stats.agencies} CK`,        icon: PiBuildings,            href: '/admin/hotely',    color: '#0093FF' },
    { label: 'Termíny',      value: stats.tours,       sub: 'nadcházející',                 icon: PiAirplane,             href: '/admin/zajezdy',   color: '#22C55E' },
    { label: 'Články',       value: stats.articles,    sub: 'celkem',                       icon: PiNewspaper,            href: '/admin/clanky',    color: '#F59E0B' },
    { label: 'Destinace',    value: stats.destinations,sub: `${stats.customPhotos} fotek`,  icon: PiMapPin,               href: '/admin/destinace', color: '#8B5CF6' },
    { label: 'Nejnižší cena',value: fmtKc(stats.minPrice), sub: 'aktuálně',                icon: PiCurrencyCircleDollar, href: '/admin/zajezdy',   color: '#EF4444' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[24px] font-bold text-gray-800">Přehled</h1>
        <p className="text-sm text-gray-500 mt-0.5">Stav databáze zaleto.cz</p>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {tiles.map(t => (
          <Link key={t.label} href={t.href}
            className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md hover:border-gray-200 transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${t.color}18` }}>
                <t.icon className="w-5 h-5" style={{ color: t.color }} />
              </div>
              <PiArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-[22px] font-bold text-gray-800 leading-none">{t.value}</p>
            <p className="text-[11px] text-gray-500 mt-1">{t.label}</p>
            <p className="text-[10px] text-gray-400">{t.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent hotels */}
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <PiBuildings className="w-4 h-4 text-[#0093FF]" />
              <span className="font-semibold text-gray-700 text-[14px]">Nedávno aktualizované hotely</span>
            </div>
            <Link href="/admin/hotely" className="text-[11px] text-[#0093FF] font-semibold hover:underline">Vše →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentHotels.map(h => (
              <div key={h.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{h.name}</p>
                  <p className="text-[11px] text-gray-400">{h.country} · {h.agency}</p>
                </div>
                {h.stars && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: h.stars }).map((_, i) => (
                      <PiStar key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                )}
                <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(h.updated_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent articles */}
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <PiNewspaper className="w-4 h-4 text-[#F59E0B]" />
              <span className="font-semibold text-gray-700 text-[14px]">Nejnovější články</span>
            </div>
            <Link href="/admin/clanky" className="text-[11px] text-[#0093FF] font-semibold hover:underline">Vše →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentArticles.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{a.title}</p>
                  <p className="text-[11px] text-gray-400">
                    {a.category ? `${a.category} · ` : ''}{a.location ?? ''}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(a.published_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
