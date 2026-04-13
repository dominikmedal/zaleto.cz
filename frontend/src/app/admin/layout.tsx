'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { adminCheck, adminLogout } from '@/lib/adminApi'
import {
  PiHouse, PiBuildings, PiAirplane, PiNewspaper, PiMapPin,
  PiSignOut, PiSpinner, PiList, PiX
} from 'react-icons/pi'

const NAV = [
  { href: '/admin/prehled',   label: 'Přehled',    icon: PiHouse },
  { href: '/admin/hotely',    label: 'Hotely',      icon: PiBuildings },
  { href: '/admin/zajezdy',   label: 'Zájezdy',     icon: PiAirplane },
  { href: '/admin/clanky',    label: 'Články',      icon: PiNewspaper },
  { href: '/admin/destinace', label: 'Destinace',   icon: PiMapPin },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [ready,  setReady]  = useState(false)
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    if (pathname === '/admin/prihlaseni') { setReady(true); return }
    adminCheck().then(ok => {
      if (!ok) router.replace('/admin/prihlaseni')
      else setReady(true)
    })
  }, [pathname, router])

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <PiSpinner className="w-8 h-8 text-[#0093FF] animate-spin" />
    </div>
  )

  if (pathname === '/admin/prihlaseni') return <>{children}</>

  const logout = () => { adminLogout(); router.push('/admin/prihlaseni') }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {mobile && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobile(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-100 flex flex-col
        transition-transform duration-300
        ${mobile ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
            <PiAirplane className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-800 text-[15px]">zaleto <span className="text-[#0093FF]">admin</span></span>
          <button className="ml-auto lg:hidden" onClick={() => setMobile(false)}>
            <PiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} onClick={() => setMobile(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all ${
                  active
                    ? 'bg-[#0093FF]/8 text-[#0093FF]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}>
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? 'text-[#0093FF]' : 'text-gray-400'}`} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-3 pb-4 flex-shrink-0">
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">
            <PiSignOut className="w-[18px] h-[18px] flex-shrink-0" />
            Odhlásit se
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 h-14 px-4 bg-white border-b border-gray-100">
          <button onClick={() => setMobile(true)} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100">
            <PiList className="w-5 h-5 text-gray-600" />
          </button>
          <span className="font-bold text-gray-800">zaleto admin</span>
        </header>

        <main className="flex-1 p-6 lg:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
