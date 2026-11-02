'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icon, { type IconName } from '@/components/ui/Icon'

/** Spodní navigace jen na telefonu (CSS ji jinde skrývá): hlavní cíle na dosah palce. */
const ITEMS: { href: string; label: string; icon: IconName; hot?: boolean }[] = [
  { href: '/zajezdy', label: 'Zájezdy', icon: 'letadlo' },
  { href: '/zajezdy?tour_type=last_minute', label: 'Last minute', icon: 'timer', hot: true },
  { href: '/destinace', label: 'Destinace', icon: 'poloha' },
  { href: '/pujcovna-aut', label: 'Autopůjčovny', icon: 'auto' },
]

export default function MobileTabBar() {
  const pathname = usePathname()
  // typ nabídky z adresy (bez useSearchParams, ať stránky zůstanou statické)
  const [tourType, setTourType] = useState<string | null>(null)
  useEffect(() => {
    const read = () => setTourType(new URLSearchParams(window.location.search).get('tour_type'))
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [pathname])
  const active = (href: string) => {
    const [base, query] = href.split('?')
    const type = query ? new URLSearchParams(query).get('tour_type') : null
    if (type) return pathname === base && tourType === type
    if (base === '/zajezdy') return pathname === base && !tourType
    return pathname === base || pathname.startsWith(base + '/')
  }
  return (
    <nav className="z-tabbar" aria-label="Rychlá navigace">
      {ITEMS.map(i => (
        <Link key={i.href} href={i.href} className="z-tabbar__item" data-hot={i.hot ? '' : undefined} aria-current={active(i.href) ? 'page' : undefined}
          onClick={() => setTourType(new URLSearchParams(i.href.split('?')[1] ?? '').get('tour_type'))}>
          <Icon name={i.icon} />
          <span>{i.label}</span>
        </Link>
      ))}
      <button type="button" className="z-tabbar__item" onClick={() => window.dispatchEvent(new Event('z-open-menu'))} aria-label="Otevřít menu">
        <Icon name="menu" />
        <span>Menu</span>
      </button>
    </nav>
  )
}
