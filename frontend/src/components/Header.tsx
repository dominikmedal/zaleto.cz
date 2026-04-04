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
      {/* Glass pill group */}
      <div
        className="flex items-center rounded-full p-[3px] gap-0.5"
        style={{
          background: 'rgba(237,246,255,0.72)',
          border: '1px solid rgba(200,227,255,0.65)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 1px 6px rgba(0,147,255,0.08), inset 0 1px 0 rgba(255,255,255,0.85)',
        }}
      >
        <Link
          href="/?tour_type=last_minute"
          className={`inline-flex items-center gap-1.5 px-3.5 py-[6px] rounded-full text-[12px] font-semibold transition-all duration-200 whitespace-nowrap ${
            tourType === 'last_minute'
              ? 'bg-red-500 text-white shadow-[0_1px_8px_rgba(239,68,68,0.35)]'
              : 'text-[#0068CC] hover:bg-white/80 hover:shadow-sm hover:text-red-500'
          }`}
        >
          <PiTimer className="w-3.5 h-3.5 flex-shrink-0" />
          Last minute
        </Link>
        <Link
          href="/?tour_type=first_minute"
          className={`inline-flex items-center gap-1.5 px-3.5 py-[6px] rounded-full text-[12px] font-semibold transition-all duration-200 whitespace-nowrap ${
            tourType === 'first_minute'
              ? 'bg-emerald-500 text-white shadow-[0_1px_8px_rgba(16,185,129,0.35)]'
              : 'text-[#0068CC] hover:bg-white/80 hover:shadow-sm hover:text-emerald-600'
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

        <header
          style={{
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            borderBottom: '1px solid rgba(200,227,255,0.55)',
            boxShadow: '0 1px 0 rgba(234,244,255,0.85), 0 4px 32px -8px rgba(0,100,220,0.10)',
          }}
        >
          <div className="max-w-[1680px] mx-auto px-3 sm:px-8 flex items-center gap-2 sm:gap-4" style={{ height: 58 }}>

            {/* Logo */}
            <Link
              href="/"
              className="flex-shrink-0 flex items-center"
              style={{
                paddingRight: '1.25rem',
                marginRight: '0.25rem',
                borderRight: '1px solid rgba(200,227,255,0.5)',
              }}
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
            <div
              className="flex items-center gap-2 flex-shrink-0"
              style={{
                paddingLeft: '1rem',
                marginLeft: '0.25rem',
                borderLeft: '1px solid rgba(200,227,255,0.5)',
              }}
            >
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
