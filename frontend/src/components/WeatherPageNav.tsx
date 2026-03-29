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
      {/* Buttons — DestinationHeroAI style */}
      <div className="flex flex-wrap gap-2">
        {items.map(({ id, label }) => {
          const Icon = ICONS[id] ?? PiAirplane
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                isActive
                  ? 'bg-[#008afe] text-white shadow-[#008afe]/25 shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-[#008afe]/40 hover:text-[#008afe] hover:shadow-md'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          )
        })}
      </div>

      {/* Dashed runway — airplane motif from HomeStepper */}
      <div className="mt-4 flex items-center gap-2">
        <PiAirplane className="w-3.5 h-3.5 text-[#008afe] flex-shrink-0" style={{ transform: 'rotate(90deg)' }} />
        <div
          className="flex-1 h-px"
          style={{ backgroundImage: 'repeating-linear-gradient(to right, #d1d5db 0, #d1d5db 6px, transparent 6px, transparent 12px)' }}
        />
      </div>
    </div>
  )
}
