'use client'
import { useEffect, useState, useCallback } from 'react'
import { fetchAdminHotels, deleteHotel, AdminHotel } from '@/lib/adminApi'
import { PiMagnifyingGlass, PiSpinner, PiTrash, PiCaretLeft, PiCaretRight, PiStar } from 'react-icons/pi'

const LIMIT = 50

function fmtKc(n: number | null) {
  if (n == null) return '—'
  if (n >= 10_000) return `${Math.round(n / 1000)} tis. Kč`
  return `${n.toLocaleString('cs-CZ')} Kč`
}

export default function HotelyPage() {
  const [q,       setQ]       = useState('')
  const [agency,  setAgency]  = useState('')
  const [page,    setPage]    = useState(1)
  const [data,    setData]    = useState<{ hotels: AdminHotel[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminHotels({ q, agency, page, limit: LIMIT })
      setData({ hotels: res.hotels, total: res.total })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Chyba')
    } finally {
      setLoading(false)
    }
  }, [q, agency, page])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: number) => {
    try {
      await deleteHotel(id)
      setConfirm(null)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Chyba při mazání')
    }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-800">Hotely</h1>
          {data && <p className="text-sm text-gray-500">{data.total.toLocaleString('cs-CZ')} hotelů celkem</p>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Hledat hotel, zemi..." value={q}
            onChange={e => { setQ(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 transition-all" />
        </div>
        <input type="text" placeholder="CK (agency)" value={agency}
          onChange={e => { setAgency(e.target.value); setPage(1) }}
          className="w-40 px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 transition-all" />
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      {/* Table */}
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
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden sm:table-cell">Země</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden md:table-cell">CK</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden lg:table-cell">Min. cena</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden lg:table-cell">Termíny</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.hotels.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {h.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.thumbnail_url} alt="" className="w-10 h-7 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-7 rounded-lg bg-blue-50 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate max-w-[200px]">{h.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {h.stars ? Array.from({ length: h.stars }).map((_, i) => (
                              <PiStar key={i} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                            )) : null}
                            {h.resort_town && <span className="text-[10px] text-gray-400">{h.resort_town}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-600 hidden sm:table-cell">{h.country ?? '—'}</td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600">{h.agency}</span>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-600 hidden lg:table-cell">{fmtKc(h.min_price)}</td>
                    <td className="px-3 py-3 text-right text-gray-600 hidden lg:table-cell">{h.available_dates ?? 0}</td>
                    <td className="px-4 py-3">
                      {confirm === h.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-red-600 font-medium">Smazat?</span>
                          <button onClick={() => handleDelete(h.id)}
                            className="px-2 py-0.5 bg-red-500 text-white text-[11px] rounded-md font-semibold hover:bg-red-600">Ano</button>
                          <button onClick={() => setConfirm(null)}
                            className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-md font-semibold hover:bg-gray-200">Ne</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirm(h.id)}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-gray-500">
            Strana {page} / {totalPages} · {data?.total.toLocaleString('cs-CZ')} výsledků
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all">
              <PiCaretLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-all">
              <PiCaretRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
