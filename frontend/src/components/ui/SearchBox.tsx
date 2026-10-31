'use client'
import PersonsField from './PersonsField'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Icon from './Icon'
import DestinationSuggest from './DestinationSuggest'
import { DateRangeField } from '@/components/DateRangePicker'

const CITIES = ['Praha', 'Brno', 'Ostrava', 'Pardubice', 'Karlovy Vary']

/** Vyhledávací lístek v hero: záložky Zájezdy / Auto, pole Kam · Odkud · Kdy. */
export default function SearchBox() {
  const router = useRouter()
  const [tab, setTab] = useState<'tours' | 'cars'>('tours')

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const dest = String(f.get('destination') ?? '').trim()
    if (tab === 'cars') {
      router.push('/pujcovna-aut')
      return
    }
    const p = new URLSearchParams()
    if (dest) p.set('destination', dest)
    const adults = String(f.get('adults') ?? '')
    if (adults) p.set('adults', adults)
    const city = String(f.get('departure_city') ?? '')
    if (city) p.set('departure_city', city)
    const from = String(f.get('date_from') ?? '')
    const to = String(f.get('date_to') ?? '')
    if (from) { p.set('date_from', from); p.set('date_flex', String(f.get('date_flex') ?? '1')) }
    if (to) p.set('date_to', to)
    router.push(`/zajezdy${p.toString() ? `?${p}` : ''}`)
  }

  return (
    <form className="z-search z-masthead__search" onSubmit={onSubmit} role="search">
      <div className="z-search__tabs" role="tablist" aria-label="Co hledáš">
        <button type="button" role="tab" className="z-search__tab" aria-selected={tab === 'tours'} onClick={() => setTab('tours')}>
          <Icon name="letadlo" size="sm" />Zájezdy
        </button>
        <button type="button" role="tab" className="z-search__tab" aria-selected={tab === 'cars'} onClick={() => setTab('cars')}>
          <Icon name="auto" size="sm" />Půjčovna aut
        </button>
      </div>
      <div className="z-tk z-tk--v">
        <div className="z-tk__in">
          <div className="z-sfield">
            <span className="z-sfield__label"><Icon name="poloha" />Kam</span>
            <DestinationSuggest name="destination" disabled={tab === 'cars'} />
            <span className="z-sfield__sub">země, oblast, hotel</span>
          </div>
          <label className="z-sfield">
            <span className="z-sfield__label"><Icon name="letadlo" />Odkud</span>
            <select name="departure_city" defaultValue="" disabled={tab === 'cars'}>
              <option value="">Odkudkoli</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="z-sfield__sub">odletové letiště</span>
          </label>
          <div className="z-sfield">
            <span className="z-sfield__label"><Icon name="kalendar" />Kdy</span>
            <DateRangeField disabled={tab === 'cars'} />
            <span className="z-sfield__sub">odlet a návrat</span>
          </div>
          <PersonsField disabled={tab === 'cars'} />
          <div className="z-search__go">
            <button className="z-round" type="submit" aria-label="Hledat"><Icon name="hledat" /></button>
          </div>
        </div>
      </div>
    </form>
  )
}
