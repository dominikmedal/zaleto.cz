'use client'
import { useEffect, useState } from 'react'
import { PiThermometer, PiSun, PiLeaf, PiWind, PiAirplane, PiMapPin, PiCloudSun } from 'react-icons/pi'

const ICONS: Record<string, React.ElementType> = {
  pocasi:  PiCloudSun,
  teploty: PiThermometer,
  slunce:  PiSun,
  obdobi:  PiLeaf,
  vitr:    PiWind,
  zajezdy: PiAirplane,
  oblasti: PiMapPin,
}

export interface WeatherNavItem { id: string; label: string }

export default function WeatherPageNav({ items }: { items: WeatherNavItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    function update() {
      let current = items[0]?.id ?? ''
      for (const { id } of items) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 110) current = id
      }
      setActive(current)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [items])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="max-w-[1680px] mx-auto px-4 sm:px-10 pt-6 pb-0">
      <div className="flex flex-wrap gap-2">
        {items.map(({ id, label }) => {
          const Icon = ICONS[id] ?? PiAirplane
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={isActive ? {
                background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
                color: '#fff',
                border: '1px solid #0093FF',
                boxShadow: '0 4px 14px rgba(0,147,255,0.30)',
              } : {
                background: 'rgba(237,246,255,0.72)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#374151',
                border: '1px solid rgba(200,227,255,0.70)',
                boxShadow: '0 1px 4px rgba(0,147,255,0.06)',
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? '#fff' : '#0093FF' }} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Dashed separator */}
      <div className="mt-5 flex items-center gap-2">
        <PiAirplane
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: '#0093FF', opacity: 0.35, transform: 'rotate(90deg)' }}
        />
        <div
          className="flex-1 h-px"
          style={{ backgroundImage: 'repeating-linear-gradient(to right, rgba(0,147,255,0.18) 0, rgba(0,147,255,0.18) 6px, transparent 6px, transparent 12px)' }}
        />
      </div>
    </div>
  )
}
