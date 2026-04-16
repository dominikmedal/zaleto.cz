'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PiSun, PiMapPin, PiForkKnife, PiMapTrifold, PiCompass, PiCar } from 'react-icons/pi'
import { Shield, Clock, BadgeCheck } from 'lucide-react'
import type { DestinationAIData, DestinationAIItem } from '@/lib/api'
import { CAR_DESTINATIONS } from '@/lib/carRental'
import { slugify } from '@/lib/slugify'

interface Panel {
  key: string
  title: string
  Icon: React.ElementType
  items?: DestinationAIItem[]
  text?: string
  carRental?: boolean
}

function findCarDest(destName: string, country: string) {
  const norm = (s: string) => slugify(s)
  const byPlace = CAR_DESTINATIONS.find(d => norm(d.name) === norm(destName) || d.slug === norm(destName))
  if (byPlace) return byPlace
  const byCountry = CAR_DESTINATIONS.filter(d => norm(d.country) === norm(country))
  return byCountry.find(d => d.popular) ?? byCountry[0] ?? null
}

export default function DestinationHeroAI({
  data,
  destName = '',
  country = '',
}: {
  data: DestinationAIData
  destName?: string
  country?: string
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const carDest = findCarDest(destName, country)
  const carHref = carDest ? `/pujcovna-aut/${carDest.slug}` : '/pujcovna-aut'
  const carLabel = carDest?.name ?? destName ?? country

  const panels: Panel[] = ([
    data.best_time
      ? { key: 'best_time', title: 'Kdy jet', Icon: PiSun, text: data.best_time }
      : null,
    (data.places ?? []).length > 0
      ? { key: 'places', title: 'Místa k objevení', Icon: PiMapPin, items: data.places }
      : null,
    (data.food ?? []).length > 0
      ? { key: 'food', title: 'Tradiční jídlo', Icon: PiForkKnife, items: data.food }
      : null,
    (data.trips ?? []).length > 0
      ? { key: 'trips', title: 'Výlety z okolí', Icon: PiMapTrifold, items: data.trips }
      : null,
    (data.excursions ?? []).length > 0
      ? { key: 'excursions', title: 'Co zažít', Icon: PiCompass, items: data.excursions }
      : null,
    destName
      ? { key: 'car_rental', title: `Půjčovna aut v ${carLabel}`, Icon: PiCar, carRental: true }
      : null,
  ] as (Panel | null)[]).filter((p): p is Panel => p !== null)

  if (!panels.length) return null

  return (
    <div>
      {/* ── Tab bar ── */}
      <div className="flex flex-wrap gap-2">
        {panels.map(({ key, title, Icon }) => {
          const isActive = openKey === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenKey(isActive ? null : key)}
              className="group relative inline-flex items-center gap-3 px-5 py-3 rounded-2xl whitespace-nowrap transition-all duration-200"
              style={isActive ? {
                background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
                color: '#fff',
                boxShadow: '0 6px 20px rgba(0,147,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                transform: 'translateY(-1px)',
              } : {
                background: '#fff',
                border: '1.5px solid rgba(0,147,255,0.14)',
                color: '#374151',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
              }}
            >
              {/* Icon circle */}
              <span
                className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-all duration-200"
                style={isActive ? {
                  background: 'rgba(255,255,255,0.25)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.15)',
                } : {
                  background: '#EDF6FF',
                  boxShadow: '0 0 0 1px rgba(0,147,255,0.12)',
                }}
              >
                <Icon
                  className="w-4.5 h-4.5 transition-colors duration-200"
                  style={{ color: isActive ? '#fff' : '#0093FF', width: '18px', height: '18px' }}
                />
              </span>

              <span
                className="font-semibold transition-colors duration-200"
                style={{ fontSize: '14px', letterSpacing: '-0.01em' }}
              >
                {title}
              </span>

              {/* Chevron — rotates when open */}
              <svg
                className="w-3.5 h-3.5 flex-shrink-0 transition-all duration-200"
                style={{
                  color: isActive ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                  transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )
        })}
      </div>

      {/* ── Panel ── */}
      <div
        style={{
          maxHeight: openKey ? '700px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.30s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {panels.map(({ key, Icon, items, text, carRental }) => (
          <div key={key} className={key === openKey ? 'block' : 'hidden'}>
            <div
              className="mt-2.5 rounded-2xl p-4 sm:p-5"
              style={{
                background: 'rgba(255,255,255,0.68)',
                backdropFilter: 'blur(24px) saturate(160%)',
                WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                border: '1px solid rgba(0,147,255,0.10)',
                boxShadow: '0 2px 16px rgba(0,147,255,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
              }}
            >
              {/* ── Car rental panel ── */}
              {carRental && (
                <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 items-start sm:items-center">
                  {/* Photo */}
                  <div className="relative w-full sm:w-52 h-36 sm:h-32 rounded-xl overflow-hidden flex-shrink-0">
                    <Image
                      src="/img/header-car.jpg"
                      alt="Půjčovna aut"
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 208px"
                    />
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold text-gray-900 leading-snug mb-2"
                      style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '18px' }}
                    >
                      Auto z dovolené udělá úplně jiný zážitek
                    </p>
                    <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                      Skryté zátoky, horské vesničky a místní trhy dostupné jen autem — prozkoumejte{' '}
                      <strong className="text-gray-700">{carLabel}</strong> na vlastní pěst, bez autobusů a bez čekání.
                      Srovnáme přes <strong className="text-gray-700">500 půjčoven</strong> a najdeme nejlepší cenu.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {[
                        { icon: <Shield className="w-3 h-3 text-[#0093FF]" />, label: 'Pojištění v ceně' },
                        { icon: <Clock className="w-3 h-3 text-[#0093FF]" />, label: 'Zdarma storno 48 h' },
                        { icon: <BadgeCheck className="w-3 h-3 text-[#0093FF]" />, label: 'Garantovaná cena' },
                      ].map(({ icon, label }) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 glass-pill px-2.5 py-1 rounded-full"
                        >
                          {icon}{label}
                        </span>
                      ))}
                    </div>
                    <Link href={carHref} className="btn-cta inline-flex text-[13px] py-2.5 px-5">
                      <PiCar className="w-4 h-4" />
                      Srovnat půjčovny aut — {carLabel}
                    </Link>
                  </div>
                </div>
              )}
              {text && (
                <p className="text-sm text-gray-600 leading-relaxed">
                  {text.split(/\n\n+/)[0]}
                </p>
              )}
              {Array.isArray(items) && items.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="group relative flex items-start gap-4 p-4 rounded-2xl cursor-default overflow-hidden"
                      style={{
                        background: '#fff',
                        border: '1px solid rgba(0,147,255,0.10)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.transform = 'translateY(-2px)'
                        el.style.boxShadow = '0 8px 24px rgba(0,147,255,0.13)'
                        el.style.borderColor = 'rgba(0,147,255,0.28)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement
                        el.style.transform = 'translateY(0)'
                        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'
                        el.style.borderColor = 'rgba(0,147,255,0.10)'
                      }}
                    >
                      {/* Left blue accent bar */}
                      <div
                        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ background: 'linear-gradient(to bottom, #0093FF, #0070E0)' }}
                      />

                      {/* Icon */}
                      <span
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, rgba(0,147,255,0.12) 0%, rgba(0,112,224,0.07) 100%)',
                          boxShadow: '0 1px 4px rgba(0,147,255,0.12)',
                        }}
                      >
                        <Icon className="w-5 h-5 text-[#0093FF]" />
                      </span>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p
                            className="font-bold text-gray-900 leading-snug group-hover:text-[#0093FF] transition-colors duration-200"
                            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '16px' }}
                          >
                            {item.name}
                          </p>
                          <span className="text-[10px] font-semibold text-gray-300 flex-shrink-0 mt-1 tabular-nums">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[13px] text-gray-500 leading-relaxed">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
