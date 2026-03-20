'use client'
import Link from 'next/link'
import Image from 'next/image'
import HeaderSearch from './HeaderSearch'
import HeaderFavorites from './HeaderFavorites'
import FavoritesToast from './FavoritesToast'
import PromoBar from './PromoBar'

export default function Header() {
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
              <Link href="/o-zaleto" className="px-3 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap">
                O Zaleto
              </Link>
              <Link href="/?sort=price_asc" className="px-3 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap">
                Nejlevnější
              </Link>
              <Link href="/?meal_plan=All+Inclusive" className="px-3 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap">
                All Inclusive
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
