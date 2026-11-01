'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { fetchAutomation, saveAutomation, addSource, updateSource, deleteSource, type AutomationData } from '@/lib/adminApi'
import { PageHead, ErrorBox, Loading, SaveButton, RowActions } from '@/components/admin/AdminUI'

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

export default function AutomatizacePage() {
  const [data, setData] = useState<AutomationData | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ enabled: false, max_per_day: 3, min_score: 7 })
  const [src, setSrc] = useState({ name: '', feed_url: '' })

  const load = useCallback(async () => {
    try { const d = await fetchAutomation(); setData(d); setForm(d.settings) }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
  }, [])
  useEffect(() => { load() }, [load])

  const run = async (fn: () => Promise<unknown>) => { setError(''); try { await fn(); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') } }

  const save = async () => {
    setSaving(true); setSaved(false); setError('')
    try { await saveAutomation(form); setSaved(true); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') } finally { setSaving(false) }
  }

  return (
    <div>
      <PageHead kicker="Obsah" title="automatizace" sub="Denní výběr, přepsání a zveřejnění cestovatelských článků ze zdrojů (RSS)." />
      <ErrorBox text={error} />
      {!data && !error && <Loading />}
      {data && (
        <div className="z-auto">
          <section className="z-tk"><div className="z-tk__in z-auto__card">
            <h2 className="h4">nastavení<span className="z-dot">.</span></h2>
            <label className="z-auto__switch">
              <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
              <span><b>Automatické zveřejňování</b><small>{form.enabled ? 'Zapnuto: každý den se vyberou a naplánují nové články.' : 'Vypnuto: nic se nevybírá ani nezveřejňuje.'}</small></span>
            </label>
            <div className="z-adm-grid">
              <label className="z-adm-field"><span className="z-adm-field__label">Článků denně</span>
                <input type="number" min={1} max={10} value={form.max_per_day} onChange={e => setForm({ ...form, max_per_day: parseInt(e.target.value) || 1 })} />
                <small>Nejvýše tolik nových článků se zveřejní za den (rozloží se přes den).</small></label>
              <label className="z-adm-field"><span className="z-adm-field__label">Minimální skóre (1–10)</span>
                <input type="number" min={1} max={10} value={form.min_score} onChange={e => setForm({ ...form, min_score: parseInt(e.target.value) || 1 })} />
                <small>Článek musí od AI dostat aspoň toto hodnocení relevance.</small></label>
            </div>
            <div className="z-auto__actions">
              <SaveButton saving={saving} onClick={save}>Uložit nastavení</SaveButton>
              {saved && <span className="z-data" style={{ color: 'var(--brand-strong)', textTransform: 'none' }}>Uloženo.</span>}
              <Link href="/admin/prompty" className="z-more">Upravit prompty (výběr, přepsání, obrázek)</Link>
            </div>
          </div></section>

          <section>
            <h2 className="h4" style={{ margin: '0 0 var(--space-3)' }}>zdroje<span className="z-dot">.</span></h2>
            <div className="z-adm-tablewrap">
              <table className="z-adm-table">
                <thead><tr><th>Zdroj</th><th>RSS kanál</th><th>Stav</th><th /></tr></thead>
                <tbody>
                  {data.sources.map(s => (
                    <tr key={s.id}>
                      <td><b>{s.name}</b></td>
                      <td><code className="z-adm-code">{s.feed_url.replace(/^https?:\/\//, '').slice(0, 52)}</code></td>
                      <td>
                        <button type="button" className={`z-chip ${s.enabled ? 'z-chip--sky' : ''}`} onClick={() => run(() => updateSource(s.id, { enabled: !s.enabled }))} title="Přepnout">
                          {s.enabled ? 'Zapnutý' : 'Vypnutý'}
                        </button>
                      </td>
                      <td><RowActions onEdit={() => run(() => updateSource(s.id, { enabled: !s.enabled }))} onDelete={() => run(() => deleteSource(s.id))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form className="z-auto__add" onSubmit={e => { e.preventDefault(); run(async () => { await addSource(src.name, src.feed_url); setSrc({ name: '', feed_url: '' }) }) }}>
              <input placeholder="Název zdroje" value={src.name} onChange={e => setSrc({ ...src, name: e.target.value })} aria-label="Název zdroje" />
              <input placeholder="Adresa RSS kanálu (https://…)" value={src.feed_url} onChange={e => setSrc({ ...src, feed_url: e.target.value })} aria-label="Adresa RSS kanálu" />
              <button type="submit" className="z-btn z-btn--line z-btn--sm" disabled={!src.name || !src.feed_url}>Přidat zdroj<span className="z-btn__go"><Icon name="plus" /></span></button>
            </form>
            <p className="z-data" style={{ textTransform: 'none', margin: 'var(--space-3) 0 0' }}>Články se přepisují vlastními slovy a pod každým je uvedený zdroj. Před přidáním zdroje zkontroluj jeho podmínky použití.</p>
          </section>

          <section>
            <h2 className="h4" style={{ margin: '0 0 var(--space-3)' }}>fronta<span className="z-dot">.</span></h2>
            {data.queue.length === 0 ? <p className="z-data" style={{ textTransform: 'none' }}>Nic naplánovaného.</p> : (
              <ul className="z-auto__list">
                {data.queue.map(q => (
                  <li key={q.id}><span className={`z-chip ${q.status === 'draft' ? 'z-chip--warn' : 'z-chip--sky'}`}>{q.status === 'draft' ? 'Koncept' : 'Naplánováno'}</span>
                    <b>{q.title}</b><small>{fmt(q.scheduled_at)}{q.source_name ? ` · ${q.source_name}` : ''}</small></li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="h4" style={{ margin: '0 0 var(--space-3)' }}>poslední běhy<span className="z-dot">.</span></h2>
            {data.runs.length === 0 && <p className="z-data" style={{ textTransform: 'none' }}>Zatím žádný běh. První proběhne automaticky (GitHub Actions) nebo ho spustíš ručně v záložce Actions.</p>}
            {data.runs.map(r => {
              const picked = r.decisions.filter(d => d.picked)
              return (
                <details key={r.id} className="z-auto__run">
                  <summary>
                    <b>{fmt(r.created_at)}</b>
                    <span>{r.note ?? `${picked.length} z ${r.candidates} vybráno`}</span>
                  </summary>
                  <ul className="z-auto__list">
                    {r.decisions.map(d => (
                      <li key={d.url} data-picked={d.picked || undefined}>
                        <span className="z-chip">{d.score ?? '–'}/10</span>
                        <a href={d.url} target="_blank" rel="noopener noreferrer">{d.title}</a>
                        <small>{d.sourceName} · {d.reason}{d.error ? ` · CHYBA: ${d.error}` : d.picked ? ` · naplánováno ${fmt(d.scheduledAt ?? null)}` : ''}</small>
                      </li>
                    ))}
                  </ul>
                </details>
              )
            })}
          </section>
        </div>
      )}
    </div>
  )
}
