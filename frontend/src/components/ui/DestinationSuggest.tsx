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

const RANK: Record<Kind, number> = { country: 0, region: 1, town: 2, hotel: 3 }
const GROUP: Record<Kind, string> = { country: 'Země', region: 'Oblasti', town: 'Letoviska', hotel: 'Hotely' }
const byKind = (a: Sug, b: Sug) => RANK[a.kind] - RANK[b.kind]

/** Zvýrazní shodu s hledaným textem (jen když normalizace nemění délku textu). */
function hl(label: string, q: string) {
  const n = norm(q)
  const nl = norm(label)
  if (!n || nl.length !== label.length) return label
  const i = nl.indexOf(n)
  if (i < 0) return label
  return <>{label.slice(0, i)}<mark className="z-suggest-mark">{label.slice(i, i + n.length)}</mark>{label.slice(i + n.length)}</>
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
  /** `stay` = hledání ubytování (Booking.com): hotel se po výběru vloží do pole, bez počtů našich zájezdových hotelů. */
  mode?: 'tour' | 'stay'
}

/** Našeptávač kam: země, oblasti, letoviska a hotely. Ovládání šipkami, Enter, Esc. */
export default function DestinationSuggest({ name, defaultValue = '', placeholder, disabled, hotelLinks = true, mode = 'tour' }: Props) {
  const stay = mode === 'stay'
  placeholder ??= stay ? 'Město, oblast nebo hotel' : 'Kamkoli'
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
      list = [...list].sort(byKind)
      setItems(list); setHi(-1); setOpen(list.length > 0)
      if (n.length >= 2 && hotelLinks) {
        try {
          const r = await apiFetch(`/api/hotels/search?q=${encodeURIComponent(q.trim())}&limit=4`)
          const hotels: { slug: string; name: string; resort_town?: string | null; country?: string | null }[] = r.ok ? await r.json() : []
          const hs: Sug[] = hotels.map(h => ({ kind: 'hotel', label: h.name, sub: [h.resort_town, h.country].filter(Boolean).join(', '), slug: h.slug }))
          setItems(prev => (prev.some(p => p.kind === 'hotel') ? prev : [...prev, ...hs].sort(byKind)))
          if (hs.length) setOpen(true)
        } catch { /* ignoruj */ }
      }
    }, 140)
  }, [hotelLinks])

  const pick = (s: Sug) => {
    setOpen(false)
    if (s.kind === 'hotel' && s.slug && !stay) { router.push(`/hotel/${s.slug}`); return }
    // u ubytování hledáme na Booking.com podle názvu hotelu a letoviska
    setValue(stay && s.kind === 'hotel' && s.sub ? `${s.label}, ${s.sub.split(',')[0].trim()}` : s.label)
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
          <div className="z-dsuggest__head">
            {stay
              ? <><Icon name="hotel" size="sm" />{value.trim() === '' ? 'Kde chceš bydlet?' : 'Kde budeš spát?'}</>
              : <><Icon name="letadlo" size="sm" />{value.trim() === '' ? 'Kam by to mělo být?' : 'Kam poletíme?'}</>}
          </div>
          {items.map((s, i) => (
            <div key={`${s.kind}-${s.label}-${i}`} role="presentation">
              {(i === 0 || items[i - 1].kind !== s.kind) && value.trim() !== '' && <div className="z-dsuggest__group">{GROUP[s.kind]}</div>}
              <button
                type="button"
                role="option"
                aria-selected={i === hi}
                className="z-dsuggest__item"
                data-active={i === hi}
                data-kind={s.kind}
                onMouseEnter={() => setHi(i)}
                onMouseDown={e => { e.preventDefault(); pick(s) }}
              >
                <span className="z-dsuggest__ic"><Icon name={KIND[s.kind].icon} /></span>
                <span className="z-dsuggest__txt">
                  <b>{hl(s.label, value)}</b>
                  <small>{KIND[s.kind].label}{s.sub ? ` · ${s.sub}` : ''}</small>
                </span>
                {s.count && !stay ? <span className="z-dsuggest__count"><b>{s.count}</b> hotelů</span> : null}
                <span className="z-dsuggest__go" aria-hidden="true"><Icon name="sipka" size="sm" /></span>
              </button>
            </div>
          ))}
          <div className="z-dsuggest__foot z-data"><Icon name="arrowsUpDown" size="sm" />{stay ? '↑↓ VÝBĚR · JINÉ MÍSTO NAPIŠ A ENTER HLEDÁ' : '↑↓ VÝBĚR · ENTER POTVRDÍ · ESC ZAVŘE'}</div>
        </div>,
        document.body,
      )}
    </div>
  )
}
