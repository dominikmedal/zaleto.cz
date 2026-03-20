'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PiArrowRight } from 'react-icons/pi'

const PROMOS = [
  { text: 'Letní výprodej — All Inclusive od 8 990 Kč · Porovnej termíny hned', href: '/?meal_plan=All+Inclusive&sort=price_asc' },
  { text: 'Egypt v červenci od 9 490 Kč / osoba · Rezervuj s předstihem', href: '/?destination=Egypt&sort=price_asc' },
  { text: 'Řecko 7 nocí All Inclusive od 7 990 Kč · Zjistit víc', href: '/?destination=%C5%98ecko&meal_plan=All+Inclusive&sort=price_asc' },
  { text: 'Turecko od 11 490 Kč · Stovky termínů na jednom místě', href: '/?destination=Turecko&meal_plan=All+Inclusive&sort=price_asc' },
  { text: 'Last minute slevy až −40 % · Neváhej a rezervuj dnes', href: '/?sort=price_asc' },
  { text: 'Španělsko all inclusive od 12 490 Kč · Srovnej CK v jednom kroku', href: '/?destination=%C5%A0pan%C4%9Blsko&meal_plan=All+Inclusive&sort=price_asc' },
]

export default function PromoBar() {
  const router = useRouter()
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(Math.floor(Math.random() * PROMOS.length))
  }, [])

  const promo = PROMOS[idx]

  return (
    <button
      onClick={() => router.push(promo.href)}
      className="w-full h-8 bg-[#008afe] hover:bg-[#0079e5] transition-colors flex items-center justify-center gap-2 px-4 group"
    >
      <span className="text-white text-[11px] sm:text-xs font-medium tracking-wide truncate">
        {promo.text}
      </span>
      <PiArrowRight className="w-3 h-3 text-white/70 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </button>
  )
}
