'use client'
import { useState } from 'react'
import Icon from '@/components/ui/Icon'

interface Props {
  title: string
  /** Zachováno kvůli zpětné kompatibilitě; v novém designu se ikona v nadpisu nezobrazuje. */
  icon?: React.ReactNode
  defaultOpen?: boolean
  /** Potomci se připojí až po prvním otevření (zabraňuje zbytečným voláním API). */
  lazy?: boolean
  children: React.ReactNode
}

/** Rozbalovací sekce v designu „Palubní deník“: serifový titulek s tečkou, tečkovaná čára. */
export default function CollapsibleSection({ title, defaultOpen = true, lazy = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [everOpened, setEverOpened] = useState(defaultOpen)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !everOpened) setEverOpened(true)
  }

  return (
    <section className="z-coll" data-rail={title}>
      <button type="button" onClick={toggle} className="z-coll__head" aria-expanded={open}>
        <h2 className="h3">{title}<span className="z-dot">.</span></h2>
        <Icon name="chevron" className={open ? 'z-coll__chev z-coll__chev--open' : 'z-coll__chev'} />
      </button>
      {open && (!lazy || everOpened) && <div className="z-coll__body">{children}</div>}
    </section>
  )
}
