'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useFavorites } from '@/hooks/useFavorites'

/** Oblíbené hotely v hlavičce: srdce s počtem a panel jako palubní lístek. */
export default function HeaderFavorites() {
  const { favoriteHotels, toggleFavorite } = useFavorites()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const count = favoriteHotels.length

  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [])

  return (
    <div ref={ref} className="z-favs">
      <button
        type="button"
        className="z-iconbtn z-favs__btn"
        onClick={() => setOpen(o => !o)}
        aria-label={`Oblíbené hotely${count ? ` (${count})` : ''}`}
        aria-expanded={open}
      >
        <Icon name="srdce" style={count > 0 ? { fill: 'currentColor' } : undefined} />
        {count > 0 && <span className="z-favs__count">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="z-tk z-tk--h z-favs__panel" style={{ ['--cut' as string]: '0px' }} role="dialog" aria-label="Oblíbené hotely">
          <div className="z-tk__in">
            <div className="z-favs__head">
              <div>
                <div className="z-kicker">Uložené</div>
                <h2 className="h4" style={{ marginTop: 2 }}>oblíbené hotely<span className="z-dot">.</span></h2>
              </div>
              <button type="button" className="z-iconbtn" onClick={() => setOpen(false)} aria-label="Zavřít"><Icon name="zavrit" /></button>
            </div>

            {count === 0 ? (
              <div className="z-favs__empty">
                <span className="z-favs__emptyic"><Icon name="srdce" size="lg" /></span>
                <p className="h4" style={{ margin: 0 }}>zatím nic</p>
                <p>Klikni na srdíčko u hotelu a najdeš ho tady.</p>
              </div>
            ) : (
              <ul className="z-favs__list">
                {favoriteHotels.map(({ slug, name }) => (
                  <li key={slug}>
                    <Link href={`/hotel/${slug}`} onClick={() => setOpen(false)}>
                      <span className="z-favs__rowic"><Icon name="hotel" /></span>
                      <span className="z-favs__name">{name}</span>
                      <Icon name="sipka" size="sm" />
                    </Link>
                    <button type="button" onClick={() => toggleFavorite(slug)} aria-label={`Odebrat ${name} z oblíbených`}><Icon name="zavrit" size="sm" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
