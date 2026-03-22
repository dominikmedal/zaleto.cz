'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { PiTimer, PiCalendarStar } from 'react-icons/pi'
import { Suspense } from 'react'
import HeaderFilterBar from './HeaderFilterBar'
import HeaderFavorites from './HeaderFavorites'
import FavoritesToast from './FavoritesToast'
import PromoBar from './PromoBar'

function NavLinks() {
  const sp = useSearchParams()
  const tourType = sp.get('tour_type')
  return (
    <nav className="hidden lg:flex items-center gap-0.5 text-sm font-medium">
      <Link href="/?tour_type=last_minute" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-red-600 ${
        tourType === 'last_minute' ? 'bg-red-50 font-semibold' : 'hover:bg-red-50'
      }`}>
        <PiTimer className="w-4 h-4 flex-shrink-0" />
        Last minute
      </Link>
      <Link href="/?tour_type=first_minute" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-emerald-600 ${
        tourType === 'first_minute' ? 'bg-emerald-50 font-semibold' : 'hover:bg-emerald-50'
      }`}>
        <PiCalendarStar className="w-4 h-4 flex-shrink-0" />
        First minute
      </Link>
      <Link href="/kontakt" className="px-3 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap">
        Kontakt
      </Link>
    </nav>
  )
}

export default function Header() {
  return (
    <>
      <div className="sticky top-0 z-40">
        <PromoBar />
        <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="max-w-[1680px] mx-auto px-3 sm:px-8 py-3 flex items-center gap-2 sm:gap-4">

            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/img/logo/logo.png"
                alt="Zaleto"
                width={110}
                height={36}
                className="h-7 sm:h-8 w-auto object-contain"
                priority
              />
            </Link>

            {/* Compact filter bar — takes all middle space */}
            <Suspense>
              <HeaderFilterBar />
            </Suspense>

            {/* Right: nav + favorites */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Suspense>
                <NavLinks />
              </Suspense>
              <div className="hidden lg:block w-px h-5 bg-gray-200 flex-shrink-0" />
              <HeaderFavorites />
            </div>

          </div>
        </header>
      </div>

      {/* Toast portal */}
      <FavoritesToast />
    </>
  )
}
