'use client'
import { useEffect, useState, useCallback } from 'react'
import { fetchAdminTours, createTour, updateTour, deleteTour, type AdminTour } from '@/lib/adminApi'
import Icon from '@/components/ui/Icon'
import { PageHead, AddButton, SearchBar, ErrorBox, Loading, EmptyState, Pager, RowActions, Drawer, Field, TextInput, SaveButton } from '@/components/admin/AdminUI'

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

export default function ZajezdyPage() {
  const [q, setQ] = useState('')
  const [agency, setAgency] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ tours: AdminTour[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetchAdminTours({ q, agency, page, limit: LIMIT })
      setData({ tours: res.tours, total: res.total })
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setLoading(false) }
  }, [q, agency, page])

  useEffect(() => { load() }, [load])

  const set = (patch: Partial<EditState>) => setEdit(prev => prev ? { ...prev, ...patch } : prev)

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
    setSaving(true); setError('')
    try {
      if (edit.id == null) {
        await createTour({
          hotel_id: parseInt(edit.hotel_id), agency: edit.agency || undefined, departure_date: edit.departure_date,
          return_date: edit.return_date || undefined, duration: edit.duration ? parseInt(edit.duration) : undefined,
          price: parseFloat(edit.price), transport: edit.transport || undefined, meal_plan: edit.meal_plan || undefined,
          adults: edit.adults ? parseInt(edit.adults) : 2, departure_city: edit.departure_city || undefined,
        })
      } else {
        await updateTour(edit.id, {
          departure_date: edit.departure_date || undefined, return_date: edit.return_date || undefined,
          duration: edit.duration ? parseInt(edit.duration) : undefined, price: edit.price ? parseFloat(edit.price) : undefined,
          transport: edit.transport || undefined, meal_plan: edit.meal_plan || undefined,
          adults: edit.adults ? parseInt(edit.adults) : undefined, departure_city: edit.departure_city || undefined,
          agency: edit.agency || undefined,
        })
      }
      setEdit(null); load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    try { await deleteTour(id); load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
  }

  const invalid = (!edit?.hotel_id && edit?.id == null) || !edit?.departure_date || !edit?.price

  return (
    <div>
      <PageHead
        kicker="Nabídka"
        title="zájezdy"
        sub={data ? `${data.total.toLocaleString('cs-CZ')} nadcházejících termínů` : undefined}
        action={<AddButton onClick={() => setEdit({ ...EMPTY })}>Přidat termín</AddButton>}
      />
      <SearchBar value={q} onChange={v => { setQ(v); setPage(1) }} placeholder="Hledat hotel nebo zemi…">
        <label className="z-adm-search" style={{ maxWidth: 220, flex: 'none' }}>
          <Icon name="agentura" />
          <input type="text" value={agency} placeholder="Cestovní kancelář" onChange={e => { setAgency(e.target.value); setPage(1) }} />
        </label>
      </SearchBar>
      <ErrorBox text={error} />

      {loading && !data && <Loading />}
      {data && data.tours.length === 0 && <EmptyState icon="letadlo" text="Žádné zájezdy nenalezeny." />}
      {data && data.tours.length > 0 && (
        <div className="z-adm-tablewrap">
          <table className="z-adm-table">
            <thead>
              <tr><th>Hotel</th><th>Odjezd</th><th>Délka</th><th>Strava</th><th style={{ textAlign: 'right' }}>Cena</th><th>CK</th><th /></tr>
            </thead>
            <tbody>
              {data.tours.map(t => (
                <tr key={t.id}>
                  <td>
                    <b>{t.hotel_name}</b>
                    <small>{t.resort_town ? `${t.resort_town}, ` : ''}{t.country}</small>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="z-adm-inline"><Icon name="letadlo" size="sm" />{t.departure_date}</span>
                    {t.departure_city && <small>{t.departure_city}</small>}
                  </td>
                  <td>{t.duration ? `${t.duration} dní` : '—'}</td>
                  <td>{t.meal_plan && <span className="z-chip">{MEAL_LABELS[t.meal_plan.toLowerCase()] ?? t.meal_plan}</span>}</td>
                  <td className="z-adm-num z-adm-price">{fmtKc(t.price)}</td>
                  <td><span className="z-chip z-chip--sky">{t.agency}</span></td>
                  <td><RowActions onEdit={() => openEdit(t)} onDelete={() => handleDelete(t.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={page} total={data.total} limit={LIMIT} onPage={setPage} />}

      {edit && (
        <Drawer
          title={edit.id == null ? 'Přidat termín' : 'Upravit termín'}
          onClose={() => setEdit(null)}
          footer={<SaveButton saving={saving} disabled={invalid} onClick={handleSave}>{edit.id == null ? 'Přidat termín' : 'Uložit změny'}</SaveButton>}
        >
          <div className="z-adm-grid">
            <Field label="ID hotelu" required><TextInput value={edit.hotel_id} onChange={v => set({ hotel_id: v })} /></Field>
            <Field label="Cestovní kancelář"><TextInput value={edit.agency} onChange={v => set({ agency: v })} /></Field>
            <Field label="Datum odjezdu" required hint="RRRR-MM-DD"><TextInput type="date" value={edit.departure_date} onChange={v => set({ departure_date: v })} /></Field>
            <Field label="Datum návratu" hint="RRRR-MM-DD"><TextInput type="date" value={edit.return_date} onChange={v => set({ return_date: v })} /></Field>
            <Field label="Délka (dní)"><TextInput type="number" value={edit.duration} onChange={v => set({ duration: v })} /></Field>
            <Field label="Cena (Kč)" required><TextInput type="number" value={edit.price} onChange={v => set({ price: v })} /></Field>
            <Field label="Doprava"><TextInput value={edit.transport} onChange={v => set({ transport: v })} /></Field>
            <Field label="Stravování"><TextInput value={edit.meal_plan} onChange={v => set({ meal_plan: v })} /></Field>
            <Field label="Počet osob"><TextInput type="number" value={edit.adults} onChange={v => set({ adults: v })} /></Field>
            <Field label="Město odjezdu"><TextInput value={edit.departure_city} onChange={v => set({ departure_city: v })} /></Field>
          </div>
        </Drawer>
      )}
    </div>
  )
}
