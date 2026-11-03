'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'

const TYPES = ['Placený článek', 'Placený článek a propagace', 'Jiná spolupráce']
const MAX_FILES = 4
const MAX_TOTAL = 4 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.xls,.xlsx,.ods,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.zip'
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} kB`)

/**
 * Formulář spolupráce (placené články): údaje + zpráva + přílohy (max. 4 soubory, celkem 4 MB).
 * Odešle se jako multipart na /api/spoluprace, odtud jde e-mail s přílohami správci webu.
 */
export default function CollabForm() {
  const [f, setF] = useState({ type: TYPES[0], name: '', company: '', email: '', phone: '', site: '', message: '', website: '' })
  const [consent, setConsent] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const t0 = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { t0.current = Date.now() }, [])
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF(p => ({ ...p, [k]: e.target.value })); setError('') }
  const total = files.reduce((s, x) => s + x.size, 0)

  function addFiles(list: FileList | null) {
    if (!list) return
    const next = [...files, ...Array.from(list)]
    if (next.length > MAX_FILES) { setError(`Přiložit můžete nejvýše ${MAX_FILES} soubory.`); return }
    if (next.reduce((s, x) => s + x.size, 0) > MAX_TOTAL) { setError('Přílohy jsou celkem větší než 4 MB. Zmenšete je, nebo pošlete odkaz do zprávy.'); return }
    setError('')
    setFiles(next)
    if (input.current) input.current.value = ''
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) { setError('Potvrďte prosím souhlas se zpracováním údajů.'); return }
    setBusy(true); setError('')
    try {
      const fd = new FormData()
      for (const [k, v] of Object.entries(f)) fd.set(k, v)
      fd.set('consent', '1')
      fd.set('t', String(t0.current))
      for (const x of files) fd.append('files', x, x.name)
      const r = await fetch('/api/spoluprace', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.error?.message ?? (typeof d?.error === 'string' ? d.error : null) ?? d?.message ?? 'Odeslání se nepodařilo.')
      setDone(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Odeslání se nepodařilo.') }
    finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="z-tk z-tripform__done"><div className="z-tk__in">
        <Icon name="ok" size="lg" />
        <h2 className="h3">díky, poptávka je u nás<span className="z-dot">.</span></h2>
        <p>Ozveme se vám na uvedený e-mail, obvykle do dvou pracovních dnů, a domluvíme podmínky.</p>
        <Link href="/clanky" className="z-more">Prohlédnout články na Zaletu</Link>
      </div></div>
    )
  }

  return (
    <form className="z-tripform z-collab" onSubmit={submit}>
      <label><span>Co vás zajímá</span>
        <select value={f.type} onChange={set('type')}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
      </label>
      <div className="z-tripform__row">
        <label><span>Jméno a příjmení</span><input value={f.name} onChange={set('name')} maxLength={120} autoComplete="name" required /></label>
        <label><span>Firma nebo značka <small>(nepovinné)</small></span><input value={f.company} onChange={set('company')} maxLength={160} autoComplete="organization" /></label>
      </div>
      <div className="z-tripform__row">
        <label><span>E-mail</span><input type="email" value={f.email} onChange={set('email')} maxLength={160} autoComplete="email" required /></label>
        <label><span>Telefon <small>(nepovinné)</small></span><input type="tel" value={f.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" /></label>
      </div>
      <label><span>Web nebo odkaz na produkt <small>(nepovinné)</small></span><input value={f.site} onChange={set('site')} maxLength={300} placeholder="https://" inputMode="url" /></label>
      <label><span>Zpráva</span>
        <textarea value={f.message} onChange={set('message')} rows={8} maxLength={5000} required
          placeholder={'Co chcete propagovat, jaké téma, pro koho a kdy by měl článek vyjít. Můžete přiložit podklady nebo hotový text.'} />
        <small className="z-data" style={{ textTransform: 'none' }}>{f.message.length.toLocaleString('cs-CZ')} / 5 000 znaků</small>
      </label>

      <div className="z-collab__files">
        <span className="z-collab__label">Přílohy <small>(nepovinné)</small></span>
        <button type="button" className="z-collab__drop" onClick={() => input.current?.click()}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}>
          <Icon name="upload" size="lg" />
          <b>Vyberte soubory nebo je sem přetáhněte</b>
          <small>až {MAX_FILES} soubory, celkem do 4 MB · dokumenty, tabulky, prezentace, obrázky, ZIP</small>
        </button>
        <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={e => addFiles(e.target.files)} />
        {files.length > 0 && (
          <ul className="z-collab__list">
            {files.map((x, i) => (
              <li key={`${x.name}-${i}`}>
                <Icon name="clanek" size="sm" /><span>{x.name}</span><small className="z-data">{size(x.size)}</small>
                <button type="button" className="z-iconbtn" aria-label={`Odebrat ${x.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><Icon name="zavrit" size="sm" /></button>
              </li>
            ))}
            <li className="z-collab__sum z-data">CELKEM {size(total)} Z 4 MB</li>
          </ul>
        )}
      </div>

      <input className="z-tripform__hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set('website')} name="website" />
      <label className="z-collab__consent">
        <input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); setError('') }} />
        <span>Souhlasím se zpracováním uvedených údajů za účelem odpovědi na poptávku. Podrobnosti jsou v <Link href="/ochrana-osobnich-udaju">zásadách ochrany osobních údajů</Link>.</span>
      </label>
      {error && <p className="z-tripform__err" role="alert">{error}</p>}
      <button type="submit" className="z-btn z-btn--primary" disabled={busy}>{busy ? 'Odesílám…' : 'Odeslat poptávku'}<span className="z-btn__go"><Icon name="sipka" /></span></button>
    </form>
  )
}
