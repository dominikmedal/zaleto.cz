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
    <section className="py-5 last:border-0" style={{ borderBottom: '1px solid rgba(0,147,255,0.07)' }}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 text-left group/toggle"
        aria-expanded={open}
      >
        <h2 className="flex items-center gap-2.5">
          <span
            className="flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5 text-[#0093FF] transition-colors group-hover/toggle:bg-[rgba(0,147,255,0.14)]"
            style={{ background: 'rgba(0,147,255,0.09)', border: '1px solid rgba(0,147,255,0.13)' }}
          >
            {icon}
          </span>
          <span
            className="text-[15px] font-bold text-gray-900 group-hover/toggle:text-[#0093FF] transition-colors tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {title}
          </span>
        </h2>
        <PiCaretDown
          className={`w-4 h-4 text-[#0093FF]/50 group-hover/toggle:text-[#0093FF] flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Grid-row animation — works for any height without JS measurement */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {(!lazy || everOpened) && (
            <div className="mt-4">
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
