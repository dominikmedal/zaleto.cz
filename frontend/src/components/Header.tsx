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
    <nav className="hidden lg:flex items-center gap-1">
      <div className="flex items-center rounded-full p-[3px] gap-0.5 bg-gray-50 border border-gray-100">
        <Link
          href="/?tour_type=last_minute"
          className={`inline-flex items-center gap-1.5 px-3.5 py-[6px] rounded-full text-[12px] font-semibold transition-colors duration-150 whitespace-nowrap ${
            tourType === 'last_minute'
              ? 'bg-red-500 text-white'
              : 'text-gray-500 hover:bg-white hover:text-red-500'
          }`}
        >
          <PiTimer className="w-3.5 h-3.5 flex-shrink-0" />
          Last minute
        </Link>
        <Link
          href="/?tour_type=first_minute"
          className={`inline-flex items-center gap-1.5 px-3.5 py-[6px] rounded-full text-[12px] font-semibold transition-colors duration-150 whitespace-nowrap ${
            tourType === 'first_minute'
              ? 'bg-emerald-500 text-white'
              : 'text-gray-500 hover:bg-white hover:text-emerald-600'
          }`}
        >
          <PiCalendarStar className="w-3.5 h-3.5 flex-shrink-0" />
          First minute
        </Link>
      </div>

      <Link
        href="/clanky"
        className="px-3 py-1.5 text-[12px] font-medium text-gray-400 hover:text-[#0093FF] transition-colors whitespace-nowrap"
      >
        Články
      </Link>
    </nav>
  )
}

export default function Header() {
  return (
    <>
      <div className="sticky top-0 z-40">
        <PromoBar />
        <header className="bg-white border-b border-gray-100">
          <div className="max-w-[1680px] mx-auto px-3 sm:px-8 flex items-center gap-2 sm:gap-4" style={{ height: 58 }}>

            {/* Logo */}
            <Link
              href="/"
              className="flex-shrink-0 flex items-center pr-5 mr-1 border-r border-gray-100"
            >
              <Image
                src="/img/logo/logo.png"
                alt="Zaleto"
                width={110}
                height={36}
                className="h-7 sm:h-[30px] w-auto object-contain"
                priority
              />
            </Link>

            {/* Filter bar */}
            <div className="flex-1 min-w-0">
              <Suspense>
                <HeaderFilterBar />
              </Suspense>
            </div>

            {/* Right zone */}
            <div className="flex items-center gap-2 flex-shrink-0 pl-4 ml-1 border-l border-gray-100">
              <Suspense>
                <NavLinks />
              </Suspense>
              <HeaderFavorites />
            </div>

          </div>
        </header>
      </div>

      <FavoritesToast />
    </>
  )
}
