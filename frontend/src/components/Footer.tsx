import Link from 'next/link'
import { fetchArticles } from '@/lib/api'

const year = new Date().getFullYear()

const COLUMNS = [
  {
    heading: 'Kam letět',
    items: [
      { label: 'Všechny zájezdy', href: '/zajezdy' },
      { label: 'Egypt', href: '/zajezdy?destination=Egypt' },
      { label: 'Řecko', href: '/zajezdy?destination=%C5%98ecko' },
      { label: 'Turecko', href: '/zajezdy?destination=Turecko' },
      { label: 'Španělsko', href: '/zajezdy?destination=%C5%A0pan%C4%9Blsko' },
    ],
  },
  {
    heading: 'Zaleto',
    items: [
      { label: 'Půjčovna aut', href: '/pujcovna-aut' },
      { label: 'Cestovní deník', href: '/clanky' },
      { label: 'Počasí a klima', href: '/pocasi' },
      { label: 'Časté otázky', href: '/faq' },
      { label: 'Co je Zaleto', href: '/o-zaleto' },
      { label: 'Kontakt', href: '/kontakt' },
    ],
  },
]

export default async function Footer() {
  const recent = await fetchArticles(5).catch(() => [])

  return (
    <footer className="z-footer">
      <div className="z-footer__top">
        <div>
          <div className="h1 z-footer__big">zaleto<span className="z-dot">.</span></div>
          <p>Porovnáme zájezdy od českých cestovních kanceláří a ukážeme ti, kam se vyplatí letět.</p>
        </div>

        {COLUMNS.map(col => (
          <div key={col.heading}>
            <h4>{col.heading}</h4>
            <ul>
              {col.items.map(i => (
                <li key={i.label}><Link href={i.href}>{i.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4>Poslední zápisky</h4>
          <ul>
            {recent.map(a => (
              <li key={a.slug}><Link href={`/clanky/${a.slug}`}>{a.title}</Link></li>
            ))}
            {recent.length === 0 && <li><Link href="/clanky">Cestovní deník</Link></li>}
          </ul>
        </div>
      </div>

      <div className="z-footer__bottom">
        <span>© {year} ZALETO.CZ</span>
        <span>CENY JSOU ORIENTAČNÍ A POCHÁZEJÍ OD PARTNERSKÝCH CK</span>
      </div>
    </footer>
  )
}
