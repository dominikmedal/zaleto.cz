'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icon from '@/components/ui/Icon'
import HeaderFavorites from './HeaderFavorites'
import FavoritesToast from './FavoritesToast'

/** Stránky se širokým záhlavím (masthead), pod kterým je menu zpočátku průhledné. */
const OVER_ROUTES = ['/', '/pujcovna-aut']

const NAV: { href: string; label: string; type?: 'last_minute' | 'first_minute' }[] = [
  { href: '/zajezdy', label: 'Zájezdy' },
  { href: '/zajezdy?tour_type=last_minute', label: 'Last minute', type: 'last_minute' },
  { href: '/zajezdy?tour_type=first_minute', label: 'First minute', type: 'first_minute' },
  { href: '/destinace', label: 'Destinace' },
  { href: '/pujcovna-aut', label: 'Půjčovna aut' },
  { href: '/clanky', label: 'Články' },
  { href: '/pocasi', label: 'Počasí' },
]

export default function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [tourType, setTourType] = useState<string | null>(null)
  // typ nabídky z adresy (bez useSearchParams, ať stránky zůstanou statické)
  useEffect(() => { setTourType(new URLSearchParams(window.location.search).get('tour_type')) }, [pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const over = OVER_ROUTES.includes(pathname) && !scrolled && !open
  const isActive = (item: (typeof NAV)[number]) => {
    if (item.type) return pathname === '/zajezdy' && tourType === item.type
    if (item.href === '/zajezdy') return pathname === '/zajezdy' && !tourType
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <>
      <header className={`z-header${over ? ' z-header--over' : ''}`}>
        <Link href="/" aria-label="zaleto. – domů">
          <Image src="/img/logo/logo.png" alt="zaleto." width={120} height={34} className={`z-logo${over ? ' z-logo--light' : ''}`} priority />
        </Link>

        <nav aria-label="Hlavní navigace" style={{ display: 'contents' }}>
          <ul className="z-header__nav">
            {NAV.map(item => (
              <li key={item.href}>
                <Link href={item.href} aria-current={isActive(item) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="z-header__actions">
          <HeaderFavorites />
          <Link href="/zajezdy" className="z-iconbtn" aria-label="Hledat zájezd">
            <Icon name="hledat" />
          </Link>
          <button
            type="button"
            className="z-iconbtn z-header__burger"
            aria-label={open ? 'Zavřít menu' : 'Otevřít menu'}
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            <Icon name={open ? 'zavrit' : 'menu'} />
          </button>
        </div>
      </header>

      {open && (
        <nav
          aria-label="Mobilní navigace"
          style={{ position: 'fixed', inset: 'var(--header-height) 0 0 0', zIndex: 49, background: 'var(--paper)', padding: 'var(--space-6)' }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {NAV.map(item => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="h2"
                  style={{ color: 'var(--ink)', textDecoration: 'none' }}
                  onClick={() => setOpen(false)}
                >
                  {item.label}<span className="z-dot">.</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <FavoritesToast />
    </>
  )
}
