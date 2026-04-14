'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { fetchAdminHotels, createHotel, updateHotel, deleteHotel, uploadImage, AdminHotel } from '@/lib/adminApi'
import { PiMagnifyingGlass, PiSpinner, PiTrash, PiPencil, PiPlus, PiCaretLeft, PiCaretRight, PiStar, PiX, PiCheckCircle, PiUploadSimple, PiImage } from 'react-icons/pi'

const LIMIT = 50
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function fmtKc(n: number | null) {
  if (n == null) return '—'
  if (n >= 10_000) return `${Math.round(n / 1000)} tis. Kč`
  return `${n.toLocaleString('cs-CZ')} Kč`
}

type EditState = { id: number | null; name: string; agency: string; country: string; destination: string; resort_town: string; stars: string; thumbnail_url: string; description: string }

const EMPTY: EditState = { id: null, name: '', agency: '', country: '', destination: '', resort_town: '', stars: '', thumbnail_url: '', description: '' }

const FIELDS: { label: string; key: keyof EditState; required?: boolean }[] = [
  { label: 'Název hotelu', key: 'name', required: true },
  { label: 'Cestovní kancelář', key: 'agency' },
  { label: 'Země', key: 'country' },
  { label: 'Destinace', key: 'destination' },
  { label: 'Letovisko', key: 'resort_town' },
  { label: 'Počet hvězd (1–5)', key: 'stars' },
  { label: 'URL obrázku', key: 'thumbnail_url' },
]

export default function HotelyPage() {
  const [q, setQ]             = useState('')
  const [agency, setAgency]   = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<{ hotels: AdminHotel[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [edit, setEdit]       = useState<EditState | null>(null)
  const [saving, setSaving]   = useState(false)
  const [confirm, setConfirm] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchAdminHotels({ q, agency, page, limit: LIMIT })
      setData({ hotels: res.hotels, total: res.total })
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, agency, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => setEdit({ ...EMPTY })
  const openEdit = (h: AdminHotel) => setEdit({
    id: h.id, name: h.name, agency: h.agency, country: h.country ?? '',
    destination: h.destination ?? '', resort_town: h.resort_town ?? '',
    stars: h.stars != null ? String(h.stars) : '', thumbnail_url: h.thumbnail_url ?? '',
    description: '',
  })

  const handleSave = async () => {
    if (!edit) return
    setSaving(true)
    try {
      const body = {
        name: edit.name || undefined,
        agency: edit.agency || undefined,
        country: edit.country || undefined,
        destination: edit.destination || undefined,
        resort_town: edit.resort_town || undefined,
        stars: edit.stars ? parseInt(edit.stars) : undefined,
        thumbnail_url: edit.thumbnail_url || undefined,
        description: edit.description || undefined,
      }
      if (edit.id == null) await createHotel(body)
      else await updateHotel(edit.id, body)
      setEdit(null); load()
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteHotel(id); setConfirm(null); load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba') }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await uploadImage(file)
      if (edit) setEdit(prev => prev ? { ...prev, thumbnail_url: url } : prev)
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba uploadu') }
    finally { setUploading(false) }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-800">Hotely</h1>
          {data && <p className="text-sm text-gray-500">{data.total.toLocaleString('cs-CZ')} hotelů celkem</p>}
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
          <PiPlus className="w-4 h-4" /> Přidat hotel
        </button>
      </div>

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

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading && !data && <div className="flex items-center justify-center h-40"><PiSpinner className="w-7 h-7 text-[#0093FF] animate-spin" /></div>}
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
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.hotels.map(h => (
                  <tr key={h.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {h.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={h.thumbnail_url.startsWith('/uploads/') ? `${API}${h.thumbnail_url}` : h.thumbnail_url}
                            alt="" className="w-10 h-7 rounded-lg object-cover flex-shrink-0" />
                        ) : <div className="w-10 h-7 rounded-lg bg-blue-50 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate max-w-[200px]">{h.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {h.stars ? Array.from({ length: h.stars }).map((_, i) => <PiStar key={i} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />) : null}
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
                      <div className="flex items-center gap-1 justify-end">
                        {confirm === h.id ? (
                          <>
                            <button onClick={() => handleDelete(h.id)} className="px-2 py-0.5 bg-red-500 text-white text-[11px] rounded-md font-semibold hover:bg-red-600">Ano</button>
                            <button onClick={() => setConfirm(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-md font-semibold hover:bg-gray-200">Ne</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(h)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#0093FF] hover:bg-blue-50 transition-colors">
                              <PiPencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setConfirm(h.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <PiTrash className="w-4 h-4" />
                            </button>
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
              <h2 className="font-bold text-gray-800">{edit.id == null ? 'Přidat hotel' : 'Upravit hotel'}</h2>
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

              {/* Thumbnail upload */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Obrázek hotelu</label>
                {edit.thumbnail_url ? (
                  <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: '16/9', maxHeight: 160 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={edit.thumbnail_url.startsWith('/uploads/') ? `${API}${edit.thumbnail_url}` : edit.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setEdit(prev => prev ? { ...prev, thumbnail_url: '' } : prev)} className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70">
                      <PiX className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-3 mb-2">
                    <PiImage className="w-7 h-7 text-gray-200" /><p className="text-[12px] text-gray-400">Žádný obrázek</p>
                  </div>
                )}
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-xl text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  {uploading ? <PiSpinner className="w-4 h-4 animate-spin" /> : <PiUploadSimple className="w-4 h-4" />} Nahrát z počítače
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Popis hotelu</label>
                <textarea value={edit.description} onChange={e => setEdit(prev => prev ? { ...prev, description: e.target.value } : prev)} rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-50">Zrušit</button>
              <button onClick={handleSave} disabled={saving || !edit.name}
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
