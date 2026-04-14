'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { fetchAdminDests, updateDest, uploadImage, AdminDest } from '@/lib/adminApi'
import {
  PiMagnifyingGlass, PiSpinner, PiPencil, PiCaretLeft, PiCaretRight,
  PiUploadSimple, PiCheckCircle, PiX, PiImage, PiRobot, PiPlus
} from 'react-icons/pi'

const LIMIT = 50
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface EditState { name: string; photo_url: string; isNew?: boolean }

export default function DestinacePage() {
  const [q,        setQ]        = useState('')
  const [page,     setPage]     = useState(1)
  const [data,     setData]     = useState<{ destinations: AdminDest[]; total: number } | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [edit,     setEdit]     = useState<EditState | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [uploading,setUploading]= useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchAdminDests({ q, page, limit: LIMIT })
      setData({ destinations: res.destinations, total: res.total })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Chyba')
    } finally { setLoading(false) }
  }, [q, page])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!edit) return
    setSaving(true)
    try {
      await updateDest(edit.name, edit.photo_url)
      setEdit(null)
      load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Chyba')
    } finally { setSaving(false) }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const { url } = await uploadImage(file)
      if (edit) setEdit(prev => prev ? { ...prev, photo_url: url } : prev)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Chyba uploadu')
    } finally { setUploading(false) }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-gray-800">Destinace</h1>
          {data && <p className="text-sm text-gray-500">{data.total} destinací celkem</p>}
        </div>
        <button onClick={() => setEdit({ name: '', photo_url: '', isNew: true })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
          <PiPlus className="w-4 h-4" /> Přidat destinaci
        </button>
      </div>

      <div className="relative max-w-md">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Hledat destinaci..." value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 transition-all" />
      </div>

      {error && <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading && !data && (
          <div className="flex items-center justify-center h-40"><PiSpinner className="w-7 h-7 text-[#0093FF] animate-spin" /></div>
        )}
        {data && (
          <div className="grid grid-cols-1 divide-y divide-gray-50">
            {data.destinations.map(d => (
              <div key={d.name} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                {/* Thumb */}
                <div className="flex-shrink-0 w-16 h-11 rounded-xl overflow-hidden bg-blue-50">
                  {d.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photo_url.startsWith('/uploads/') ? `${API}${d.photo_url}` : d.photo_url}
                      alt={d.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PiImage className="w-5 h-5 text-blue-200" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{d.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {d.has_ai && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        <PiRobot className="w-3 h-3" /> AI popis
                      </span>
                    )}
                    {!d.photo_url && (
                      <span className="text-[10px] text-red-500 font-medium">Chybí foto</span>
                    )}
                  </div>
                </div>

                <button onClick={() => setEdit({ name: d.name, photo_url: d.photo_url ?? '' })}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#0093FF] hover:bg-blue-50 transition-colors flex-shrink-0">
                  <PiPencil className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-gray-500">Strana {page} / {totalPages}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <PiCaretLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40">
              <PiCaretRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {edit && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEdit(null)} />
          <div className="relative ml-auto w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-800">{edit.isNew ? 'Přidat destinaci' : 'Upravit destinaci'}</h2>
              <button onClick={() => setEdit(null)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100">
                <PiX className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Název destinace<span className="text-red-400 ml-0.5">*</span>
                </label>
                {edit.isNew ? (
                  <input type="text" value={edit.name}
                    onChange={e => setEdit(prev => prev ? { ...prev, name: e.target.value } : prev)}
                    placeholder="např. Řecko"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8" />
                ) : (
                  <p className="font-semibold text-gray-800">{edit.name}</p>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Obrázek</p>
                {edit.photo_url ? (
                  <div className="relative rounded-xl overflow-hidden mb-3" style={{ aspectRatio: '16/9', maxHeight: 200 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={edit.photo_url.startsWith('/uploads/') ? `${API}${edit.photo_url}` : edit.photo_url}
                      alt={edit.name} className="w-full h-full object-cover" />
                    <button onClick={() => setEdit(prev => prev ? { ...prev, photo_url: '' } : prev)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
                      <PiX className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-3 mb-3">
                    <PiImage className="w-10 h-10 text-gray-200" />
                    <p className="text-[12px] text-gray-400">Žádný obrázek</p>
                  </div>
                )}

                {/* URL input */}
                <input type="text" placeholder="URL obrázku..." value={edit.photo_url}
                  onChange={e => setEdit(prev => prev ? { ...prev, photo_url: e.target.value } : prev)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/8 mb-2" />

                {/* Upload */}
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-all">
                  {uploading ? <PiSpinner className="w-4 h-4 animate-spin" /> : <PiUploadSimple className="w-4 h-4" />}
                  Nahrát z počítače
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEdit(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-[13px] font-semibold text-gray-600 hover:bg-gray-50">Zrušit</button>
              <button onClick={handleSave} disabled={saving || !edit.photo_url || (!!edit.isNew && !edit.name.trim())}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
                {saving ? <PiSpinner className="w-4 h-4 animate-spin" /> : <PiCheckCircle className="w-4 h-4" />}
                {edit.isNew ? 'Přidat' : 'Uložit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
