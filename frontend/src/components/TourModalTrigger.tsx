'use client'
import { useState } from 'react'
import { PiCalendarBlank } from 'react-icons/pi'
import ToursModal from './ToursModal'

interface Props {
  slug: string
  name: string
  tourCount: number
}

export default function TourModalTrigger({ slug, name, tourCount }: Props) {
  const [open, setOpen] = useState(false)
  const label = tourCount === 1 ? 'termín' : tourCount < 5 ? 'termíny' : 'termínů'

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0093FF] bg-[#0093FF]/10 hover:bg-[#0093FF]/20 px-2.5 py-1 rounded-full flex-shrink-0 transition-colors cursor-pointer"
      >
        <PiCalendarBlank className="w-3 h-3" />
        {tourCount} {label}
      </button>
      {open && <ToursModal slug={slug} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}
