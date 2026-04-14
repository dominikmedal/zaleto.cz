'use client'
import { useEffect, useState, useCallback } from 'react'
import { fetchAdminTours, createTour, updateTour, deleteTour, AdminTour } from '@/lib/adminApi'
import { PiMagnifyingGlass, PiSpinner, PiTrash, PiPencil, PiPlus, PiCaretLeft, PiCaretRight, PiAirplane, PiX, PiCheckCircle } from 'react-icons/pi'

const LIMIT = 50

const MEAL_LABELS: Record<string, string> = {
  'all-inclusive': 'AI', 'ultra-all-inclusive': 'UAI',
  'polopenze': 'PP', 'plná penze': 'FP', 'snídaně': 'SN', 'bez stravy': 'BS',
}

function fmtKc(n: number) {
  if (n >= 10_000) return `${Math.round(n / 1000)} tis. Kč`
  return `${n.toLocaleString('cs-CZ')} Kč`
}

type EditState = {
  id: number | null; hotel_id: string; agency: string; departure_date: string
  return_date: string; duration: string; price: string; transport: string
  meal_plan: string; adults: string; departure_city: string
}

const EMPTY: EditState = { id: null, hotel_id: '', agency: '', departure_date: '', return_date: '', duration: '', price: '', transport: '', meal_plan: '', adults: '2', departure_city: '' }

const FIELDS: { label: string; key: keyof EditState; required?: boolean; type?: string }[] = [
  { label: 'ID hotelu', key: 'hotel_id', required: true },
  { label: 'Cestovní kancelář', key: 'agency' },
  { label: 'Datum odjezdu (YYYY-MM-DD)', key: 'departure_date', required: true },
  { label: 'Datum návratu (YYYY-MM-DD)', key: 'return_date' },
  { label: 'Délka (dní)', key: 'duration' },
  { label: 'Cena (Kč)', key: 'price', required: true },
  { label: 'Doprava', key: 'transport' },
  { label: 'Stravování', key: 'meal_plan' },
  { label: 'Počet osob', key: 'adults' },
  { label: 'Město odjezdu', key: 'departure_city' },
]

export default function ZajezdyPage() {
  const [q, setQ]             = useState('')
  const [agency, setAgency]   = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<{ tours: AdminTour[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [edit, setEdit]       = useState<EditState | null>(null)
  const [saving, setSaving]   = useState(false)
  const [confirm, setConfirm] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchAdminTours({ q, agency, page, limit: LIMIT })
      setData({ tours: res.tours, total: res.total })
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, agency, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => setEdit({ ...EMPTY })
  const openEdit = (t: AdminTour) => setEdit({
    id: t.id, hotel_id: String(t.hotel_id ?? ''), agency: t.agency,
    departure_date: t.departure_date, return_date: t.return_date ?? '',
    duration: t.duration != null ? String(t.duration) : '',
    price: String(t.price), transport: t.transport ?? '',
    meal_plan: t.meal_plan ?? '', adults: String(t.adults),
    departure_city: t.departure_city ?? '',
  })

  const handleSave = async () => {
    if (!edit) return
    setSaving(true)
    try {
      if (edit.id == null) {
        await createTour({ hotel_id: parseInt(edit.hotel_id), agency: edit.agency || undefined, departure_date: edit.departure_date, return_date: edit.return_date || undefined, duration: edit.duration ? parseInt(edit.duration) : undefined, price: parseFloat(edit.price), transport: edit.transport || undefined, meal_plan: edit.meal_plan || undefined, adults: edit.adults ? parseInt(edit.adults) : 2, departure_city: edit.departure_city || undefined })
      } else {
        await updateTour(edit.id, { departure_date: edit.departure_date || undefined, return_date: edit.return_date || undefined, duration: edit.duration ? parseInt(edit.duration) : undefined, price: edit.price ? parseFloat(edit.price) : undefined, transport: edit.transport || undefined, meal_plan: edit.meal_plan || undefined, adults: edit.adults ? parseInt(edit.adults) : undefined, departure_city: edit.departure_city || undefined, agency: edit.agency || undefined })
      }
      setEdit(null); load()
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteTour(id); setConfirm(null); load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba') }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-800">Zájezdy</h1>
          {data && <p className="text-sm text-gray-500">{data.total.toLocaleString('cs-CZ')} nadcházejících termínů</p>}
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
          <PiPlus className="w-4 h-4" /> Přidat termín
        </button>
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
        {loading && !data && <div className="flex items-center justify-center h-40"><PiSpinner className="w-7 h-7 text-[#0093FF] animate-spin" /></div>}
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
                  <th className="px-4 py-3 w-20"></th>
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
                      <div className="flex items-center gap-1.5"><PiAirplane className="w-3 h-3 text-gray-400" />{t.departure_date}</div>
                      {t.departure_city && <p className="text-[10px] text-gray-400 mt-0.5">{t.departure_city}</p>}
                    </td>
                    <td className="px-3 py-3 text-gray-600 hidden md:table-cell">{t.duration ? `${t.duration} dní` : '—'}</td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {t.meal_plan && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700">{MEAL_LABELS[t.meal_plan.toLowerCase()] ?? t.meal_plan}</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-gray-800">{fmtKc(t.price)}</td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600">{t.agency}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {confirm === t.id ? (
                          <>
                            <button onClick={() => handleDelete(t.id)} className="px-2 py-0.5 bg-red-500 text-white text-[11px] rounded-md font-semibold hover:bg-red-600">Ano</button>
                            <button onClick={() => setConfirm(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-md font-semibold hover:bg-gray-200">Ne</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(t)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#0093FF] hover:bg-blue-50 transition-colors"><PiPencil className="w-4 h-4" /></button>
                            <button onClick={() => setConfirm(t.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><PiTrash className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
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
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40"><PiCaretLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40"><PiCaretRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Drawer */}
      {edit && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEdit(null)} />
          <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{edit.id == null ? 'Přidat termín' : 'Upravit termín'}</h2>
              <button onClick={() => setEdit(null)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100"><PiX className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              {FIELDS.map(({ label, key, required }) => (
                <div key={key}>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
                  <input type="text" value={edit[key] as string} onChange={e => setEdit(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-50">Zrušit</button>
              <button onClick={handleSave} disabled={saving || (!edit.hotel_id && edit.id == null) || !edit.departure_date || !edit.price}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
                {saving ? <PiSpinner className="w-4 h-4 animate-spin" /> : <PiCheckCircle className="w-4 h-4" />}
                {edit.id == null ? 'Přidat' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
