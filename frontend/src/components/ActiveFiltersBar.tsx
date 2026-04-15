'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { PiX, PiCalendarBlank, PiMoonStars, PiForkKnife, PiStar, PiCurrencyDollar, PiAirplane, PiMapPin } from 'react-icons/pi'

function formatDateShort(s: string) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}

function fmtKc(v: number) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(v)
}

interface Chip {
  key: string
  label: string
  icon?: React.ReactNode
  removeKeys: string[]
  removeValue?: string
}

export default function ActiveFiltersBar() {
  const sp     = useSearchParams()
  const router = useRouter()

  const chips: Chip[] = []

  // Date range
  const dateFrom = sp.get('date_from') || ''
  const dateTo   = sp.get('date_to')   || ''
  if (dateFrom || dateTo) {
    const label = dateFrom && dateTo
      ? `${formatDateShort(dateFrom)} – ${formatDateShort(dateTo)}`
      : dateFrom ? `od ${formatDateShort(dateFrom)}`
      : `do ${formatDateShort(dateTo)}`
    chips.push({
      key: 'date', label, icon: <PiCalendarBlank className="w-3 h-3" />,
      removeKeys: ['date_from', 'date_to', 'date_flex'],
    })
  }

  // Duration
  const duration = sp.get('duration') || ''
  if (duration) {
    chips.push({
      key: 'duration', label: `${duration} nocí`, icon: <PiMoonStars className="w-3 h-3" />,
      removeKeys: ['duration'],
    })
  }

  // Meal plans
  const mealPlans = (sp.get('meal_plan') || '').split(',').filter(Boolean)
  for (const mp of mealPlans) {
    chips.push({
      key: `meal_${mp}`, label: mp, icon: <PiForkKnife className="w-3 h-3" />,
      removeKeys: ['meal_plan'], removeValue: mp,
    })
  }

  // Stars
  const stars = (sp.get('stars') || '').split(',').filter(Boolean)
  for (const s of stars) {
    chips.push({
      key: `stars_${s}`,
      label: '★'.repeat(Number(s)),
      icon: <PiStar className="w-3 h-3" />,
      removeKeys: ['stars'], removeValue: s,
    })
  }

  // Price range
  const minPrice = sp.get('min_price') || ''
  const maxPrice = sp.get('max_price') || ''
  if (minPrice || maxPrice) {
    const label = minPrice && maxPrice
      ? `${fmtKc(Number(minPrice))} – ${fmtKc(Number(maxPrice))} Kč`
      : minPrice ? `od ${fmtKc(Number(minPrice))} Kč`
      : `do ${fmtKc(Number(maxPrice))} Kč`
    chips.push({
      key: 'price', label, icon: <PiCurrencyDollar className="w-3 h-3" />,
      removeKeys: ['min_price', 'max_price'],
    })
  }

  // Transport
  const transport = sp.get('transport') || ''
  if (transport) {
    chips.push({
      key: 'transport', label: transport, icon: <PiAirplane className="w-3 h-3" />,
      removeKeys: ['transport'],
    })
  }

  // Departure cities
  const depCities = (sp.get('departure_city') || '').split(',').filter(Boolean)
  for (const city of depCities) {
    chips.push({
      key: `dep_${city}`, label: city, icon: <PiAirplane className="w-3 h-3" />,
      removeKeys: ['departure_city'], removeValue: city,
    })
  }

  // Destinations (multi-destination case — show each with X)
  const dests = (sp.get('destination') || '').split(',').filter(Boolean)
  if (dests.length > 1) {
    for (const dest of dests) {
      chips.push({
        key: `dest_${dest}`, label: dest, icon: <PiMapPin className="w-3 h-3" />,
        removeKeys: ['destination'], removeValue: dest,
      })
    }
  }

  if (chips.length === 0) return null

  const removeChip = (chip: Chip) => {
    const params = new URLSearchParams(sp.toString())
    if (chip.removeValue) {
      const key = chip.removeKeys[0]
      const existing = (params.get(key) || '').split(',').filter(Boolean)
      const updated  = existing.filter(v => v !== chip.removeValue)
      updated.length > 0 ? params.set(key, updated.join(',')) : params.delete(key)
    } else {
      for (const key of chip.removeKeys) params.delete(key)
    }
    const qs = params.toString()
    router.push(qs ? `/?${qs}` : '/')
  }

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {chips.map(chip => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[11px] font-semibold"
          style={{
            background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
            color: '#fff',
            border: '1px solid rgba(0,147,255,0.50)',
            boxShadow: '0 2px 8px rgba(0,147,255,0.22)',
          }}
        >
          {chip.icon}
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={() => removeChip(chip)}
            aria-label={`Zrušit filtr ${chip.label}`}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full transition-colors hover:bg-white/25 ml-0.5"
          >
            <PiX className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
    </div>
  )
}
