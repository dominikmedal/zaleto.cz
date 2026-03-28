'use client'
import { useState } from 'react'
import { PiCaretDown } from 'react-icons/pi'

interface Props {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  /** Only mount children after first open (prevents eager API calls) */
  lazy?: boolean
  children: React.ReactNode
}

export default function CollapsibleSection({ title, icon, defaultOpen = true, lazy = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [everOpened, setEverOpened] = useState(defaultOpen)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !everOpened) setEverOpened(true)
  }

  return (
    <section className="py-6 border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 text-left group/toggle"
        aria-expanded={open}
      >
        <h2 className="flex items-center gap-2.5 text-[17px] font-semibold text-gray-900">
          <span className="text-[#008afe] flex-shrink-0">{icon}</span>
          {title}
        </h2>
        <PiCaretDown
          className={`w-4 h-4 text-primary group-hover/toggle:text-gray-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Grid-row animation — works for any height without JS measurement */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {(!lazy || everOpened) && (
            <div className="mt-5">
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
