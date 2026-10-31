'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Icon from './Icon'

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
    const from = String(f.get('departure_city') ?? '')
    if (from) p.set('departure_city', from)
    const when = String(f.get('date_from') ?? '')
    if (when) { p.set('date_from', when); p.set('date_flex', '1') }
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
          <label className="z-sfield">
            <span className="z-sfield__label"><Icon name="poloha" />Kam</span>
            <input name="destination" placeholder="Kamkoli" autoComplete="off" disabled={tab === 'cars'} />
            <span className="z-sfield__sub">země, ostrov, město</span>
          </label>
          <label className="z-sfield">
            <span className="z-sfield__label"><Icon name="letadlo" />Odkud</span>
            <select name="departure_city" defaultValue="" disabled={tab === 'cars'}>
              <option value="">Odkudkoli</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="z-sfield__sub">odletové letiště</span>
          </label>
          <label className="z-sfield">
            <span className="z-sfield__label"><Icon name="kalendar" />Kdy</span>
            <input name="date_from" type="date" disabled={tab === 'cars'} />
            <span className="z-sfield__sub">±3 dny od data</span>
          </label>
          <div className="z-search__go">
            <button className="z-round" type="submit" aria-label="Hledat"><Icon name="hledat" /></button>
          </div>
        </div>
      </div>
    </form>
  )
}
