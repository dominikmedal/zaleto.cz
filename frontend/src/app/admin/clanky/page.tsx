'use client'
import { useEffect, useState, useCallback } from 'react'
import { fetchAdminArticles, fetchAdminArticle, createArticle, updateArticle, deleteArticle, type AdminArticle } from '@/lib/adminApi'
import { PageHead, AddButton, SearchBar, ErrorBox, Loading, EmptyState, Pager, RowActions, Drawer, Field, TextInput, SaveButton, ImageField } from '@/components/admin/AdminUI'

const LIMIT = 50

const fmtDate = (s: string) => new Date(s).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })

type EditState = {
  id: number | null; status: 'published' | 'scheduled' | 'draft'; slug: string; title: string; excerpt: string; content: string
  category: string; location: string; reading_time: string
  custom_image_url: string; custom_image_credit: string; custom_image_credit_url: string
}

const EMPTY: EditState = {
  id: null, status: 'published', slug: '', title: '', excerpt: '', content: '', category: '', location: '', reading_time: '5',
  custom_image_url: '', custom_image_credit: '', custom_image_credit_url: '',
}

export default function ClankyPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ articles: AdminArticle[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [opening, setOpening] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchAdminArticles({ q, page, limit: LIMIT })
      setData({ articles: res.articles, total: res.total })
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, page])

  useEffect(() => { load() }, [load])

  const set = (patch: Partial<EditState>) => setEdit(prev => prev ? { ...prev, ...patch } : prev)

  const openEdit = async (a: AdminArticle) => {
    setOpening(true); setError('')
    try {
      // seznam nevrací obsah, doplníme ho, aby se při uložení nic nepřepsalo
      const full = await fetchAdminArticle(a.id)
      setEdit({
        id: full.id, status: full.status ?? 'published', slug: full.slug, title: full.title, excerpt: full.excerpt ?? '', content: full.content ?? '',
        category: full.category ?? '', location: full.location ?? '', reading_time: String(full.reading_time ?? '5'),
        custom_image_url: full.custom_image_url ?? '', custom_image_credit: full.custom_image_credit ?? '',
        custom_image_credit_url: full.custom_image_credit_url ?? '',
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'Článek se nepodařilo načíst') }
    finally { setOpening(false) }
  }

  const handleSave = async () => {
    if (!edit) return
    setSaving(true); setError('')
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
        status: edit.status,
        custom_image_credit: edit.custom_image_url ? edit.custom_image_credit || null : null,
        custom_image_credit_url: edit.custom_image_url ? edit.custom_image_credit_url || null : null,
      }
      if (edit.id == null) await createArticle(body)
      else await updateArticle(edit.id, body)
      setEdit(null); load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteArticle(id); load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
  }

  return (
    <div>
      <PageHead
        kicker="Obsah"
        title="články"
        sub={data ? `${data.total} článků celkem` : undefined}
        action={<AddButton onClick={() => setEdit({ ...EMPTY })}>Přidat článek</AddButton>}
      />
      <SearchBar value={q} onChange={v => { setQ(v); setPage(1) }} placeholder="Hledat článek…" />
      <ErrorBox text={error} />

      {loading && !data && <Loading />}
      {data && data.articles.length === 0 && <EmptyState text="Žádné články nenalezeny." />}
      {data && data.articles.length > 0 && (
        <div className="z-adm-tablewrap">
          <table className="z-adm-table">
            <thead>
              <tr><th>Článek</th><th>Stav</th><th>Foto</th><th>Datum</th><th /></tr>
            </thead>
            <tbody>
              {data.articles.map(a => (
                <tr key={a.id}>
                  <td>
                    <b>{a.title}</b>
                    {a.location && <small>{a.location}</small>}
                  </td>
                  <td>
                    <span className={`z-chip ${a.status === 'draft' ? 'z-chip--warn' : a.status === 'scheduled' ? 'z-chip--sky' : ''}`}>{a.status === 'draft' ? 'Koncept' : a.status === 'scheduled' ? 'Naplánováno' : 'Zveřejněno'}</span>
                    {a.auto_published && <small> automaticky</small>}
                  </td>
                  <td>
                    {a.custom_image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img className="z-adm-thumb" src={a.custom_image_url} alt="" />
                      : <span className="z-data">—</span>}
                  </td>
                  <td className="z-data" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.status === 'scheduled' && a.scheduled_at ? a.scheduled_at : a.published_at)}</td>
                  <td><RowActions onEdit={() => openEdit(a)} onDelete={() => handleDelete(a.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} />}
      {opening && <div className="z-adm-opening"><Loading /></div>}

      {edit && (
        <Drawer
          title={edit.id == null ? 'Přidat článek' : 'Upravit článek'}
          onClose={() => setEdit(null)}
          footer={<SaveButton saving={saving} disabled={!edit.title} onClick={handleSave}>{edit.id == null ? 'Přidat článek' : 'Uložit změny'}</SaveButton>}
        >
          <div className="z-adm-grid">
            <Field label="Nadpis" required wide><TextInput value={edit.title} onChange={v => set({ title: v })} /></Field>
            <Field label="Perex" wide><TextInput value={edit.excerpt} onChange={v => set({ excerpt: v })} /></Field>
            <Field label="Stav">
              <select value={edit.status} onChange={e => set({ status: e.target.value as EditState['status'] })}>
                <option value="published">Zveřejněno</option><option value="scheduled">Naplánováno</option><option value="draft">Koncept (skryté)</option>
              </select>
            </Field>
            <Field label="Kategorie"><TextInput value={edit.category} onChange={v => set({ category: v })} /></Field>
            <Field label="Lokalita"><TextInput value={edit.location} onChange={v => set({ location: v })} /></Field>
            <Field label="Čas čtení (min)"><TextInput type="number" value={edit.reading_time} onChange={v => set({ reading_time: v })} /></Field>
          </div>

          <ImageField
            label="Titulní obrázek"
            value={edit.custom_image_url}
            credit={edit.custom_image_credit}
            suggest={edit.location || edit.title}
            onChange={img => set(img
              ? { custom_image_url: img.url, custom_image_credit: img.credit ?? '', custom_image_credit_url: img.creditUrl ?? '' }
              : { custom_image_url: '', custom_image_credit: '', custom_image_credit_url: '' })}
          />

          <Field label="Obsah článku" wide hint="Formátování: ## Nadpis, **tučně**, * odrážka">
            <textarea value={edit.content} rows={16} placeholder={'## Úvod\n\nText článku…'} onChange={e => set({ content: e.target.value })} />
          </Field>
        </Drawer>
      )}
    </div>
  )
}
