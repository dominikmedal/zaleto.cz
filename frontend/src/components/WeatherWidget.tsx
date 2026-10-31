'use client'
import { useEffect, useState } from 'react'
import { PiSun, PiCloudSun, PiCloud, PiCloudRain, PiCloudSnow, PiCloudLightning, PiWind, PiDrop } from '@/components/ui/icons'
interface WeatherDay { date: string; maxTemp: number; minTemp: number; code: number; precipProb: number }
interface WeatherData { current: { temp: number; code: number; humidity: number; windSpeed: number }; days: WeatherDay[] }
type WmoEntry = { label: string; Icon: React.ElementType; color: string }

const WMO: Record<number, WmoEntry> = {
  0:  { label: 'Jasno',            Icon: PiSun,            color: 'z-w-sun'  },
  1:  { label: 'Převážně jasno',   Icon: PiCloudSun,       color: 'z-w-sun'  },
  2:  { label: 'Polojasno',        Icon: PiCloudSun,       color: 'z-w-sun'  },
  3:  { label: 'Zataženo',         Icon: PiCloud,          color: 'z-w-cloud'   },
  45: { label: 'Mlha',             Icon: PiCloud,          color: 'z-w-cloud'   },
  48: { label: 'Mlha',             Icon: PiCloud,          color: 'z-w-cloud'   },
  51: { label: 'Mrholení',         Icon: PiCloudRain,      color: 'z-w-rain'   },
  53: { label: 'Mrholení',         Icon: PiCloudRain,      color: 'z-w-rain'   },
  55: { label: 'Silné mrholení',   Icon: PiCloudRain,      color: 'z-w-rain'   },
  61: { label: 'Déšť',             Icon: PiCloudRain,      color: 'z-w-rain'   },
  63: { label: 'Silný déšť',       Icon: PiCloudRain,      color: 'z-w-rain'   },
  65: { label: 'Průtrž mračen',    Icon: PiCloudRain,      color: 'z-w-rain'   },
  71: { label: 'Sněžení',          Icon: PiCloudSnow,      color: 'z-w-snow'    },
  73: { label: 'Sněžení',          Icon: PiCloudSnow,      color: 'z-w-snow'    },
  75: { label: 'Silné sněžení',    Icon: PiCloudSnow,      color: 'z-w-snow'    },
  80: { label: 'Přeháňky',         Icon: PiCloudRain,      color: 'z-w-rain'   },
  81: { label: 'Přeháňky',         Icon: PiCloudRain,      color: 'z-w-rain'   },
  82: { label: 'Přívalové srážky', Icon: PiCloudRain,      color: 'z-w-rain'   },
  95: { label: 'Bouřka',           Icon: PiCloudLightning, color: 'z-w-storm' },
  96: { label: 'Kroupy',           Icon: PiCloudLightning, color: 'z-w-storm' },
  99: { label: 'Kroupy',           Icon: PiCloudLightning, color: 'z-w-storm' },
}

function wmo(code: number): WmoEntry {
  return WMO[code] ?? WMO[Math.floor(code / 10) * 10] ?? WMO[1]
}

const DAY = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So']

function tempColor(t: number) {
  if (t >= 24) return 'z-w-hot'
  if (t >= 10) return 'z-w-mild'
  return 'z-w-rain'
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
    const skeleton = <div className="z-wx z-wx--load" aria-busy="true"><div className="z-wx__now" /><div className="z-wx__days" /></div>
    return noCard ? skeleton : <div className="z-wxcard">{skeleton}</div>
  }

  const today = new Date()
  const isToday = selectedDay === 0
  const activeDay = data.days[selectedDay]
  const displayCode = isToday ? data.current.code : activeDay.code
  const displayTemp = isToday ? data.current.temp : activeDay.maxTemp
  const cur = wmo(displayCode)
  const dayLabel = isToday ? 'Teď' : DAY[(today.getDay() + selectedDay) % 7]

  const inner = (
    <div className="z-wx">
      <div className="z-wx__now">
        <span className={'z-wx__icon ' + cur.color}><cur.Icon className="w-9 h-9" /></span>
        <div>
          <div className="z-data">{dayLabel}</div>
          <div className="z-wx__temp"><span className="z-wtemp">{displayTemp}</span><span className="z-wx__deg">°C</span></div>
          <div className="z-wx__label">{isToday ? cur.label : `${cur.label} · ${activeDay.minTemp}° až ${activeDay.maxTemp}°`}</div>
        </div>
        <div className="z-wx__facts">
          {isToday && <span><PiWind className="w-4 h-4" />{data.current.windSpeed} km/h</span>}
          {isToday && <span><PiDrop className="w-4 h-4" />{data.current.humidity} %</span>}
          {!isToday && <span><PiDrop className="w-4 h-4" />srážky {activeDay.precipProb} %</span>}
        </div>
      </div>
      <div className="z-wx__days" role="tablist" aria-label="Předpověď na další dny">
        {data.days.map((day, i) => {
          const w = wmo(day.code)
          return (
            <button key={day.date} type="button" role="tab" aria-selected={selectedDay === i} className="z-wx__day" onClick={() => setSelectedDay(i)}>
              <span className="z-wx__dn">{i === 0 ? 'Dnes' : DAY[(today.getDay() + i) % 7]}</span>
              <w.Icon className={'w-6 h-6 ' + w.color} />
              <b className={tempColor(day.maxTemp)}>{day.maxTemp}°</b>
              <small>{day.minTemp}°</small>
            </button>
          )
        })}
      </div>
    </div>
  )

  return noCard ? inner : <div className="z-wxcard">{inner}</div>
}
