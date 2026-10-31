'use client'
import { useEffect, useState } from 'react'
import Icon, { type IconName } from '@/components/ui/Icon'

const ICONS: Record<string, IconName> = {
  pocasi: 'cloudSun', teploty: 'thermometer', slunce: 'slunce', obdobi: 'leaf', vitr: 'wind', zajezdy: 'letadlo', oblasti: 'poloha',
}

export interface WeatherNavItem { id: string; label: string }

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
      {items.map(({ id, label }) => (
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
