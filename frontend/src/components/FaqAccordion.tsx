'use client'
import { useState } from 'react'
import { PiCaretDown, PiPlus } from 'react-icons/pi'
import { FAQS } from './faq-data'

export { FAQS }

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: open ? 'rgba(255,255,255,0.90)' : 'rgba(237,246,255,0.60)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: open
          ? '1px solid rgba(0,147,255,0.25)'
          : '1px solid rgba(200,227,255,0.65)',
        boxShadow: open ? '0 4px 20px rgba(0,147,255,0.10)' : 'none',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 py-4 text-left flex items-center gap-4 transition-colors"
        aria-expanded={open}
      >
        {/* Number */}
        <span
          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold leading-none transition-all"
          style={open ? {
            background: 'linear-gradient(135deg, #0093FF, #0070E0)',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,147,255,0.30)',
          } : {
            background: 'rgba(0,147,255,0.09)',
            color: '#0093FF',
          }}
        >
          {index + 1}
        </span>

        <span className="flex-1 text-[14px] font-semibold text-gray-900 leading-snug">{q}</span>

        <span
          className="flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            background: open ? 'rgba(0,147,255,0.09)' : 'transparent',
            color: open ? '#0093FF' : '#9ca3af',
          }}
        >
          {open
            ? <PiCaretDown className="w-4 h-4 rotate-180 transition-transform duration-200" />
            : <PiPlus className="w-3.5 h-3.5" />
          }
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? '400px' : '0' }}
      >
        <div
          className="px-5 pb-5 text-sm text-gray-500 leading-relaxed"
          style={{ borderTop: '1px solid rgba(0,147,255,0.08)', paddingTop: '1rem' }}
        >
          {a}
        </div>
      </div>
    </div>
  )
}

export default function FaqAccordion() {
  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => <FaqItem key={faq.q} q={faq.q} a={faq.a} index={i} />)}
    </div>
  )
}
