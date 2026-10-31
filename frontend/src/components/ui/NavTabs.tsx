import Link from 'next/link'
import Icon, { type IconName } from './Icon'

export interface NavTabItem { href: string; label: string; icon: IconName }

/** Velké pilulky pro rychlou navigaci do sekcí (#kotvy) nebo na související stránky. */
export default function NavTabs({ items, label = 'Rychlá navigace' }: { items: NavTabItem[]; label?: string }) {
  if (items.length === 0) return null
  return (
    <nav aria-label={label} className="z-navtabs">
      {items.map(t => {
        const inner = (
          <>
            <span className="z-navtab__ic"><Icon name={t.icon} /></span>
            <span className="z-navtab__label">{t.label}</span>
            <Icon name="sipka" size="sm" className="z-navtab__go" />
          </>
        )
        return t.href.startsWith('#')
          ? <a key={t.label} href={t.href} className="z-navtab">{inner}</a>
          : <Link key={t.label} href={t.href} className="z-navtab">{inner}</Link>
      })}
    </nav>
  )
}
