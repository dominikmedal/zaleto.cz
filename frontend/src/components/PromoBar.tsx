'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PiArrowRight, PiSparkleFill } from 'react-icons/pi'

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
      className="w-full flex items-center justify-center gap-2.5 px-4 group"
      style={{
        height: 32,
        background: 'linear-gradient(135deg, #0093FF 0%, #0055CC 100%)',
        borderBottom: '1px solid rgba(0,80,200,0.25)',
      }}
    >
      <PiSparkleFill className="w-3 h-3 text-white/60 flex-shrink-0 hidden sm:block" />
      <span className="text-white text-[11px] sm:text-[12px] font-semibold tracking-wide truncate">
        {promo.text}
      </span>
      <span
        className="hidden sm:flex items-center gap-1 flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all group-hover:gap-1.5"
        style={{
          background: 'rgba(255,255,255,0.18)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.25)',
        }}
      >
        Zjistit víc
        <PiArrowRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  )
}
