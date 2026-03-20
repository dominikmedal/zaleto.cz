import Link from 'next/link'
import Image from 'next/image'

const year = new Date().getFullYear()

const links = [
  {
    heading: 'Vyhledávání',
    items: [
      { label: 'Všechny zájezdy', href: '/' },
      { label: 'Egypt', href: '/?destination=Egypt' },
      { label: 'Řecko', href: '/?destination=%C5%99ecko' },
      { label: 'Turecko', href: '/?destination=Turecko' },
      { label: 'Španělsko', href: '/?destination=%C5%A0pan%C4%9Blsko' },
    ],
  },
  {
    heading: 'Stravování',
    items: [
      { label: 'All Inclusive', href: '/?meal_plan=All+Inclusive' },
      { label: 'Polopenze', href: '/?meal_plan=Polopenze' },
      { label: 'Plná penze', href: '/?meal_plan=Pln%C3%A1+penze' },
      { label: 'Snídaně', href: '/?meal_plan=Sn%C3%ADdan%C4%9B' },
    ],
  },
  {
    heading: 'Pomoc & Podpora',
    items: [
      { label: 'Časté otázky (FAQ)', href: '/faq' },
      { label: 'Kontakt', href: '/kontakt' },
      { label: 'Co je Zaleto?', href: '/o-zaleto' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-100 bg-white">
      <div className="max-w-[1680px] mx-auto px-6 sm:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/img/logo/logo.png"
                alt="Zaleto"
                width={110}
                height={36}
                className="h-8 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed max-w-[220px]">
              Porovnejte zájezdy od předních cestovních kanceláří na jednom místě.
            </p>
          </div>

          {/* Link columns */}
          {links.map(col => (
            <div key={col.heading}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                {col.heading}
              </p>
              <ul className="space-y-2.5">
                {col.items.map(item => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-500 hover:text-[#008afe] transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {year} zaleto.cz — Vyhledávač zájezdů</span>
          <span>Ceny jsou orientační a pochází od partnerských cestovních kanceláří.</span>
        </div>
      </div>
    </footer>
  )
}
