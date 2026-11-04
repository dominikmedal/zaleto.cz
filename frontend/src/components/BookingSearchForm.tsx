'use client'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
import PersonsField from '@/components/ui/PersonsField'
import DestinationSuggest from '@/components/ui/DestinationSuggest'
import DateRangePicker from '@/components/DateRangePicker'
import { buildBookingUrl, bookingClick, defaultStay } from '@/lib/booking'

/** Záložka „Ubytování“ ve vyhledávači: Kam · Kdy · Osoby → vyhledávání na Booking.com (nová karta, přes CJ). */
export default function BookingSearchForm() {
  const init = defaultStay()
  const [from, setFrom] = useState(init.checkin)
  const [to, setTo] = useState(init.checkout)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const ss = String(f.get('destination') ?? '').trim()
    if (!ss) return
    const url = buildBookingUrl({ ss, checkin: from || undefined, checkout: from && to ? to : undefined, adults: Number(f.get('adults')) || 2 })
    window.open(bookingClick(url, 'hledani'), '_blank', 'noopener')
  }

  return (
    <form className="z-search z-masthead__search" onSubmit={onSubmit} role="search">
      <div className="z-tk z-tk--v">
        <div className="z-tk__in">
          <div className="z-sfield">
            <span className="z-sfield__label"><Icon name="poloha" />Kam</span>
            <DestinationSuggest name="destination" mode="stay" />
            <span className="z-sfield__sub">kamkoli na světě</span>
          </div>
          <div className="z-sfield z-picker">
            <span className="z-sfield__label"><Icon name="kalendar" />Kdy</span>
            <DateRangePicker dateFrom={from} dateTo={to} onDateFromChange={setFrom} onDateToChange={setTo} noPrices placeholder="Vybrat termín" />
            <span className="z-sfield__sub">příjezd a odjezd</span>
          </div>
          <PersonsField />
          <div className="z-search__go">
            <button className="z-round" type="submit" aria-label="Hledat ubytování"><Icon name="hledat" /></button>
          </div>
        </div>
      </div>
    </form>
  )
}
