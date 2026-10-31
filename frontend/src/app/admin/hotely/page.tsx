'use client'
import { useEffect, useState, useCallback } from 'react'
import { fetchAdminHotels, createHotel, updateHotel, deleteHotel, type AdminHotel } from '@/lib/adminApi'
import Icon from '@/components/ui/Icon'
import { PageHead, AddButton, SearchBar, ErrorBox, Loading, EmptyState, Pager, RowActions, Drawer, Field, TextInput, SaveButton, ImageField } from '@/components/admin/AdminUI'

const LIMIT = 50

function fmtKc(n: number | null) {
  if (n == null) return '—'
  if (n >= 10_000) return `${Math.round(n / 1000)} tis. Kč`
  return `${n.toLocaleString('cs-CZ')} Kč`
}

type EditState = { id: number | null; name: string; agency: string; country: string; destination: string; resort_town: string; stars: string; thumbnail_url: string; description: string }

const EMPTY: EditState = { id: null, name: '', agency: '', country: '', destination: '', resort_town: '', stars: '', thumbnail_url: '', description: '' }

export default function HotelyPage() {
  const [q, setQ] = useState('')
  const [agency, setAgency] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ hotels: AdminHotel[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchAdminHotels({ q, agency, page, limit: LIMIT })
      setData({ hotels: res.hotels, total: res.total })
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, agency, page])

  useEffect(() => { load() }, [load])

  const set = (patch: Partial<EditState>) => setEdit(prev => prev ? { ...prev, ...patch } : prev)

  const openEdit = (h: AdminHotel) => setEdit({
    id: h.id, name: h.name, agency: h.agency, country: h.country ?? '',
    destination: h.destination ?? '', resort_town: h.resort_town ?? '',
    stars: h.stars != null ? String(h.stars) : '', thumbnail_url: h.thumbnail_url ?? '', description: '',
  })

  const handleSave = async () => {
    if (!edit) return
    setSaving(true); setError('')
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteHotel(id); load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
  }

  return (
    <div>
      <PageHead
        kicker="Nabídka"
        title="hotely"
        sub={data ? `${data.total.toLocaleString('cs-CZ')} hotelů celkem` : undefined}
        action={<AddButton onClick={() => setEdit({ ...EMPTY })}>Přidat hotel</AddButton>}
      />
      <SearchBar value={q} onChange={v => { setQ(v); setPage(1) }} placeholder="Hledat hotel, zemi…">
        <label className="z-adm-search" style={{ maxWidth: 220, flex: 'none' }}>
          <Icon name="agentura" />
          <input type="text" value={agency} placeholder="Cestovní kancelář" onChange={e => { setAgency(e.target.value); setPage(1) }} />
        </label>
      </SearchBar>
      <ErrorBox text={error} />

      {loading && !data && <Loading />}
      {data && data.hotels.length === 0 && <EmptyState icon="hotel" text="Žádné hotely nenalezeny." />}
      {data && data.hotels.length > 0 && (
        <div className="z-adm-tablewrap">
          <table className="z-adm-table">
            <thead>
              <tr><th>Hotel</th><th>Země</th><th>CK</th><th style={{ textAlign: 'right' }}>Min. cena</th><th style={{ textAlign: 'right' }}>Termíny</th><th /></tr>
            </thead>
            <tbody>
              {data.hotels.map(h => (
                <tr key={h.id}>
                  <td>
                    <div className="z-adm-cell">
                      {h.thumbnail_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img className="z-adm-thumb" src={h.thumbnail_url} alt="" />
                        : <span className="z-adm-thumb z-adm-thumb--empty" />}
                      <div style={{ minWidth: 0 }}>
                        <b>{h.name}</b>
                        <small>
                          {h.stars ? '★'.repeat(h.stars) : ''}{h.stars && h.resort_town ? ' · ' : ''}{h.resort_town}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{h.country ?? '—'}</td>
                  <td><span className="z-chip z-chip--sky">{h.agency}</span></td>
                  <td className="z-adm-num">{fmtKc(h.min_price)}</td>
                  <td className="z-adm-num">{h.available_dates ?? 0}</td>
                  <td><RowActions onEdit={() => openEdit(h)} onDelete={() => handleDelete(h.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} />}

      {edit && (
        <Drawer
          title={edit.id == null ? 'Přidat hotel' : 'Upravit hotel'}
          onClose={() => setEdit(null)}
          footer={<SaveButton saving={saving} disabled={!edit.name} onClick={handleSave}>{edit.id == null ? 'Přidat hotel' : 'Uložit změny'}</SaveButton>}
        >
          <div className="z-adm-grid">
            <Field label="Název hotelu" required wide><TextInput value={edit.name} onChange={v => set({ name: v })} /></Field>
            <Field label="Cestovní kancelář"><TextInput value={edit.agency} onChange={v => set({ agency: v })} /></Field>
            <Field label="Počet hvězd (1–5)"><TextInput type="number" value={edit.stars} onChange={v => set({ stars: v })} /></Field>
            <Field label="Země"><TextInput value={edit.country} onChange={v => set({ country: v })} /></Field>
            <Field label="Destinace"><TextInput value={edit.destination} onChange={v => set({ destination: v })} /></Field>
            <Field label="Letovisko" wide><TextInput value={edit.resort_town} onChange={v => set({ resort_town: v })} /></Field>
          </div>

          <ImageField
            label="Obrázek hotelu"
            value={edit.thumbnail_url}
            unsplash={false}
            onChange={img => set({ thumbnail_url: img?.url ?? '' })}
          />
          <Field label="nebo URL obrázku" wide><TextInput value={edit.thumbnail_url} onChange={v => set({ thumbnail_url: v })} placeholder="https://…" /></Field>

          <Field label="Popis hotelu" wide>
            <textarea value={edit.description} rows={5} onChange={e => set({ description: e.target.value })} />
          </Field>
        </Drawer>
      )}
    </div>
  )
}
