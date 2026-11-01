'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

interface Initial { title: string; body: string; author_name: string; destination: string }

/**
 * Formulář cestopisu. Bez přihlášení: po odeslání dostane autor tajný odkaz pro úpravy
 * (uloží se i do tohoto prohlížeče). Zveřejní se až po schválení adminem.
 */
export default function TravelogueForm({ destinations, token, initial }: { destinations: string[]; token?: string; initial?: Initial }) {
  const [f, setF] = useState({ title: initial?.title ?? '', destination: initial?.destination ?? '', author_name: initial?.author_name ?? '', author_email: '', body: initial?.body ?? '', website: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ token?: string } | null>(null)
  const t0 = useRef(0)
  useEffect(() => { t0.current = Date.now() }, [])
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF(p => ({ ...p, [k]: e.target.value })); setError('') }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await fetch(token ? `/api/travelogues/${token}` : '/api/travelogues', {
        method: token ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, t: t0.current }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error?.message ?? (typeof d?.error === 'string' ? d.error : null) ?? d?.message ?? 'Odeslání se nepodařilo.')
      if (d.token && d.token !== 'x') { try { localStorage.setItem('zaleto_trip_token', d.token) } catch { /* ignore */ } }
      setDone({ token: d.token })
    } catch (err) { setError(err instanceof Error ? err.message : 'Odeslání se nepodařilo.') }
    finally { setBusy(false) }
  }

  if (done) {
    const link = done.token && done.token !== 'x' ? `${location.origin}/cestopisy/uprav/${done.token}` : null
    return (
      <div className="z-tk z-tripform__done"><div className="z-tk__in">
        <Icon name="ok" size="lg" />
        <h2 className="h3">díky, cestopis je u nás<span className="z-dot">.</span></h2>
        <p>Před zveřejněním ho ještě přečteme a schválíme. Obvykle to trvá do pár dní.</p>
        {link && (
          <>
            <p>Tenhle odkaz si schovej. Je to jediný způsob, jak text později upravit (po úpravě ho znovu schvalujeme):</p>
            <input readOnly value={link} onFocus={e => e.currentTarget.select()} className="z-tripform__link" />
          </>
        )}
        <Link href="/cestopisy" className="z-more">Přečíst další cestopisy</Link>
      </div></div>
    )
  }

  return (
    <form className="z-tripform" onSubmit={submit}>
      <label><span>Nadpis</span><input value={f.title} onChange={set('title')} maxLength={140} placeholder="Např. Týden na Krétě bez auta" required /></label>
      <label><span>Destinace</span>
        <input value={f.destination} onChange={set('destination')} list="trip-dests" maxLength={80} placeholder="Začni psát: Kréta, Zakynthos, Mallorca…" required />
        <datalist id="trip-dests">{destinations.map(d => <option key={d} value={d} />)}</datalist>
      </label>
      <div className="z-tripform__row">
        <label><span>Jméno nebo přezdívka</span><input value={f.author_name} onChange={set('author_name')} maxLength={60} required /></label>
        {!token && <label><span>E-mail <small>(nezveřejníme)</small></span><input type="email" value={f.author_email} onChange={set('author_email')} maxLength={120} required /></label>}
      </div>
      <label><span>Cestopis</span>
        <textarea value={f.body} onChange={set('body')} rows={14} maxLength={15000} required
          placeholder={'Napiš, kde jsi byl(a), co stálo za to a co bys příště udělal(a) jinak.\n\nNadpisy: ## Nadpis · tučně: **text** · odrážky: - text'} />
        <small className="z-data" style={{ textTransform: 'none' }}>{f.body.length.toLocaleString('cs-CZ')} / 15 000 znaků, alespoň 300</small>
      </label>
      <input className="z-tripform__hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} name="website" />
      {error && <p className="z-tripform__err" role="alert">{error}</p>}
      <button type="submit" className="z-btn z-btn--primary" disabled={busy}>{busy ? 'Odesílám…' : token ? 'Uložit úpravy' : 'Odeslat ke schválení'}<span className="z-btn__go"><Icon name="sipka" /></span></button>
      <p className="z-data" style={{ textTransform: 'none' }}>Cestopis se zveřejní až po schválení. Odesláním potvrzuješ, že jsi autor textu a souhlasíš s jeho zveřejněním na Zaletu.</p>
    </form>
  )
}
