'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { PiTimer, PiCalendarStar } from 'react-icons/pi'
import HeaderSearch from './HeaderSearch'
import HeaderFavorites from './HeaderFavorites'
import FavoritesToast from './FavoritesToast'
import PromoBar from './PromoBar'

export default function Header() {
  const sp = useSearchParams()
  const tourType = sp.get('tour_type')
  return (
    <>
      <div className="sticky top-0 z-40">
      <PromoBar />
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div className="max-w-[1680px] mx-auto px-5 sm:px-8 h-16 grid grid-cols-[auto_1fr_auto] items-center gap-4">

          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/img/logo/logo.png"
              alt="Zaleto"
              width={110}
              height={36}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* Search — centered in middle column */}
          <div className="flex justify-center min-w-0">
            <HeaderSearch />
          </div>

          {/* Right: nav + divider + favorites */}
          <div className="flex items-center gap-3">
            <nav className="hidden lg:flex items-center gap-0.5 text-sm font-medium">
              <Link href="/?tour_type=last_minute" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                tourType === 'last_minute'
                  ? 'text-red-600 bg-red-50 font-semibold'
                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
              }`}>
                <PiTimer className="w-4 h-4 flex-shrink-0" />
                Last minute
              </Link>
              <Link href="/?tour_type=first_minute" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                tourType === 'first_minute'
                  ? 'text-emerald-600 bg-emerald-50 font-semibold'
                  : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
              }`}>
                <PiCalendarStar className="w-4 h-4 flex-shrink-0" />
                First minute
              </Link>
              <Link href="/o-zaleto" className="px-3 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap">
                O Zaleto
              </Link>
              <Link href="/kontakt" className="px-3 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap">
                Kontakt
              </Link>
            </nav>
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
