'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Icon, { type IconName } from './Icon'
import { apiFetch } from '@/lib/api'

type Kind = 'country' | 'region' | 'town' | 'hotel'
interface Sug { kind: Kind; label: string; sub?: string; count?: number; slug?: string }
interface DestRow { country: string | null; destination: string | null; resort_town: string | null; hotel_count: number }

const KIND: Record<Kind, { icon: IconName; label: string }> = {
  country: { icon: 'zeme', label: 'Země' },
  region: { icon: 'poloha', label: 'Oblast' },
  town: { icon: 'mesto', label: 'Letovisko' },
  hotel: { icon: 'hotel', label: 'Hotel' },
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

let indexPromise: Promise<Sug[]> | null = null
/** Seznam zemí, oblastí a letovisek se stáhne jednou a drží se v paměti. */
function loadIndex(): Promise<Sug[]> {
  indexPromise ??= apiFetch('/api/destinations')
    .then(r => (r.ok ? r.json() : []))
    .then((rows: DestRow[]) => {
      const map = new Map<string, Sug>()
      const add = (kind: Kind, label: string | null | undefined, sub: string | undefined, count: number) => {
        if (!label) return
        const key = `${kind}:${label}`
        const cur = map.get(key)
        if (cur) cur.count = (cur.count ?? 0) + count
        else map.set(key, { kind, label, sub, count })
      }
      for (const r of rows) {
        const parts = (r.destination ?? '').split('/').map(x => x.trim())
        const region = parts.length >= 2 ? parts[1] : parts[0]
        add('country', r.country, undefined, r.hotel_count)
        if (region && region !== r.country && !/safari|bike|trek|plus|sport|aktivní/i.test(region)) add('region', region, r.country ?? undefined, r.hotel_count)
        if (r.resort_town && r.resort_town !== region && r.resort_town !== r.country) add('town', r.resort_town, r.country ?? undefined, r.hotel_count)
      }
      return [...map.values()]
    })
    .catch(() => { indexPromise = null; return [] })
  return indexPromise
}

interface Props {
  name: string
  defaultValue?: string
  placeholder?: string
  disabled?: boolean
  /** Při výběru hotelu přejít rovnou na jeho stránku (výchozí zapnuto). */
  hotelLinks?: boolean
}

/** Našeptávač kam: země, oblasti, letoviska a hotely. Ovládání šipkami, Enter, Esc. */
export default function DestinationSuggest({ name, defaultValue = '', placeholder = 'Kamkoli', disabled, hotelLinks = true }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue)
  const [items, setItems] = useState<Sug[]>([])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const place = useCallback(() => {
    const r = wrap.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 10, left: r.left - 20, width: Math.max(r.width + 40, 340) })
  }, [])

  useEffect(() => {
    if (!open) return
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    const out = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.z-dsuggest')) setOpen(false) }
    document.addEventListener('mousedown', out)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); document.removeEventListener('mousedown', out) }
  }, [open, place])

  const search = useCallback((q: string) => {
    if (timer.current) clearTimeout(timer.current)
    const n = norm(q)
    timer.current = setTimeout(async () => {
      const idx = await loadIndex()
      let list: Sug[]
      if (n.length === 0) {
        list = idx.filter(s => s.kind === 'country').sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 8)
      } else {
        const score = (s: Sug) => (norm(s.label).startsWith(n) ? 0 : 1) * 1000 - (s.count ?? 0)
        list = idx.filter(s => norm(s.label).includes(n)).sort((a, b) => score(a) - score(b)).slice(0, 7)
      }
      setItems(list); setHi(-1); setOpen(list.length > 0)
      if (n.length >= 2 && hotelLinks) {
        try {
          const r = await apiFetch(`/api/hotels/search?q=${encodeURIComponent(q.trim())}&limit=4`)
          const hotels: { slug: string; name: string; resort_town?: string | null; country?: string | null }[] = r.ok ? await r.json() : []
          const hs: Sug[] = hotels.map(h => ({ kind: 'hotel', label: h.name, sub: [h.resort_town, h.country].filter(Boolean).join(', '), slug: h.slug }))
          setItems(prev => (prev.some(p => p.kind === 'hotel') ? prev : [...prev, ...hs]))
          if (hs.length) setOpen(true)
        } catch { /* ignoruj */ }
      }
    }, 140)
  }, [hotelLinks])

  const pick = (s: Sug) => {
    setOpen(false)
    if (s.kind === 'hotel' && s.slug) { router.push(`/hotel/${s.slug}`); return }
    setValue(s.label)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || items.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => (h + 1) % items.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => (h <= 0 ? items.length - 1 : h - 1)) }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(items[hi]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <div className="z-clear">
        <input
          name={name}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label="Kam"
          onChange={e => { setValue(e.target.value); search(e.target.value) }}
          onFocus={() => { search(value); place() }}
          onKeyDown={onKey}
        />
        {value && !disabled && (
          <button type="button" aria-label="Smazat" onClick={() => { setValue(''); search('') }}><Icon name="zavrit" size="sm" /></button>
        )}
      </div>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div className="z-suggest z-dsuggest" role="listbox" style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
          {value.trim() === '' && <div className="z-dsuggest__head">Oblíbené destinace</div>}
          {items.map((s, i) => (
            <button
              key={`${s.kind}-${s.label}-${i}`}
              type="button"
              role="option"
              aria-selected={i === hi}
              className="z-dsuggest__item"
              data-active={i === hi}
              onMouseEnter={() => setHi(i)}
              onMouseDown={e => { e.preventDefault(); pick(s) }}
            >
              <span className="z-dsuggest__ic"><Icon name={KIND[s.kind].icon} /></span>
              <span className="z-dsuggest__txt">
                <b>{s.label}</b>
                <small>{KIND[s.kind].label}{s.sub ? ` · ${s.sub}` : ''}</small>
              </span>
              {s.count ? <span className="z-dsuggest__count">{s.count}</span> : null}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
