'use client'
import { useEffect, useState } from 'react'
import { fetchPrompts, savePrompt, resetPrompt, type AdminPrompt } from '@/lib/adminApi'
import { PageHead, ErrorBox, Loading, SaveButton } from '@/components/admin/AdminUI'

export default function PromptyPage() {
  const [prompts, setPrompts] = useState<AdminPrompt[] | null>(null)
  const [active, setActive] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = async (keep?: string) => {
    try {
      const { prompts: list } = await fetchPrompts()
      setPrompts(list)
      const cur = list.find(p => p.key === (keep ?? active)) ?? list[0]
      setActive(cur.key); setText(cur.template)
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cur = prompts?.find(p => p.key === active)
  const dirty = !!cur && text !== cur.template

  const pick = (key: string) => {
    if (dirty && !confirm('Neuložené změny budou ztraceny. Pokračovat?')) return
    const p = prompts!.find(x => x.key === key)!
    setActive(key); setText(p.template); setMsg(''); setError('')
  }

  const save = async () => {
    setSaving(true); setError(''); setMsg('')
    try { await savePrompt(active, text); await load(active); setMsg('Uloženo. Nový prompt se použije při dalším generování.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const reset = async () => {
    if (!cur || !confirm('Vrátit výchozí znění promptu? Tvoje úpravy se smažou.')) return
    setSaving(true); setError(''); setMsg('')
    try { await resetPrompt(active); await load(active); setMsg('Vráceno výchozí znění.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Chyba') }
    finally { setSaving(false) }
  }

  const insert = (v: string) => setText(t => `${t}{{${v}}}`)

  return (
    <div>
      <PageHead kicker="AI obsah" title="prompty" sub="Zadání, podle kterých AI generuje články, popisy destinací, počasí a průvodce půjčením auta." />
      <ErrorBox text={error} />
      {!prompts && !error && <Loading />}
      {prompts && cur && (
        <>
          <div className="z-navtabs" role="tablist" style={{ marginBottom: 'var(--space-5)' }}>
            {prompts.map(p => (
              <button key={p.key} type="button" role="tab" className="z-navtab" aria-selected={p.key === active} onClick={() => pick(p.key)}>
                {p.label}{p.customized && <span className="z-prompt-dot" title="Upraveno" />}
              </button>
            ))}
          </div>

          <div className="z-tk"><div className="z-tk__in z-prompt">
            <p className="z-prompt__desc">{cur.description}</p>
            <div className="z-prompt__vars">
              <span className="z-data">PROMĚNNÉ</span>
              {cur.vars.map(v => <button key={v} type="button" className="z-chip" onClick={() => insert(v)} title="Vložit na konec">{`{{${v}}}`}</button>)}
              <small>Při generování se nahradí skutečnou hodnotou (např. název destinace).</small>
            </div>
            <textarea className="z-prompt__text" value={text} onChange={e => { setText(e.target.value); setMsg('') }} spellCheck={false} rows={22} />
            <p className="z-prompt__hint">Odpověď musí zůstat validní JSON se stejnými poli, jaké popisuje prompt – na ně navazuje web. Zápis <code>\n\n</code> je pokyn pro AI a ponech ho tak.</p>
            {msg && <p className="z-data" style={{ color: 'var(--brand-strong)', textTransform: 'none' }}>{msg}</p>}
            <div className="z-prompt__actions">
              <SaveButton saving={saving} disabled={!dirty} onClick={save}>Uložit prompt</SaveButton>
              <button type="button" className="z-btn z-btn--line z-btn--sm" onClick={() => setText(cur.template)} disabled={!dirty}>Zahodit změny</button>
              <button type="button" className="z-more" onClick={reset} disabled={!cur.customized || saving}>Vrátit výchozí</button>
              {cur.updated_at && <span className="z-data" style={{ marginLeft: 'auto' }}>UPRAVENO {new Date(cur.updated_at).toLocaleDateString('cs-CZ')}</span>}
            </div>
          </div></div>
        </>
      )}
    </div>
  )
}
