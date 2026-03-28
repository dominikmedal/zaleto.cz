'use client'
import { useEffect, useState } from 'react'
import {
  PiSun, PiCloudSun, PiCloud, PiCloudRain, PiCloudSnow,
  PiCloudLightning, PiWind, PiDrop,
} from 'react-icons/pi'

interface WeatherDay { date: string; maxTemp: number; minTemp: number; code: number; precipProb: number }
interface WeatherData { current: { temp: number; code: number; humidity: number; windSpeed: number }; days: WeatherDay[] }
type WmoEntry = { label: string; Icon: React.ElementType; color: string }

const WMO: Record<number, WmoEntry> = {
  0:  { label: 'Jasno',            Icon: PiSun,            color: 'text-amber-400'  },
  1:  { label: 'Převážně jasno',   Icon: PiCloudSun,       color: 'text-amber-400'  },
  2:  { label: 'Polojasno',        Icon: PiCloudSun,       color: 'text-amber-300'  },
  3:  { label: 'Zataženo',         Icon: PiCloud,          color: 'text-gray-400'   },
  45: { label: 'Mlha',             Icon: PiCloud,          color: 'text-gray-300'   },
  48: { label: 'Mlha',             Icon: PiCloud,          color: 'text-gray-300'   },
  51: { label: 'Mrholení',         Icon: PiCloudRain,      color: 'text-blue-400'   },
  53: { label: 'Mrholení',         Icon: PiCloudRain,      color: 'text-blue-400'   },
  55: { label: 'Silné mrholení',   Icon: PiCloudRain,      color: 'text-blue-500'   },
  61: { label: 'Déšť',             Icon: PiCloudRain,      color: 'text-blue-500'   },
  63: { label: 'Silný déšť',       Icon: PiCloudRain,      color: 'text-blue-600'   },
  65: { label: 'Průtrž mračen',    Icon: PiCloudRain,      color: 'text-blue-700'   },
  71: { label: 'Sněžení',          Icon: PiCloudSnow,      color: 'text-sky-300'    },
  73: { label: 'Sněžení',          Icon: PiCloudSnow,      color: 'text-sky-400'    },
  75: { label: 'Silné sněžení',    Icon: PiCloudSnow,      color: 'text-sky-500'    },
  80: { label: 'Přeháňky',         Icon: PiCloudRain,      color: 'text-blue-400'   },
  81: { label: 'Přeháňky',         Icon: PiCloudRain,      color: 'text-blue-500'   },
  82: { label: 'Přívalové srážky', Icon: PiCloudRain,      color: 'text-blue-600'   },
  95: { label: 'Bouřka',           Icon: PiCloudLightning, color: 'text-violet-500' },
  96: { label: 'Kroupy',           Icon: PiCloudLightning, color: 'text-violet-600' },
  99: { label: 'Kroupy',           Icon: PiCloudLightning, color: 'text-violet-700' },
}

function wmo(code: number): WmoEntry {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? WMO[1]
}

const DAY = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']

function tempColor(t: number) {
  if (t >= 30) return 'text-red-500'
  if (t >= 24) return 'text-orange-400'
  if (t >= 18) return 'text-amber-500'
  if (t >= 10) return 'text-emerald-500'
  return 'text-blue-400'
}

export default function WeatherWidget({ lat, lon, location, noCard }: { lat: number; lon: number; location: string; noCard?: boolean }) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [error, setError] = useState(false)
  const [selectedDay, setSelectedDay] = useState(0)

  useEffect(() => {
    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
      '&longitude=' + lon +
      '&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m' +
      '&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max' +
      '&forecast_days=6&timezone=auto'
    )
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(json => setData({
        current: {
          temp: Math.round(json.current.temperature_2m),
          code: json.current.weather_code,
          humidity: Math.round(json.current.relative_humidity_2m),
          windSpeed: Math.round(json.current.wind_speed_10m),
        },
        days: json.daily.time.slice(0, 6).map((date: string, i: number) => ({
          date,
          maxTemp: Math.round(json.daily.temperature_2m_max[i]),
          minTemp: Math.round(json.daily.temperature_2m_min[i]),
          code: json.daily.weather_code[i],
          precipProb: json.daily.precipitation_probability_max[i] ?? 0,
        })),
      }))
      .catch(() => setError(true))
  }, [lat, lon])

  if (error) return null

  if (!data) {
    const skeleton = (
      <div className="animate-pulse">
        <div className="h-16 bg-gray-100 rounded-xl m-4 mb-3" />
        <div className="grid grid-cols-6 gap-px px-4 pb-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
        </div>
      </div>
    )
    return noCard ? skeleton : <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">{skeleton}</div>
  }

  const today = new Date()

  // Displayed data — either live current (day 0) or selected day's forecast
  const isToday = selectedDay === 0
  const activeDay = data.days[selectedDay]
  const displayCode = isToday ? data.current.code : activeDay.code
  const displayTemp = isToday ? data.current.temp : activeDay.maxTemp
  const displayLabel = isToday
    ? wmo(data.current.code).label
    : `${activeDay.maxTemp}° / ${activeDay.minTemp}°`
  const cur = wmo(displayCode)

  const inner = (
    <>
      {/* Header — updates on day click */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <cur.Icon className={'w-9 h-9 flex-shrink-0 ' + cur.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-0.5 leading-none">
            <span className="text-4xl font-bold leading-none tabular-nums" style={{ color: '#008afe' }}>
              {displayTemp}
            </span>
            <span className="text-xl font-medium text-gray-400">°C</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{displayLabel}</p>
        </div>
        {isToday && (
          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <PiWind className="w-3.5 h-3.5 text-gray-400" />
              {data.current.windSpeed} km/h
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <PiDrop className="w-3.5 h-3.5 text-blue-400" />
              {data.current.humidity}%
            </span>
          </div>
        )}
        {!isToday && (
          <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <PiDrop className="w-3.5 h-3.5 text-blue-400" />
              {activeDay.precipProb}%
            </span>
          </div>
        )}
      </div>

      {/* 6-day forecast — clickable */}
      <div className="grid grid-cols-6 border-t border-gray-100">
        {data.days.map((day, i) => {
          const dayName = i === 0 ? 'Dnes' : DAY[(today.getDay() + i) % 7]
          const w = wmo(day.code)
          const isSelected = selectedDay === i
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelectedDay(i)}
              className={
                'flex flex-col items-center gap-1.5 py-3 px-1 transition-colors' +
                (i > 0 ? ' border-l border-gray-100' : '') +
                (isSelected ? ' bg-[#008afe]/5' : ' hover:bg-gray-50')
              }
            >
              <span className={
                'text-[11px] font-semibold leading-none transition-colors' +
                (isSelected ? ' text-[#008afe]' : ' text-gray-400')
              }>
                {dayName}
              </span>
              <w.Icon className={'w-5 h-5 ' + w.color} />
              <span className={'text-sm font-bold leading-none tabular-nums ' + tempColor(day.maxTemp)}>
                {day.maxTemp}°
              </span>
              <span className="text-xs font-medium leading-none tabular-nums text-gray-400">
                {day.minTemp}°
              </span>
            </button>
          )
        })}
      </div>
    </>
  )

  return noCard
    ? inner
    : <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">{inner}</div>
}
