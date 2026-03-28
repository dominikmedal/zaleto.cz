'use client'
import { useEffect, useState } from 'react'
import {
  PiSun, PiCloudSun, PiCloud, PiCloudRain, PiCloudSnow,
  PiCloudLightning, PiWind, PiDrop, PiThermometerSimple,
} from 'react-icons/pi'

interface WeatherDay { date: string; maxTemp: number; minTemp: number; code: number; precipProb: number }
interface WeatherData { current: { temp: number; code: number; humidity: number; windSpeed: number }; days: WeatherDay[] }
type WmoEntry = { label: string; Icon: React.ElementType; color: string; bg: string }

const WMO: Record<number, WmoEntry> = {
  0:  { label: 'Jasno',            Icon: PiSun,            color: 'text-amber-400',  bg: 'bg-amber-50'  },
  1:  { label: 'Převážně jasno',   Icon: PiCloudSun,       color: 'text-amber-400',  bg: 'bg-amber-50'  },
  2:  { label: 'Polojasno',        Icon: PiCloudSun,       color: 'text-amber-300',  bg: 'bg-amber-50'  },
  3:  { label: 'Zataženo',         Icon: PiCloud,          color: 'text-gray-400',   bg: 'bg-gray-50'   },
  45: { label: 'Mlha',             Icon: PiCloud,          color: 'text-gray-300',   bg: 'bg-gray-50'   },
  48: { label: 'Mlha',             Icon: PiCloud,          color: 'text-gray-300',   bg: 'bg-gray-50'   },
  51: { label: 'Mrholení',         Icon: PiCloudRain,      color: 'text-blue-400',   bg: 'bg-blue-50'   },
  53: { label: 'Mrholení',         Icon: PiCloudRain,      color: 'text-blue-400',   bg: 'bg-blue-50'   },
  55: { label: 'Silné mrholení',   Icon: PiCloudRain,      color: 'text-blue-500',   bg: 'bg-blue-50'   },
  61: { label: 'Déšť',             Icon: PiCloudRain,      color: 'text-blue-500',   bg: 'bg-blue-50'   },
  63: { label: 'Silný déšť',       Icon: PiCloudRain,      color: 'text-blue-600',   bg: 'bg-blue-50'   },
  65: { label: 'Průtrž mračen',    Icon: PiCloudRain,      color: 'text-blue-700',   bg: 'bg-blue-50'   },
  71: { label: 'Sněžení',          Icon: PiCloudSnow,      color: 'text-sky-300',    bg: 'bg-sky-50'    },
  73: { label: 'Sněžení',          Icon: PiCloudSnow,      color: 'text-sky-400',    bg: 'bg-sky-50'    },
  75: { label: 'Silné sněžení',    Icon: PiCloudSnow,      color: 'text-sky-500',    bg: 'bg-sky-50'    },
  80: { label: 'Přeháňky',         Icon: PiCloudRain,      color: 'text-blue-400',   bg: 'bg-blue-50'   },
  81: { label: 'Přeháňky',         Icon: PiCloudRain,      color: 'text-blue-500',   bg: 'bg-blue-50'   },
  82: { label: 'Přívalové srážky', Icon: PiCloudRain,      color: 'text-blue-600',   bg: 'bg-blue-50'   },
  95: { label: 'Bouřka',           Icon: PiCloudLightning, color: 'text-violet-500', bg: 'bg-violet-50' },
  96: { label: 'Kroupy',           Icon: PiCloudLightning, color: 'text-violet-600', bg: 'bg-violet-50' },
  99: { label: 'Kroupy',           Icon: PiCloudLightning, color: 'text-violet-700', bg: 'bg-violet-50' },
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
      <div className="space-y-3 animate-pulse">
        <div className="h-14 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-6 gap-px">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded" />)}
        </div>
      </div>
    )
    return noCard ? skeleton : <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">{skeleton}</div>
  }

  const cur = wmo(data.current.code)
  const today = new Date()

  const inner = (
    <>
      <div className={'rounded-xl ' + cur.bg + ' px-4 py-3 flex items-center gap-4 mb-4'}>
        <div className="w-12 h-12 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0 shadow-sm">
          <cur.Icon className={'w-7 h-7 ' + cur.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-0.5 leading-none mb-1">
            <span className="text-3xl font-extrabold text-gray-900">{data.current.temp}</span>
            <span className="text-base font-medium text-gray-400">°C</span>
          </div>
          <p className="text-xs text-gray-500 truncate">{cur.label}</p>
        </div>
        <div className="flex-shrink-0 space-y-1.5">
          <div className="flex items-center gap-1 justify-end">
            <PiWind className="w-3 h-3 text-gray-400" />
            <span className="text-[11px] font-semibold text-gray-700">{data.current.windSpeed} <span className="font-normal text-gray-400">km/h</span></span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <PiDrop className="w-3 h-3 text-blue-400" />
            <span className="text-[11px] font-semibold text-gray-700">{data.current.humidity}<span className="font-normal text-gray-400">%</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-6 border-t border-gray-100">
        {data.days.map((day, i) => {
          const dayName = i === 0 ? 'Dnes' : DAY[(today.getDay() + i) % 7]
          const w = wmo(day.code)
          return (
            <div
              key={day.date}
              className={'flex flex-col items-center gap-1 py-3 px-0.5' + (i > 0 ? ' border-l border-gray-100' : '') + (i === 0 ? ' bg-gray-50/50' : '')}
            >
              <span className={'text-[10px] font-bold leading-none ' + (i === 0 ? 'text-[#008afe]' : 'text-gray-400')}>{dayName}</span>
              <div className={'w-7 h-7 rounded-lg flex items-center justify-center' + (i === 0 ? ' ' + w.bg : '')}>
                <w.Icon className={'w-4 h-4 ' + w.color} />
              </div>
              <span className={'text-[11px] font-bold leading-none ' + tempColor(day.maxTemp)}>{day.maxTemp}°</span>
              <span className="text-[10px] text-gray-300 leading-none">{day.minTemp}°</span>
              {day.precipProb >= 20 && (
                <div className="w-5">
                  <div className="h-0.5 rounded-full bg-blue-100 overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: day.precipProb + '%' }} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )

  return noCard
    ? inner
    : <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">{inner}</div>
}
