'use client'
import { useEffect, useState } from 'react'
import Icon, { type IconName } from '@/components/ui/Icon'

const ICONS: Record<string, IconName> = {
  pocasi: 'cloudSun', teploty: 'thermometer', slunce: 'slunce', obdobi: 'leaf', vitr: 'wind', zajezdy: 'letadlo', ubytovani: 'hotel', oblasti: 'poloha',
}

/** `href` = externí odkaz (otevře se v nové kartě) místo posunu na sekci. */
export interface WeatherNavItem { id: string; label: string; href?: string }

/** Rychlá navigace po sekcích stránky o počasí – velké pilulky, aktivní je zčernalá. */
export default function WeatherPageNav({ items }: { items: WeatherNavItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    function update() {
      let current = items[0]?.id ?? ''
      for (const { id } of items) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 140) current = id
      }
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [items])

  return (
    <nav aria-label="Sekce stránky" className="z-navtabs" style={{ marginTop: 'var(--space-6)' }}>
      {items.map(({ id, label, href }) => href ? (
        <a key={id} className="z-navtab" href={href} target="_blank" rel="noopener noreferrer sponsored">
          <span className="z-navtab__ic"><Icon name={ICONS[id] ?? 'letadlo'} /></span>
          <span className="z-navtab__label">{label}</span>
        </a>
      ) : (
        <button
          key={id}
          type="button"
          className="z-navtab"
          aria-current={active === id ? 'true' : undefined}
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <span className="z-navtab__ic"><Icon name={ICONS[id] ?? 'letadlo'} /></span>
          <span className="z-navtab__label">{label}</span>
        </button>
      ))}
    </nav>
  )
}
