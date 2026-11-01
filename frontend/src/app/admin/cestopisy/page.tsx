'use client'
import { useCallback, useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { fetchTravelogues, setTravelogue, deleteTravelogue, type AdminTravelogue } from '@/lib/adminApi'
import { PageHead, ErrorBox, Loading, EmptyState } from '@/components/admin/AdminUI'

const TABS: [string, string][] = [['', 'Vše'], ['pending', 'Ke schválení'], ['approved', 'Schválené'], ['rejected', 'Zamítnuté']]
const LABEL: Record<string, string> = { pending: 'Čeká', approved: 'Schváleno', rejected: 'Zamítnuto' }
const fmt = (s: string) => new Date(s).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function CestopisyAdminPage() {
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState<AdminTravelogue[] | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try { setItems((await fetchTravelogues(tab)).travelogues) } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
  }, [tab])
  useEffect(() => { setItems(null); load() }, [load])

  const act = async (id: number, status: string) => { try { await setTravelogue(id, { status }); load() } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') } }
  const del = async (id: number) => { if (!confirm('Opravdu smazat?')) return; try { await deleteTravelogue(id); load() } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') } }

  return (
    <div className="z-admin__stack">
      <PageHead kicker="Obsah od čtenářů" title="cestopisy" sub="Čtenáři je posílají bez přihlášení. Veřejně se ukážou až po tvém schválení." />
      <div className="z-adm-tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" className="z-chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {error && <ErrorBox text={error} />}
      {!items ? <Loading /> : items.length === 0 ? <EmptyState icon="trasa" text="Žádné cestopisy." /> : (
        <ul className="z-admtrips">
          {items.map(t => (
            <li key={t.id} data-status={t.status}>
              <button type="button" className="z-admtrips__head" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
                <span className={`z-adminact__dot z-adminact__dot--${t.status === 'approved' ? 'ok' : t.status === 'pending' ? 'warn' : 'old'}`} />
                <b>{t.title}</b>
                <span className="z-data">{t.destination} · {t.author_name} · {fmt(t.created_at)} · {LABEL[t.status]}</span>
              </button>
              {open === t.id && (
                <div className="z-admtrips__body">
                  <p className="z-data" style={{ textTransform: 'none' }}>{t.author_email} · {t.body.length.toLocaleString('cs-CZ')} znaků{t.status === 'approved' ? <> · <a href={`/cestopisy/${t.slug}`} target="_blank" rel="noopener noreferrer">zobrazit</a></> : null}</p>
                  <pre>{t.body}</pre>
                  <div className="z-adm-actions">
                    {t.status !== 'approved' && <button type="button" className="z-btn z-btn--primary" onClick={() => act(t.id, 'approved')}>Schválit<span className="z-btn__go"><Icon name="ok" /></span></button>}
                    {t.status !== 'rejected' && <button type="button" className="z-adm-ghost" onClick={() => act(t.id, 'rejected')}>Zamítnout</button>}
                    {t.status === 'approved' && <button type="button" className="z-adm-ghost" onClick={() => act(t.id, 'pending')}>Stáhnout</button>}
                    <button type="button" className="z-adm-danger" onClick={() => del(t.id)}>Smazat</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
