'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon, { type IconName } from '@/components/ui/Icon'
import { uploadImage } from '@/lib/adminApi'

const token = () => (typeof window === 'undefined' ? '' : localStorage.getItem('admin_token') ?? '')
const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

/** Hlavička stránky: nadtitulek, titulek s tečkou, podtitulek a akční tlačítko. */
export function PageHead({ kicker, title, sub, action }: { kicker?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="z-adm-head">
      <div>
        {kicker && <div className="z-kicker">{kicker}</div>}
        <h1>{title}<span className="z-dot">.</span></h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="z-btn z-btn--primary" onClick={onClick}>{children}<span className="z-btn__go"><Icon name="plus" /></span></button>
}

/** Vyhledávací pole s ikonou (a volitelná další pole vedle). */
export function SearchBar({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children?: ReactNode }) {
  return (
    <div className="z-adm-bar">
      <label className="z-adm-search">
        <Icon name="hledat" />
        <input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      </label>
      {children}
    </div>
  )
}

export function ErrorBox({ text }: { text: string }) {
  if (!text) return null
  return <div className="z-info" role="alert"><p style={{ margin: 0 }}>{text}</p></div>
}

export function Loading() {
  return <div className="z-admin__loading" style={{ minHeight: 160 }}><Icon name="spinner" size="lg" className="animate-spin" /></div>
}

export function EmptyState({ icon = 'info', text }: { icon?: IconName; text: string }) {
  return <div className="z-adm-empty"><Icon name={icon} size="lg" /><p>{text}</p></div>
}

/** Stránkování po stranách (v administraci je to záměrně klasické). */
export function Pager({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null
  return (
    <div className="z-adm-pager">
      <span className="z-data">STRANA {page} / {pages}</span>
      <div>
        <button type="button" className="z-iconbtn" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Předchozí"><Icon name="caretLeft" /></button>
        <button type="button" className="z-iconbtn" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page === pages} aria-label="Další"><Icon name="caretRight" /></button>
      </div>
    </div>
  )
}

/** Tlačítka úprav a mazání řádku; mazání vyžaduje potvrzení „Ano / Ne“. */
export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete?: () => Promise<void> | void }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) {
    return (
      <div className="z-adm-actions">
        <span className="z-data">SMAZAT?</span>
        <button type="button" className="z-adm-danger" onClick={async () => { await onDelete?.(); setConfirm(false) }}>Ano</button>
        <button type="button" className="z-adm-ghost" onClick={() => setConfirm(false)}>Ne</button>
      </div>
    )
  }
  return (
    <div className="z-adm-actions">
      <button type="button" className="z-iconbtn" onClick={onEdit} aria-label="Upravit"><Icon name="pencil" /></button>
      {onDelete && <button type="button" className="z-iconbtn z-iconbtn--danger" onClick={() => setConfirm(true)} aria-label="Smazat"><Icon name="trash" /></button>}
    </div>
  )
}

/** Boční panel s formulářem. */
export function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="z-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="z-drawer__scrim" onClick={onClose} />
      <div className="z-drawer__panel">
        <div className="z-drawer__head">
          <h2 className="h3">{title}<span className="z-dot">.</span></h2>
          <button type="button" className="z-iconbtn" onClick={onClose} aria-label="Zavřít"><Icon name="zavrit" /></button>
        </div>
        <div className="z-drawer__body">{children}</div>
        <div className="z-drawer__foot">{footer}</div>
      </div>
    </div>
  )
}

