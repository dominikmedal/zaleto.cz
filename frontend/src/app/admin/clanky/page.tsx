'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { fetchAdminArticles, createArticle, updateArticle, deleteArticle, uploadImage, AdminArticle } from '@/lib/adminApi'
import { PiMagnifyingGlass, PiSpinner, PiTrash, PiPencil, PiPlus, PiCaretLeft, PiCaretRight, PiUploadSimple, PiCheckCircle, PiX, PiImage } from 'react-icons/pi'

const LIMIT = 50
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

type EditState = {
  id: number | null; slug: string; title: string; excerpt: string
  content: string; category: string; location: string
  reading_time: string; custom_image_url: string
}

const EMPTY: EditState = { id: null, slug: '', title: '', excerpt: '', content: '', category: '', location: '', reading_time: '5', custom_image_url: '' }

const META_FIELDS: { label: string; key: keyof EditState; required?: boolean }[] = [
  { label: 'Nadpis', key: 'title', required: true },
  { label: 'Perex', key: 'excerpt' },
  { label: 'Kategorie', key: 'category' },
  { label: 'Lokalita', key: 'location' },
  { label: 'Čas čtení (min)', key: 'reading_time' },
]

export default function ClankyPage() {
  const [q, setQ]             = useState('')
  const [page, setPage]       = useState(1)
  const [data, setData]       = useState<{ articles: AdminArticle[]; total: number } | null>(null)
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
      const res = await fetchAdminArticles({ q, page, limit: LIMIT })
      setData({ articles: res.articles, total: res.total })
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, page])

  useEffect(() => { load() }, [load])

  const openCreate = () => setEdit({ ...EMPTY })
  const openEdit = (a: AdminArticle) => setEdit({
    id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt ?? '',
    content: a.content ?? '', category: a.category ?? '', location: a.location ?? '',
    reading_time: String(a.reading_time ?? '5'),
    custom_image_url: a.custom_image_url ?? '',
  })

  const handleSave = async () => {
    if (!edit) return
    setSaving(true)
    try {
      const body = {
        slug: edit.slug || undefined,
        title: edit.title || undefined,
        excerpt: edit.excerpt || undefined,
        content: edit.content || undefined,
        category: edit.category || undefined,
        location: edit.location || undefined,
        reading_time: edit.reading_time ? parseInt(edit.reading_time) : undefined,
        custom_image_url: edit.custom_image_url || null,
      }
      if (edit.id == null) await createArticle(body)
      else await updateArticle(edit.id, body)
      setEdit(null); load()
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteArticle(id); setConfirm(null); load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba') }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await uploadImage(file)
      if (edit) setEdit(prev => prev ? { ...prev, custom_image_url: url } : prev)
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Chyba uploadu') }
    finally { setUploading(false) }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-800">Články</h1>
          {data && <p className="text-sm text-gray-500">{data.total} článků celkem</p>}
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
          <PiPlus className="w-4 h-4" /> Přidat článek
        </button>
      </div>

      <div className="relative max-w-md">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hledat článek..." value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 transition-all" />
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading && !data && <div className="flex items-center justify-center h-40"><PiSpinner className="w-7 h-7 text-[#0093FF] animate-spin" /></div>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Článek</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden md:table-cell">Kategorie</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden lg:table-cell">Foto</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide hidden sm:table-cell">Datum</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.articles.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800 truncate max-w-[260px]">{a.title}</p>
                      {a.location && <p className="text-[11px] text-gray-400">{a.location}</p>}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {a.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">{a.category}</span>}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      {a.custom_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.custom_image_url.startsWith('/uploads/') ? `${API}${a.custom_image_url}` : a.custom_image_url}
                          alt="" className="w-14 h-9 rounded-lg object-cover" />
                      ) : <span className="text-[11px] text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 hidden sm:table-cell whitespace-nowrap">{fmtDate(a.published_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {confirm === a.id ? (
                          <>
                            <button onClick={() => handleDelete(a.id)} className="px-2 py-0.5 bg-red-500 text-white text-[11px] rounded-md font-semibold hover:bg-red-600">Ano</button>
                            <button onClick={() => setConfirm(null)} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] rounded-md font-semibold hover:bg-gray-200">Ne</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(a)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#0093FF] hover:bg-blue-50 transition-colors"><PiPencil className="w-4 h-4" /></button>
                            <button onClick={() => setConfirm(a.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><PiTrash className="w-4 h-4" /></button>
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
          <div className="relative ml-auto w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{edit.id == null ? 'Přidat článek' : 'Upravit článek'}</h2>
              <button onClick={() => setEdit(null)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100"><PiX className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              {/* Meta fields */}
              <div className="grid grid-cols-2 gap-4">
                {META_FIELDS.map(({ label, key, required }) => (
                  <div key={key} className={key === 'title' || key === 'excerpt' ? 'col-span-2' : ''}>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
                    <input type="text" value={edit[key] as string}
                      onChange={e => setEdit(prev => prev ? { ...prev, [key]: e.target.value } : prev)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
                  </div>
                ))}
              </div>

              {/* Image */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Vlastní obrázek</label>
                {edit.custom_image_url ? (
                  <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: '16/9', maxHeight: 160 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={edit.custom_image_url.startsWith('/uploads/') ? `${API}${edit.custom_image_url}` : edit.custom_image_url} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setEdit(prev => prev ? { ...prev, custom_image_url: '' } : prev)} className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70"><PiX className="w-3.5 h-3.5 text-white" /></button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex items-center gap-3 mb-2">
                    <PiImage className="w-7 h-7 text-gray-200" /><p className="text-[12px] text-gray-400">Žádný obrázek</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" placeholder="URL obrázku..." value={edit.custom_image_url}
                    onChange={e => setEdit(prev => prev ? { ...prev, custom_image_url: e.target.value } : prev)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-[12px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    {uploading ? <PiSpinner className="w-4 h-4 animate-spin" /> : <PiUploadSimple className="w-4 h-4" />} Nahrát
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </div>

              {/* Content */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Obsah článku</label>
                <p className="text-[11px] text-gray-400 mb-1.5">Formátování: <code className="bg-gray-100 px-1 rounded">## Nadpis</code>, <code className="bg-gray-100 px-1 rounded">**tučně**</code>, <code className="bg-gray-100 px-1 rounded">* odrážka</code></p>
                <textarea value={edit.content}
                  onChange={e => setEdit(prev => prev ? { ...prev, content: e.target.value } : prev)}
                  rows={16} placeholder="## Úvod&#10;&#10;Text článku..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] font-mono outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 resize-y" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-50">Zrušit</button>
              <button onClick={handleSave} disabled={saving || !edit.title}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
                {saving ? <PiSpinner className="w-4 h-4 animate-spin" /> : <PiCheckCircle className="w-4 h-4" />}
                {edit.id == null ? 'Přidat článek' : 'Uložit změny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
