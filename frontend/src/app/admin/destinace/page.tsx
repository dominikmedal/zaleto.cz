'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { fetchAdminDests, updateDest, type AdminDest } from '@/lib/adminApi'
import Icon from '@/components/ui/Icon'
import { PageHead, AddButton, SearchBar, ErrorBox, Loading, EmptyState, Pager, RowActions, Drawer, Field, TextInput, SaveButton, ImageField } from '@/components/admin/AdminUI'

const LIMIT = 50

interface EditState { name: string; photo_url: string; isNew?: boolean }

export default function DestinacePage() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ destinations: AdminDest[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchAdminDests({ q, page, limit: LIMIT })
      setData({ destinations: res.destinations, total: res.total })
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, page])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!edit) return
    setSaving(true); setError('')
    try { await updateDest(edit.name, edit.photo_url); setEdit(null); load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <PageHead
        kicker="Obsah"
        title="destinace"
        sub={data ? `${data.total} destinací celkem` : undefined}
        action={<AddButton onClick={() => setEdit({ name: '', photo_url: '', isNew: true })}>Přidat destinaci</AddButton>}
      />
      <SearchBar value={q} onChange={v => { setQ(v); setPage(1) }} placeholder="Hledat destinaci…">
        <Link href="/admin/fotky" className="z-btn z-btn--line z-btn--sm" style={{ alignSelf: 'center' }}>
          Fotky z Unsplash<span className="z-btn__go"><Icon name="foto" /></span>
        </Link>
      </SearchBar>
      <ErrorBox text={error} />

      {loading && !data && <Loading />}
      {data && data.destinations.length === 0 && <EmptyState icon="poloha" text="Žádné destinace nenalezeny." />}
      {data && data.destinations.length > 0 && (
        <div className="z-adm-tablewrap">
          <table className="z-adm-table">
            <thead><tr><th>Destinace</th><th>Stav</th><th /></tr></thead>
            <tbody>
              {data.destinations.map(d => (
                <tr key={d.name}>
                  <td>
                    <div className="z-adm-cell">
                      {d.photo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img className="z-adm-thumb" src={d.photo_url} alt={d.name} />
                        : <span className="z-adm-thumb z-adm-thumb--empty"><Icon name="foto" size="sm" /></span>}
                      <b>{d.name}</b>
                    </div>
                  </td>
                  <td>
                    <span className="z-adm-tags">
                      {d.has_ai && <span className="z-chip z-chip--sky">AI popis</span>}
                      {!d.photo_url && <span className="z-chip z-chip--warn">Chybí foto</span>}
                    </span>
                  </td>
                  <td><RowActions onEdit={() => setEdit({ name: d.name, photo_url: d.photo_url ?? '' })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} />}

      {edit && (
        <Drawer
          title={edit.isNew ? 'Přidat destinaci' : 'Upravit destinaci'}
          onClose={() => setEdit(null)}
          footer={<SaveButton saving={saving} disabled={!edit.photo_url || (!!edit.isNew && !edit.name.trim())} onClick={handleSave}>{edit.isNew ? 'Přidat destinaci' : 'Uložit změny'}</SaveButton>}
        >
          {edit.isNew
            ? <Field label="Název destinace" required wide><TextInput value={edit.name} onChange={v => setEdit(p => p ? { ...p, name: v } : p)} placeholder="např. Řecko" /></Field>
            : <h3 className="h3" style={{ margin: 0 }}>{edit.name}<span className="z-dot">.</span></h3>}
          <ImageField
            label="Obrázek"
            value={edit.photo_url}
            unsplash={false}
            onChange={img => setEdit(p => p ? { ...p, photo_url: img?.url ?? '' } : p)}
          />
          <Field label="nebo URL obrázku" wide><TextInput value={edit.photo_url} onChange={v => setEdit(p => p ? { ...p, photo_url: v } : p)} placeholder="https://…" /></Field>
          <p className="z-data" style={{ textTransform: 'none', margin: 0 }}>
            Fotky z Unsplash (včetně uvedení autora) se vybírají v sekci <Link href="/admin/fotky" className="z-more">Fotky destinací</Link>.
          </p>
        </Drawer>
      )}
    </div>
  )
}
