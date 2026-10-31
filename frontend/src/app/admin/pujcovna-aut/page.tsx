'use client'
import { useEffect, useState, useCallback } from 'react'
import { fetchAdminCarDests, createCarDest, updateCarDest, deleteCarDest, type AdminCarDest } from '@/lib/adminApi'
import { PageHead, AddButton, SearchBar, ErrorBox, Loading, EmptyState, Pager, RowActions, Drawer, Field, TextInput, SaveButton } from '@/components/admin/AdminUI'

const LIMIT = 50

type EditState = {
  id: number | null; slug: string; name: string; country: string; country_slug: string
  dc_path: string; dc_search_term: string; popular: boolean; active: boolean
}

const EMPTY: EditState = {
  id: null, slug: '', name: '', country: '', country_slug: '',
  dc_path: '', dc_search_term: '', popular: false, active: true,
}

function autoSlug(name: string) {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function PujcovnaAutAdminPage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ destinations: AdminCarDest[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await fetchAdminCarDests({ q, page, limit: LIMIT })) }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, page])

  useEffect(() => { load() }, [load])

  const set = (patch: Partial<EditState>) => setEdit(prev => prev ? { ...prev, ...patch } : prev)

  const openEdit = (d: AdminCarDest) => setEdit({
    id: d.id, slug: d.slug, name: d.name, country: d.country, country_slug: d.country_slug,
    dc_path: d.dc_path, dc_search_term: d.dc_search_term, popular: d.popular, active: d.active,
  })

  const handleSave = async () => {
    if (!edit) return
    setSaving(true); setError('')
    const body = {
      slug: edit.slug, name: edit.name, country: edit.country, country_slug: edit.country_slug,
      dc_path: edit.dc_path, dc_search_term: edit.dc_search_term, popular: edit.popular, active: edit.active,
    }
    try {
      if (edit.id == null) await createCarDest(body)
      else await updateCarDest(edit.id, body)
      setEdit(null); load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteCarDest(id); load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
  }

  return (
    <div>
      <PageHead
        kicker="Půjčovna aut"
        title="destinace aut"
        sub={data ? `${data.total} vlastních destinací` : undefined}
        action={<AddButton onClick={() => setEdit({ ...EMPTY })}>Přidat destinaci</AddButton>}
      />
      <SearchBar value={q} onChange={v => { setQ(v); setPage(1) }} placeholder="Hledat destinaci, zemi…" />
      <ErrorBox text={error} />

      {loading && !data && <Loading />}
      {data && data.destinations.length === 0 && <EmptyState icon="auto" text="Zatím žádné vlastní destinace." />}
      {data && data.destinations.length > 0 && (
        <div className="z-adm-tablewrap">
          <table className="z-adm-table">
            <thead><tr><th>Destinace</th><th>Slug</th><th>DC search term</th><th>Stav</th><th /></tr></thead>
            <tbody>
              {data.destinations.map(d => (
                <tr key={d.id}>
                  <td><b>{d.name}</b><small>{d.country}</small></td>
                  <td><code className="z-adm-code">{d.slug}</code></td>
                  <td>{d.dc_search_term || <span className="z-data">—</span>}</td>
                  <td>
                    <span className="z-adm-tags">
                      <span className={`z-chip ${d.active ? '' : 'z-chip--warn'}`}>{d.active ? 'Aktivní' : 'Skrytá'}</span>
                      {d.popular && <span className="z-chip z-chip--sky">Populární</span>}
                    </span>
                  </td>
                  <td><RowActions onEdit={() => openEdit(d)} onDelete={() => handleDelete(d.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} />}

      {edit && (
        <Drawer
          title={edit.id == null ? 'Přidat destinaci' : 'Upravit destinaci'}
          onClose={() => setEdit(null)}
          footer={<SaveButton saving={saving} disabled={!edit.name || !edit.slug || !edit.country || !edit.country_slug} onClick={handleSave}>{edit.id == null ? 'Přidat destinaci' : 'Uložit změny'}</SaveButton>}
        >
          <div className="z-adm-grid">
            <Field label="Název" required>
              <TextInput value={edit.name} placeholder="např. Kefalonie"
                onChange={name => set({ name, ...(edit.id == null ? { slug: autoSlug(name) } : {}) })} />
            </Field>
            <Field label="Slug" required hint={`URL: /pujcovna-aut/${edit.slug || '…'}`}>
              <TextInput value={edit.slug} placeholder="kefalonie" onChange={v => set({ slug: v })} />
            </Field>
            <Field label="Země" required>
              <TextInput value={edit.country} placeholder="Řecko"
                onChange={country => set({ country, ...(edit.id == null ? { country_slug: autoSlug(country) } : {}) })} />
            </Field>
            <Field label="Slug země" required>
              <TextInput value={edit.country_slug} placeholder="recko" onChange={v => set({ country_slug: v })} />
            </Field>
            <Field label="DC search term" wide hint="Anglicky, pro našeptávač DiscoverCars">
              <TextInput value={edit.dc_search_term} placeholder="kefalonia airport" onChange={v => set({ dc_search_term: v })} />
            </Field>
            <Field label="DC path" wide hint="Část adresy za discovercars.com/car-hire/">
              <TextInput value={edit.dc_path} placeholder="greece/kefalonia" onChange={v => set({ dc_path: v })} />
            </Field>
          </div>
          <div className="z-adm-checks">
            <label><input type="checkbox" checked={edit.popular} onChange={e => set({ popular: e.target.checked })} /><span>Populární</span></label>
            <label><input type="checkbox" checked={edit.active} onChange={e => set({ active: e.target.checked })} /><span>Aktivní</span></label>
          </div>
        </Drawer>
      )}
    </div>
  )
}
