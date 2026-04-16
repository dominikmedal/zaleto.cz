import Link from 'next/link'
import Image from 'next/image'
import { PiAirplane } from 'react-icons/pi'
import { fetchArticles } from '@/lib/api'

const year = new Date().getFullYear()

const staticLinks = [
  {
    heading: 'Vyhledávání',
    items: [
      { label: 'Všechny zájezdy', href: '/' },
      { label: 'Egypt',           href: '/?destination=Egypt' },
      { label: 'Řecko',           href: '/?destination=%C5%99ecko' },
      { label: 'Turecko',         href: '/?destination=Turecko' },
      { label: 'Španělsko',       href: '/?destination=%C5%A0pan%C4%9Blsko' },
    ],
  },
  {
    heading: 'Zaleto',
    items: [
      { label: 'Půjčovna aut',      href: '/pujcovna-aut' },
      { label: 'Cestovní inspirace',href: '/clanky' },
      { label: 'Počasí & klima',    href: '/pocasi' },
      { label: 'Časté otázky (FAQ)', href: '/faq' },
      { label: 'Co je Zaleto?',     href: '/o-zaleto' },
    ],
  },
]

export default async function Footer() {
  const recentArticles = await fetchArticles(5).catch(() => [])

  return (
    <footer
      className="mt-16"
      style={{
        background: 'rgba(245,248,255,0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(0,147,255,0.10)',
      }}
    >
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

          {/* Static link columns */}
          {staticLinks.map(col => (
            <div key={col.heading}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: '#0093FF' }}>
                {col.heading}
              </p>
              <ul className="space-y-2.5">
                {col.items.map(item => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-500 hover:text-[#0093FF] transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Recent articles column */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-4" style={{ color: '#0093FF' }}>
              Poslední články
            </p>
            <ul className="space-y-2.5">
              {recentArticles.map(article => (
                <li key={article.slug}>
                  <Link
                    href={`/clanky/${article.slug}`}
                    className="text-sm text-gray-500 hover:text-[#0093FF] transition-colors line-clamp-1"
                  >
                    {article.title}
                  </Link>
                </li>
              ))}
              {recentArticles.length === 0 && (
                <li>
                  <Link href="/clanky" className="text-sm text-gray-500 hover:text-[#0093FF] transition-colors">
                    Cestovní inspirace
                  </Link>
                </li>
              )}
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: '1px solid rgba(0,147,255,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <PiAirplane className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#0093FF', opacity: 0.5 }} />
            <span className="text-xs text-gray-400">© {year} zaleto.cz — Vyhledávač zájezdů</span>
          </div>
          <span className="text-xs text-gray-400">Ceny jsou orientační a pochází od partnerských cestovních kanceláří.</span>
        </div>
      </div>
    </footer>
  )
}
