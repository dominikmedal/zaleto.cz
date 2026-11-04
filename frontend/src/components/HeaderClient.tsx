'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Fragment, useEffect, useState } from 'react'
import Icon, { type IconName } from '@/components/ui/Icon'
import HeaderFavorites from './HeaderFavorites'
import FavoritesToast from './FavoritesToast'
import SiteSearch from './SiteSearch'
import SeasonArt from '@/components/ui/SeasonArt'
import { seasonOf, type SeasonalNav } from '@/lib/season'
import { MONTHS_IN } from '@/lib/seoContent'

/** Ikona roční doby v mobilním menu (vlastní sada ikon). */
const SEASON_ICON: Record<SeasonalNav['season'], IconName> = { spring: 'flower', summer: 'slunce', autumn: 'leaf', winter: 'snowflake' }

/** Stránky se širokým záhlavím (masthead), pod kterým je menu zpočátku průhledné. */
const OVER_ROUTES = ['/', '/pujcovna-aut', '/ubytovani']

const NAV: { href: string; label: string; icon: IconName; type?: 'last_minute' | 'first_minute' }[] = [
  { href: '/zajezdy', label: 'Zájezdy', icon: 'letadlo' },
  { href: '/zajezdy?tour_type=last_minute', label: 'Last minute', icon: 'timer', type: 'last_minute' },
  { href: '/zajezdy?tour_type=first_minute', label: 'First minute', icon: 'kalendar', type: 'first_minute' },
  { href: '/destinace', label: 'Destinace', icon: 'poloha' },
  { href: '/ubytovani', label: 'Ubytování', icon: 'hotel' },
  { href: '/pujcovna-aut', label: 'Půjčovna aut', icon: 'auto' },
  { href: '/clanky', label: 'Články', icon: 'clanek' },
  { href: '/pocasi', label: 'Počasí', icon: 'slunce' },
]

export default function HeaderClient({ months, serverMonth }: { months: { month: number; href: string }[]; serverMonth: number }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // aktuální měsíc podle data v prohlížeči (server pošle jen měsíc, ve kterém se stránka vykreslila)
  const [month, setMonth] = useState(serverMonth)
  useEffect(() => { setMonth(new Date().getMonth() + 1) }, [])
  const link = months.find(m => m.month === month)
  const seasonal: SeasonalNav | null = link ? { href: link.href, label: `Zájezdy v ${MONTHS_IN[month - 1]}`, season: seasonOf(month) } : null
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
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    const openMenu = () => setOpen(o => !o)
    window.addEventListener('z-open-menu', openMenu)
    return () => window.removeEventListener('z-open-menu', openMenu)
  }, [])
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', key)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', key) }
  }, [open])
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
            {NAV.map((item, i) => (
              <Fragment key={item.href}>
                <li>
                  <Link href={item.href} aria-current={isActive(item) ? 'page' : undefined}>
                    {item.label}
                  </Link>
                </li>
                {seasonal && i === 2 && (
                  <li className={`z-header__season z-season--${seasonal.season}`}>
                    <Link href={seasonal.href} aria-current={pathname === seasonal.href ? 'page' : undefined}>
                      <SeasonArt season={seasonal.season} />
                      {seasonal.label}
                    </Link>
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
        </nav>

        <div className="z-header__actions">
          <HeaderFavorites />
          <SiteSearch />
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
        <nav className="z-mnav" aria-label="Mobilní navigace">
          <ul className="z-mnav__list">
            {NAV.map((item, i) => (
              <Fragment key={item.href}>
                <li>
                  <Link href={item.href} className="z-mnav__link" aria-current={isActive(item) ? 'page' : undefined} onClick={() => setOpen(false)}>
                    <span className="z-mnav__icon"><Icon name={item.icon} /></span>
                    <span className="z-mnav__label">{item.label}</span>
                    <Icon name="sipka" />
                  </Link>
                </li>
                {seasonal && i === 2 && (
                  <li className={`z-mnav__season z-season--${seasonal.season}`}>
                    <Link href={seasonal.href} className="z-mnav__link" aria-current={pathname === seasonal.href ? 'page' : undefined} onClick={() => setOpen(false)}>
                      <span className="z-mnav__icon"><SeasonArt season={seasonal.season} /><Icon name={SEASON_ICON[seasonal.season]} /></span>
                      <span className="z-mnav__label">{seasonal.label}</span>
                      <Icon name="sipka" />
                    </Link>
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
          <div className="z-mnav__foot">
            <Link href="/kontakt" className="z-btn z-btn--line z-btn--sm" onClick={() => setOpen(false)}>Kontakt<span className="z-btn__go"><Icon name="envelope" /></span></Link>
            <Link href="/faq" className="z-more" onClick={() => setOpen(false)}>Časté otázky</Link>
          </div>
        </nav>
      )}

      <FavoritesToast />
    </>
  )
}
