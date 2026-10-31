'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import HeaderFavorites from './HeaderFavorites'
import FavoritesToast from './FavoritesToast'

const NAV = [
  { href: '/zajezdy', label: 'Zájezdy' },
  { href: '/destinace', label: 'Destinace' },
  { href: '/pujcovna-aut', label: 'Půjčovna aut' },
  { href: '/clanky', label: 'Články' },
  { href: '/pocasi', label: 'Počasí' },
]

export default function Header() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <header className="z-header">
        <Link href="/" aria-label="zaleto. – domů">
          <Image src="/img/logo/logo.png" alt="zaleto." width={120} height={34} className="z-logo" priority />
        </Link>

        <nav aria-label="Hlavní navigace" style={{ display: 'contents' }}>
          <ul className="z-header__nav">
            {NAV.map(item => (
              <li key={item.href}>
                <Link href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
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
