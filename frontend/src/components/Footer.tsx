import Image from 'next/image'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { fetchArticles } from '@/lib/api'

const year = new Date().getFullYear()

const COLUMNS = [
  {
    heading: 'Objevuj',
    items: [
      { label: 'Destinace', href: '/destinace' },
      { label: 'Cestovní deník', href: '/clanky' },
      { label: 'Cestopisy', href: '/cestopisy' },
      { label: 'Počasí a klima', href: '/pocasi' },
      { label: 'Časté otázky', href: '/faq' },
    ],
  },
  {
    heading: 'Cestuj',
    items: [
      { label: 'Všechny zájezdy', href: '/zajezdy' },
      { label: 'Last minute', href: '/zajezdy?tour_type=last_minute' },
      { label: 'First minute', href: '/zajezdy?tour_type=first_minute' },
      { label: 'Půjčovna aut', href: '/pujcovna-aut' },
    ],
  },
  {
    heading: 'Zaleto',
    items: [
      { label: 'Co je Zaleto', href: '/o-zaleto' },
      { label: 'Kontakt', href: '/kontakt' },
      { label: 'Ochrana údajů', href: '/ochrana-osobnich-udaju' },
      { label: 'Zaleto API', href: '/developers' },
    ],
  },
]

export default async function Footer() {
  const recent = await fetchArticles(4).catch(() => [])

  return (
    <footer className="z-footer">
      <div className="z-footer__top">
        <div>
          <h2 className="z-footer__big">kam dál<span className="z-dot">.</span></h2>
          <p>Nové články a nabídky každý týden. Jen místa, která stojí za cestu, a zájezdy za rozumné ceny.</p>
          <Link className="z-btn z-btn--light" href="/zajezdy">
            Najít zájezd<span className="z-btn__go"><Icon name="sipka" /></span>
          </Link>
        </div>

        {COLUMNS.map(col => (
          <div key={col.heading}>
            <h4>{col.heading}</h4>
            <ul>
              {col.items.map(i => <li key={i.label}><Link href={i.href}>{i.label}</Link></li>)}
            </ul>
          </div>
        ))}

        <div>
          <h4>Poslední zápisky</h4>
          <ul>
            {recent.map(a => <li key={a.slug}><Link href={`/clanky/${a.slug}`}>{a.title}</Link></li>)}
            {recent.length === 0 && <li><Link href="/clanky">Cestovní deník</Link></li>}
          </ul>
        </div>
      </div>

      <div className="z-footer__route" aria-hidden="true">
        <span className="z-footer__routeline" />
        <Icon name="letadlo" />
        <span className="z-footer__routeline" />
        <span className="z-footer__routedot" />
      </div>

      <div className="z-footer__bottom">
        <Link href="/" aria-label="zaleto. – domů">
          <Image src="/img/logo/logo.png" alt="zaleto." width={120} height={34} className="z-logo z-logo--light" style={{ height: 28, width: 'auto' }} />
        </Link>
        <span>© {year} ZALETO.CZ · CENY JSOU ORIENTAČNÍ A POCHÁZEJÍ OD PARTNERSKÝCH CK</span>
      </div>
    </footer>
  )
}
