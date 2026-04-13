'use client'
import { useEffect, useState, useCallback } from 'react'
import { fetchAdminTours, deleteTour, AdminTour } from '@/lib/adminApi'
import { PiMagnifyingGlass, PiSpinner, PiTrash, PiCaretLeft, PiCaretRight, PiAirplane } from 'react-icons/pi'

const LIMIT = 50

const MEAL_LABELS: Record<string, string> = {
  'all-inclusive': 'AI', 'ultra-all-inclusive': 'UAI',
  'polopenze': 'PP', 'plná penze': 'FP', 'snídaně': 'SN', 'bez stravy': 'BS',
}

function fmtKc(n: number) {
  if (n >= 10_000) return `${Math.round(n / 1000)} tis. Kč`
  return `${n.toLocaleString('cs-CZ')} Kč`
}

export default function ZajezdyPage() {
  const [q,       setQ]       = useState('')
  const [agency,  setAgency]  = useState('')
  const [page,    setPage]    = useState(1)
  const [data,    setData]    = useState<{ tours: AdminTour[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminTours({ q, agency, page, limit: LIMIT })
      setData({ tours: res.tours, total: res.total })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setLoading(false)
    }
  }, [q, agency, page])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: number) => {
    try {
      await deleteTour(id)
      setConfirm(null)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Chyba při mazání')
    }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-gray-800">Zájezdy</h1>
        {data && <p className="text-sm text-gray-500">{data.total.toLocaleString('cs-CZ')} nadcházejících termínů</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Hledat hotel nebo zemi..." value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 transition-all" />
        </div>
        <input type="text" placeholder="CK (agency)" value={agency}
          onChange={e => { setAgency(e.target.value); setPage(1) }}
          className="w-40 px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 transition-all" />
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading && !data && (
          <div className="flex items-center justify-center h-40">
            <PiSpinner className="w-7 h-7 text-[#0093FF] animate-spin" />
          </div>
        )}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Hotel</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden sm:table-cell">Odjezd</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden md:table-cell">Délka</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden md:table-cell">Strava</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Cena</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden lg:table-cell">CK</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.tours.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800 truncate max-w-[180px]">{t.hotel_name}</p>
                      <p className="text-[11px] text-gray-400">{t.resort_town ? `${t.resort_town}, ` : ''}{t.country}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600 hidden sm:table-cell whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <PiAirplane className="w-3 h-3 text-gray-400" />
                        {t.departure_date}
                      </div>
                      {t.departure_city && <p className="text-[10px] text-gray-400 mt-0.5">{t.departure_city}</p>}
                    </td>
                    <td className="px-3 py-3 text-gray-600 hidden md:table-cell">{t.duration ? `${t.duration} dní` : '—'}</td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {t.meal_plan && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700">
                          {MEAL_LABELS[t.meal_plan.toLowerCase()] ?? t.meal_plan}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-gray-800">{fmtKc(t.price)}</td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600">{t.agency}</span>
                    </td>
                    <td className="px-4 py-3">
                      {confirm === t.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleDelete(t.id)}
                            className="px-2 py-0.5 bg-red-500 text-white text-[11px] rounded-md font-semibold hover:bg-red-600">Ano</button>
                          <button onClick={() => setConfirm(null)}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-md font-semibold hover:bg-gray-200">Ne</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirm(t.id)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <PiTrash className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-gray-500">Strana {page} / {totalPages}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <PiCaretLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <PiCaretRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
