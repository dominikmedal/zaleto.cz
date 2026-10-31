'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Icon, { type IconName } from '@/components/ui/Icon'
import { adminCheck, adminLogout } from '@/lib/adminApi'

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/prehled', label: 'Přehled', icon: 'kompas' },
  { href: '/admin/hotely', label: 'Hotely', icon: 'hotel' },
  { href: '/admin/zajezdy', label: 'Zájezdy', icon: 'letadlo' },
  { href: '/admin/clanky', label: 'Články', icon: 'clanek' },
  { href: '/admin/destinace', label: 'Destinace', icon: 'poloha' },
  { href: '/admin/fotky', label: 'Fotky destinací', icon: 'foto' },
  { href: '/admin/pujcovna-aut', label: 'Půjčovna aut', icon: 'auto' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [mobile, setMobile] = useState(false)

  // v administraci se schová veřejný proužek, zápatí a chat
  useEffect(() => {
    document.body.dataset.admin = '1'
    return () => { delete document.body.dataset.admin }
  }, [])

  useEffect(() => {
    if (pathname === '/admin/prihlaseni') { setReady(true); return }
    adminCheck().then(ok => {
      if (!ok) router.replace('/admin/prihlaseni')
      else setReady(true)
    })
  }, [pathname, router])

  if (!ready) return (
    <div className="z-admin z-admin__loading"><Icon name="spinner" size="lg" className="animate-spin" /></div>
  )

  if (pathname === '/admin/prihlaseni') return <div className="z-admin">{children}</div>

  const logout = () => { adminLogout(); router.push('/admin/prihlaseni') }

  return (
    <div className="z-admin z-admin__shell">
      {mobile && <div className="z-admin__scrim" onClick={() => setMobile(false)} />}

      <aside className="z-admin__side" data-open={mobile || undefined}>
        <div className="z-admin__brand">
          <Link href="/" aria-label="zaleto. – web"><Image src="/img/logo/logo.png" alt="zaleto." width={110} height={32} className="z-logo" priority /></Link>
          <span className="z-kicker">Administrace</span>
        </div>

        <nav className="z-admin__nav" aria-label="Administrace">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} onClick={() => setMobile(false)} aria-current={active ? 'page' : undefined}>
                <span className="z-admin__navic"><Icon name={icon} /></span>{label}
              </Link>
            )
          })}
        </nav>

        <div className="z-admin__foot">
          <Link href="/" className="z-more">Zpět na web</Link>
          <button type="button" onClick={logout} className="z-btn z-btn--line z-btn--sm">Odhlásit se<span className="z-btn__go"><Icon name="signOut" /></span></button>
        </div>
      </aside>

      <div className="z-admin__main">
        <header className="z-admin__top">
          <button type="button" className="z-iconbtn" onClick={() => setMobile(true)} aria-label="Menu"><Icon name="menu" /></button>
          <Image src="/img/logo/logo.png" alt="zaleto." width={90} height={26} className="z-logo" style={{ height: 26, width: 'auto' }} />
        </header>
        <main className="z-admin__content">{children}</main>
      </div>
    </div>
  )
}
