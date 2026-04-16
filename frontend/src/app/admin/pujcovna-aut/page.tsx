'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  fetchAdminCarDests, createCarDest, updateCarDest, deleteCarDest,
  AdminCarDest,
} from '@/lib/adminApi'
import {
  PiMagnifyingGlass, PiSpinner, PiTrash, PiPencil, PiPlus,
  PiCaretLeft, PiCaretRight, PiX, PiCheckCircle, PiCar,
} from 'react-icons/pi'

const LIMIT = 50

type EditState = {
  id: number | null
  slug: string
  name: string
  country: string
  country_slug: string
  dc_path: string
  dc_search_term: string
  popular: boolean
  active: boolean
}

const EMPTY: EditState = {
  id: null, slug: '', name: '', country: '', country_slug: '',
  dc_path: '', dc_search_term: '', popular: false, active: true,
}

function autoSlug(name: string) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function autoCountrySlug(country: string) {
  return autoSlug(country)
}

export default function PujcovnaAutAdminPage() {
  const [q, setQ]             = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<{ destinations: AdminCarDest[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [edit, setEdit]       = useState<EditState | null>(null)
  const [saving, setSaving]   = useState(false)
  const [confirm, setConfirm] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchAdminCarDests({ q, page, limit: LIMIT })
      setData(res)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => setEdit({ ...EMPTY })
  const openEdit   = (d: AdminCarDest) => setEdit({
    id: d.id, slug: d.slug, name: d.name, country: d.country,
    country_slug: d.country_slug, dc_path: d.dc_path,
    dc_search_term: d.dc_search_term, popular: d.popular, active: d.active,
  })

  const handleSave = async () => {
    if (!edit) return
    setSaving(true)
    try {
      if (edit.id == null) {
        await createCarDest({
          slug: edit.slug, name: edit.name, country: edit.country,
          country_slug: edit.country_slug, dc_path: edit.dc_path,
          dc_search_term: edit.dc_search_term, popular: edit.popular, active: edit.active,
        })
      } else {
        await updateCarDest(edit.id, {
          slug: edit.slug, name: edit.name, country: edit.country,
          country_slug: edit.country_slug, dc_path: edit.dc_path,
          dc_search_term: edit.dc_search_term, popular: edit.popular, active: edit.active,
        })
      }
      setEdit(null); load()
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteCarDest(id); setConfirm(null); load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba') }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-800">Půjčovna aut — destinace</h1>
          {data && <p className="text-sm text-gray-500">{data.total} vlastních destinací</p>}
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
          <PiPlus className="w-4 h-4" /> Přidat destinaci
        </button>
      </div>

      <div className="relative max-w-sm">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hledat destinaci, zemi..." value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 transition-all" />
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading && !data && <div className="flex items-center justify-center h-40"><PiSpinner className="w-7 h-7 text-[#0093FF] animate-spin" /></div>}
        {data && data.destinations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
            <PiCar className="w-10 h-10 opacity-30" />
            <p className="text-sm">Zatím žádné vlastní destinace</p>
          </div>
        )}
        {data && data.destinations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Destinace</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden sm:table-cell">Slug</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden md:table-cell">DC search term</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden lg:table-cell">Aktivní</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden lg:table-cell">Popular</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.destinations.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{d.name}</p>
                      <p className="text-[11px] text-gray-400">{d.country}</p>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <span className="font-mono text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">{d.slug}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-500 hidden md:table-cell">{d.dc_search_term || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                      <span className={`inline-block w-2 h-2 rounded-full ${d.active ? 'bg-green-400' : 'bg-gray-200'}`} />
                    </td>
                    <td className="px-3 py-3 text-center hidden lg:table-cell">
                      {d.popular ? <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">popular</span> : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {confirm === d.id ? (
                          <>
                            <button onClick={() => handleDelete(d.id)} className="px-2 py-0.5 bg-red-500 text-white text-[11px] rounded-md font-semibold hover:bg-red-600">Ano</button>
                            <button onClick={() => setConfirm(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-md font-semibold hover:bg-gray-200">Ne</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(d)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#0093FF] hover:bg-blue-50 transition-colors">
                              <PiPencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setConfirm(d.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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

      {/* Drawer */}
      {edit && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEdit(null)} />
          <div className="relative ml-auto w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{edit.id == null ? 'Přidat destinaci' : 'Upravit destinaci'}</h2>
              <button onClick={() => setEdit(null)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100">
                <PiX className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-4">

              {/* Name */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Název <span className="text-red-400">*</span>
                </label>
                <input type="text" value={edit.name}
                  onChange={e => {
                    const name = e.target.value
                    setEdit(prev => prev ? {
                      ...prev, name,
                      slug: prev.id == null ? autoSlug(name) : prev.slug,
                    } : prev)
                  }}
                  placeholder="např. Kefalonie"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Slug <span className="text-red-400">*</span>
                  <span className="normal-case font-normal ml-1 text-gray-400">(URL: /pujcovna-aut/<strong>{edit.slug || '...'}</strong>)</span>
                </label>
                <input type="text" value={edit.slug}
                  onChange={e => setEdit(prev => prev ? { ...prev, slug: e.target.value } : prev)}
                  placeholder="kefalonie"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-mono outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
              </div>

              {/* Country */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Země <span className="text-red-400">*</span>
                </label>
                <input type="text" value={edit.country}
                  onChange={e => {
                    const country = e.target.value
                    setEdit(prev => prev ? {
                      ...prev, country,
                      country_slug: prev.id == null ? autoCountrySlug(country) : prev.country_slug,
                    } : prev)
                  }}
                  placeholder="Řecko"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
              </div>

              {/* Country slug */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Slug země
                </label>
                <input type="text" value={edit.country_slug}
                  onChange={e => setEdit(prev => prev ? { ...prev, country_slug: e.target.value } : prev)}
                  placeholder="recko"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-mono outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
              </div>

              {/* DC search term */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  DC search term
                  <span className="normal-case font-normal ml-1 text-gray-400">(anglicky, pro autocomplete)</span>
                </label>
                <input type="text" value={edit.dc_search_term}
                  onChange={e => setEdit(prev => prev ? { ...prev, dc_search_term: e.target.value } : prev)}
                  placeholder="kefalonia airport"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
              </div>

              {/* DC path */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  DC path
                  <span className="normal-case font-normal ml-1 text-gray-400">(za discovercars.com/car-hire/)</span>
                </label>
                <input type="text" value={edit.dc_path}
                  onChange={e => setEdit(prev => prev ? { ...prev, dc_path: e.target.value } : prev)}
                  placeholder="greece/kefalonia"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-mono outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={edit.popular}
                    onChange={e => setEdit(prev => prev ? { ...prev, popular: e.target.checked } : prev)}
                    className="w-4 h-4 rounded accent-[#0093FF]" />
                  <span className="text-[13px] text-gray-700 font-medium">Populární</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={edit.active}
                    onChange={e => setEdit(prev => prev ? { ...prev, active: e.target.checked } : prev)}
                    className="w-4 h-4 rounded accent-[#0093FF]" />
                  <span className="text-[13px] text-gray-700 font-medium">Aktivní</span>
                </label>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEdit(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
                Zrušit
              </button>
              <button onClick={handleSave} disabled={saving || !edit.name || !edit.slug || !edit.country || !edit.country_slug}
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
