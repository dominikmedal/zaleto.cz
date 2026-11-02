'use client'
import { useEffect, useState } from 'react'
import Icon from './Icon'
import { rememberFilters } from '@/lib/filterMemory'

const MIN = 1
const MAX = 9

/** Počet osob (stepper). Do formuláře posílá `adults` jen když se liší od výchozích 2. */
export default function PersonsField({ defaultValue = 2, name = 'adults', disabled }: { defaultValue?: number; name?: string; disabled?: boolean }) {
  const [n, setN] = useState(Math.min(MAX, Math.max(MIN, defaultValue || 2)))

  useEffect(() => { rememberFilters({ adults: n === 2 ? null : String(n) }) }, [n])

  return (
    <div className="z-sfield z-sfield--persons">
      <span className="z-sfield__label"><Icon name="osoby" />Osoby</span>
      <div className="z-persons">
        <button type="button" className="z-iconbtn" onClick={() => setN(v => Math.max(MIN, v - 1))} disabled={disabled || n <= MIN} aria-label="Méně osob"><Icon name="minus" size="sm" /></button>
        {/* jednotka „osoby“ je už v popisku pole; tady jen číslo (čtečka si ji přečte z aria-label) */}
        <output aria-live="polite" aria-label={`${n} ${n === 1 ? 'osoba' : n < 5 ? 'osoby' : 'osob'}`}><b>{n}</b></output>
        <button type="button" className="z-iconbtn" onClick={() => setN(v => Math.min(MAX, v + 1))} disabled={disabled || n >= MAX} aria-label="Více osob"><Icon name="plus" size="sm" /></button>
      </div>
      <span className="z-sfield__sub">dospělí na pokoji</span>
      {n !== 2 && <input type="hidden" name={name} value={n} disabled={disabled} />}
    </div>
  )
}
