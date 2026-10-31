'use client'
import { useEffect, useState, useCallback } from 'react'
import Icon from '@/components/ui/Icon'

interface Hit { id: string; thumb: string; url: string; alt: string | null; credit: string; creditUrl: string; downloadLocation: string; width: number; height: number }
interface Row { name: string; hotels: number; photo: string | null; credit: string | null }

const token = () => (typeof window === 'undefined' ? '' : localStorage.getItem('admin_token') ?? '')
const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

/** Hledání a výběr fotek destinací z Unsplash (každá vybraná fotka ukládá autora). */
export default function FotkyPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [custom, setCustom] = useState('')
  const [filter, setFilter] = useState<'all' | 'missing'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const dest: { country: string | null; hotel_count: number }[] = await (await fetch('/api/destinations')).json()
      const by = new Map<string, number>()
      for (const d of dest) if (d.country) by.set(d.country, (by.get(d.country) ?? 0) + d.hotel_count)
      const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)
      const photos = await Promise.all(top.map(async ([name]) => {
        try { return await (await fetch(`/api/destination-photo/${encodeURIComponent(name)}`)).json() as { url: string | null; credit?: string | null } } catch { return { url: null } }
      }))
      setRows(top.map(([name, hotels], i) => ({ name, hotels, photo: photos[i].url, credit: photos[i].credit ?? null })))
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const search = async (q: string) => {
    if (q.trim().length < 2) return
    setSearching(true); setError(''); setHits([])
    try {
      const r = await fetch(`/api/admin/unsplash?q=${encodeURIComponent(q.trim())}`, { headers: auth() })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Chyba hledání')
      setHits(d.hits)
      if (d.hits.length === 0) setError('Nic nenalezeno, zkus anglický název (např. „Crete beach“).')
    } catch (e) { setError((e as Error).message) } finally { setSearching(false) }
  }

  const openRow = (name: string) => {
    if (open === name) { setOpen(null); return }
    setOpen(name); setQuery(`${name} travel`); search(`${name} travel`)
  }

  const pick = async (name: string, h: Hit) => {
    setError('')
    const r = await fetch('/api/admin/unsplash/pick', { method: 'POST', headers: auth(), body: JSON.stringify({ name, url: h.url, credit: h.credit, creditUrl: h.creditUrl, downloadLocation: h.downloadLocation }) })
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? 'Uložení se nepovedlo'); return }
    setRows(prev => prev.map(x => (x.name === name ? { ...x, photo: h.url, credit: h.credit } : x)))
    setOpen(null)
  }

  const addCustom = () => {
    const n = custom.trim()
    if (!n || rows.some(r => r.name.toLowerCase() === n.toLowerCase())) return
    setRows(prev => [{ name: n, hotels: 0, photo: null, credit: null }, ...prev]); setCustom(''); openRow(n)
  }

  const shown = rows.filter(r => (filter === 'missing' ? !r.credit : true))

  return (
    <div className="z-admin__stack">
      <div>
        <div className="z-kicker">Obrázky</div>
        <h1>fotky destinací<span className="z-dot">.</span></h1>
        <p>Vyber pro každou zemi nejlepší fotku z Unsplash. Uloží se i autor, který se na webu zobrazuje pod fotkou.</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' }}>
        <div className="z-seg" role="group" aria-label="Filtr">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Všechny</button>
          <button type="button" aria-pressed={filter === 'missing'} onClick={() => setFilter('missing')}>Bez výběru z Unsplash</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); addCustom() }} style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Přidat jinou destinaci…" style={{ padding: '10px 16px' }} />
          <button type="submit" className="z-btn z-btn--line z-btn--sm">Přidat</button>
        </form>
      </div>

      {error && <p role="alert" className="z-data" style={{ color: 'var(--danger)', textTransform: 'none' }}>{error}</p>}
      {loading && <div className="z-admin__loading" style={{ minHeight: 160 }}><Icon name="spinner" size="lg" className="animate-spin" /></div>}

      <div className="z-photorows">
        {shown.map(r => (
          <section key={r.name} className="z-photorow" data-open={open === r.name || undefined}>
            <div className="z-photorow__head">
              <div className="z-photorow__thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.photo ? <img src={r.photo} alt="" /> : <Icon name="foto" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="h4">{r.name}</h2>
                <span className="z-data" style={{ textTransform: 'none' }}>
                  {r.hotels ? `${r.hotels} hotelů · ` : ''}{r.credit ? `Unsplash: ${r.credit}` : r.photo ? 'původní fotka' : 'bez fotky'}
                </span>
              </div>
              <button type="button" className="z-btn z-btn--line z-btn--sm" onClick={() => openRow(r.name)}>
                {open === r.name ? 'Zavřít' : 'Vybrat fotku'}<span className="z-btn__go"><Icon name={open === r.name ? 'zavrit' : 'hledat'} /></span>
              </button>
            </div>

            {open === r.name && (
              <div className="z-photorow__body">
                <form onSubmit={e => { e.preventDefault(); search(query) }} className="z-photorow__search">
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Hledat na Unsplash…" />
                  <button type="submit" className="z-btn z-btn--primary z-btn--sm">Hledat<span className="z-btn__go"><Icon name="hledat" /></span></button>
                </form>
                {searching && <p className="z-data">HLEDÁM…</p>}
                <div className="z-photogrid">
                  {hits.map(h => (
                    <button key={h.id} type="button" className="z-photohit" onClick={() => pick(r.name, h)} title={h.alt ?? undefined}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={h.thumb} alt={h.alt ?? ''} loading="lazy" />
                      <span>{h.credit}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
