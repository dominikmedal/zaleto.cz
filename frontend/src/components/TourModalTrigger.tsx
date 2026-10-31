'use client'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'
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
      <button type="button" onClick={() => setOpen(true)} className="z-more" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
        <Icon name="kalendar" size="sm" />Všech {tourCount} {label}
      </button>
      {open && <ToursModal slug={slug} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}
