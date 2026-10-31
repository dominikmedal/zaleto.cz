'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon, { type IconName } from '@/components/ui/Icon'
import { formatPrice } from '@/components/ui/format'
import type { SearchResults } from '@/server/search'

type Item = { key: string; group: string; icon: IconName; title: string; sub?: string; stars?: number | null; href: string; aside?: string; photo?: string | null }

const EMPTY: SearchResults = { q: '', destinations: [], hotels: [], articles: [], cars: [], pages: [] }

export function flatten(r: SearchResults): Item[] {
  const kind = { country: 'země', region: 'oblast', resort: 'letovisko' } as const
  return [
    ...r.destinations.map(d => ({ key: `d-${d.href}`, group: 'Destinace', icon: 'poloha' as IconName, title: d.name, sub: [kind[d.kind], d.country].filter(Boolean).join(' · '), href: d.href, aside: `${d.count} hotelů` })),
    ...r.hotels.map(h => ({ key: `h-${h.slug}`, group: 'Zájezdy', icon: 'hotel' as IconName, title: h.name, sub: h.place, stars: h.stars, href: h.href, aside: h.price ? `od ${formatPrice(h.price)}` : undefined, photo: h.photo })),
    ...r.articles.map(a => ({ key: `a-${a.slug}`, group: 'Články', icon: 'clanek' as IconName, title: a.title, sub: a.location ?? undefined, href: a.href, photo: a.image })),
    ...r.cars.map(c => ({ key: `c-${c.href}`, group: 'Půjčovna aut', icon: 'auto' as IconName, title: `Půjčovna aut ${c.name}`, sub: c.country, href: c.href })),
    ...r.pages.map(p => ({ key: `p-${p.href}`, group: 'Stránky', icon: 'sipka' as IconName, title: p.title, sub: p.text, href: p.href })),
  ]
}

/** Tlačítko s lupou v hlavičce + překryvné okno s hledáním napříč webem (Ctrl/⌘+K nebo „/“). */
export default function SiteSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<SearchResults>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const reqId = useRef(0)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    setTimeout(() => inputRef.current?.focus(), 30)
    return () => { document.body.style.overflow = '' }
  }, [open])

  // našeptávání s krátkou prodlevou; starší odpovědi se zahazují
  useEffect(() => {
    if (q.trim().length < 2) { setRes(EMPTY); setLoading(false); return }
    setLoading(true)
    const id = ++reqId.current
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=5`)
        const data = (await r.json()) as SearchResults
        if (id === reqId.current) { setRes(data); setActive(0) }
      } catch { /* síť */ } finally { if (id === reqId.current) setLoading(false) }
    }, 180)
    return () => clearTimeout(t)
  }, [q])

  const items = useMemo(() => flatten(res), [res])
  const groups = useMemo(() => {
    const m = new Map<string, (Item & { idx: number })[]>()
    items.forEach((it, idx) => { if (!m.has(it.group)) m.set(it.group, []); m.get(it.group)!.push({ ...it, idx }) })
    return [...m.entries()]
  }, [items])

  const go = (href: string) => { close(); router.push(href) }
  const submit = () => {
    if (items[active] && q.trim().length >= 2) return go(items[active].href)
    if (q.trim()) go(`/hledat?q=${encodeURIComponent(q.trim())}`)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); submit() }
  }

  useEffect(() => { document.querySelector(`[data-sr-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active])

  return (
    <>
      <button type="button" className="z-iconbtn" aria-label="Hledat na webu" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="hledat" />
      </button>

      {open && (
        <div className="z-search-overlay" role="dialog" aria-modal="true" aria-label="Hledání na webu">
          <div className="z-modal__scrim" onClick={close} />
          <div className="z-search-overlay__panel">
            <div className="z-search-overlay__bar">
              <Icon name="hledat" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Hledej destinaci, hotel, článek…"
                aria-label="Hledat"
                autoComplete="off"
                enterKeyHint="search"
              />
              {loading && <Icon name="spinner" className="animate-spin" />}
              <button type="button" className="z-iconbtn" onClick={close} aria-label="Zavřít"><Icon name="zavrit" /></button>
            </div>

            <div className="z-search-overlay__body">
              {q.trim().length < 2 && (
                <div className="z-search-overlay__hint">
                  <span className="z-data">NAPÁD NA ZAČÁTEK</span>
                  <div className="z-chips">
                    {['Turecko', 'Kréta', 'Last minute', 'Půjčovna aut', 'Počasí'].map(s => (
                      <button key={s} type="button" className="z-chip" onClick={() => setQ(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {q.trim().length >= 2 && !loading && items.length === 0 && (
                <p className="z-search-overlay__empty">Nic jsme nenašli. Zkus jiný název nebo se podívej na <button type="button" className="z-more" onClick={() => go('/zajezdy')}>všechny zájezdy</button>.</p>
              )}
              {groups.map(([group, list]) => (
                <section key={group} className="z-sr-group">
                  <h3 className="z-data">{group.toUpperCase()}</h3>
                  {list.map(it => (
                    <button
                      key={it.key} type="button" data-sr-idx={it.idx}
                      className="z-sr-item" data-active={it.idx === active || undefined}
                      onMouseEnter={() => setActive(it.idx)} onClick={() => go(it.href)}
                    >
                      {it.photo
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={it.photo} alt="" loading="lazy" />
                        : <span className="z-sr-item__icon"><Icon name={it.icon} /></span>}
                      <span className="z-sr-item__text"><b>{it.title}</b>{(it.sub || it.stars) && (
                        <small>
                          {it.sub}
                          {it.stars ? <span className="z-sr-stars" aria-label={`${it.stars} hvězdy`}>{Array.from({ length: it.stars }).map((_, i) => <Icon key={i} name="hvezda" size="sm" />)}</span> : null}
                        </small>
                      )}</span>
                      {it.aside && <span className="z-sr-item__aside">{it.aside}</span>}
                    </button>
                  ))}
                </section>
              ))}
            </div>

            {q.trim().length >= 2 && (
              <div className="z-search-overlay__foot">
                <button type="button" className="z-btn z-btn--primary z-btn--sm" onClick={() => go(`/hledat?q=${encodeURIComponent(q.trim())}`)}>
                  Všechny výsledky<span className="z-btn__go"><Icon name="sipka" /></span>
                </button>
                <span className="z-search-overlay__keys z-data"><Icon name="arrowsUpDown" size="sm" />VÝBĚR · ENTER OTEVŘE · ESC ZAVŘE</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
