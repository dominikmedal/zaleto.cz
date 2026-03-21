'use client'
import { useState } from 'react'
import { PiCaretDown } from 'react-icons/pi'
import { FAQS } from './faq-data'

export { FAQS }

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold text-gray-900">{q}</span>
        <PiCaretDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
          <p className="pt-4">{a}</p>
        </div>
      )}
    </div>
  )
}

export default function FaqAccordion() {
  return (
    <div className="space-y-2.5">
      {FAQS.map(faq => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
    </div>
  )
}