export function Field({ label, required, wide, hint, children }: { label: string; required?: boolean; wide?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="z-adm-field" data-wide={wide || undefined}>
      <span className="z-adm-field__label">{label}{required && <b aria-hidden="true"> *</b>}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
}

export function SaveButton({ saving, disabled, onClick, children }: { saving: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="z-btn z-btn--primary" onClick={onClick} disabled={saving || disabled}>
      {children}<span className="z-btn__go"><Icon name={saving ? 'spinner' : 'ok'} className={saving ? 'animate-spin' : undefined} /></span>
    </button>
  )
}

export interface PickedImage { url: string; credit?: string | null; creditUrl?: string | null }

interface Hit { id: string; thumb: string; url: string; alt: string | null; credit: string; creditUrl: string; downloadLocation: string }

/**
 * Výběr obrázku: nahrání souboru (Vercel Blob), hledání na Unsplash (s uložením autora) nebo URL.
 * `onChange(url, credit)` – credit je vyplněný jen u Unsplash.
 */
export function ImageField({ label = 'Obrázek', value, credit, onChange, suggest, unsplash = true }: {
  label?: string; value: string; credit?: string | null
  onChange: (img: PickedImage | null) => void
  /** Předvyplněný dotaz pro Unsplash (např. lokalita článku). */
  suggest?: string
  unsplash?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [panel, setPanel] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const upload = async (file: File) => {
    setUploading(true); setError('')
    try { const { url } = await uploadImage(file); onChange({ url, credit: null, creditUrl: null }) }
    catch (e) { setError(e instanceof Error ? e.message : 'Nahrání se nepovedlo') }
    finally { setUploading(false) }
  }

  const search = async (term: string) => {
    if (term.trim().length < 2) return
    setSearching(true); setError(''); setHits([])
    try {
      const r = await fetch(`/api/admin/unsplash?q=${encodeURIComponent(term.trim())}`, { headers: authHeaders() })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Hledání se nepovedlo')
      setHits(d.hits)
      if (d.hits.length === 0) setError('Nic nenalezeno, zkus anglický dotaz.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Chyba') } finally { setSearching(false) }
  }

  const openPanel = () => {
    const next = !panel
    setPanel(next)
    if (next && hits.length === 0) { const term = suggest ? `${suggest} travel` : ''; setQ(term); if (term) search(term) }
  }

  const pick = async (h: Hit) => {
    onChange({ url: h.url, credit: h.credit, creditUrl: h.creditUrl })
    setPanel(false)
    // povinné hlášení použití fotky Unsplash
    fetch('/api/admin/unsplash/download', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ downloadLocation: h.downloadLocation }) }).catch(() => {})
  }

  return (
    <div className="z-adm-img">
      <span className="z-adm-field__label">{label}</span>
      <div className="z-adm-img__preview">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="" />
          : <span><Icon name="foto" size="lg" /><small>Žádný obrázek</small></span>}
        {value && <button type="button" className="z-iconbtn" onClick={() => onChange(null)} aria-label="Odebrat obrázek"><Icon name="zavrit" size="sm" /></button>}
      </div>
      {credit && <small className="z-data" style={{ textTransform: 'none' }}>Unsplash: {credit}</small>}

      <div className="z-adm-img__btns">
        <button type="button" className="z-btn z-btn--line z-btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Nahrávám…' : 'Nahrát soubor'}<span className="z-btn__go"><Icon name={uploading ? 'spinner' : 'upload'} className={uploading ? 'animate-spin' : undefined} /></span>
        </button>
        {unsplash && (
          <button type="button" className="z-btn z-btn--line z-btn--sm" onClick={openPanel} aria-expanded={panel}>
            Vybrat z Unsplash<span className="z-btn__go"><Icon name="hledat" /></span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />

      {panel && (
        <div className="z-adm-img__panel">
          <form onSubmit={e => { e.preventDefault(); search(q) }} className="z-photorow__search">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Hledat na Unsplash…" />
            <button type="submit" className="z-btn z-btn--primary z-btn--sm">Hledat<span className="z-btn__go"><Icon name="hledat" /></span></button>
          </form>
          {searching && <p className="z-data">HLEDÁM…</p>}
          <div className="z-photogrid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {hits.map(h => (
              <button key={h.id} type="button" className="z-photohit" onClick={() => pick(h)} title={h.alt ?? undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={h.thumb} alt={h.alt ?? ''} loading="lazy" /><span>{h.credit}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p role="alert" className="z-data" style={{ color: 'var(--danger)', textTransform: 'none' }}>{error}</p>}
    </div>
  )
}
