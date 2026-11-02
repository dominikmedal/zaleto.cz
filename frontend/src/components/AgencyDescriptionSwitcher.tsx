'use client'

import { useState } from 'react'
import Icon from '@/components/ui/Icon'

interface AgencyDesc {
  agency: string
  description: string
}

interface Props {
  descriptions: AgencyDesc[]
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

/** Krátký úvod popisu: první věty do ~380 znaků (popisy od CK mají i konkurenční weby, proto je ukazujeme zkrácené). */
function preview(text: string, max = 380): { short: string; truncated: boolean } {
  if (text.length <= max) return { short: text, truncated: false }
  const sentences = text.split(/(?<=[.!?])\s+/)
  let out = ''
  for (const s of sentences) {
    if (out && (out + ' ' + s).length > max) break
    out = out ? `${out} ${s}` : s
  }
  // jediná dlouhá věta: ořízneme na hranici slova
  if (out.length > max + 80) out = `${out.slice(0, max).replace(/\s+\S*$/, '')}…`
  return { short: out, truncated: out.length < text.length }
}

export default function AgencyDescriptionSwitcher({ descriptions }: Props) {
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)

  if (!descriptions || descriptions.length === 0) return null

  const current = descriptions[active]
  const full = stripHtml(current.description)
  const { short, truncated } = preview(full)

  return (
    <div>
      {descriptions.length > 1 && (
        <div className="z-chips" style={{ marginBottom: 'var(--space-4)' }}>
          {descriptions.map((d, i) => (
            <button
              key={d.agency}
              type="button"
              onClick={() => { setActive(i); setOpen(false) }}
              className="z-chip"
              aria-pressed={i === active}
              style={{ cursor: 'pointer', ...(i === active ? { background: 'var(--ink)', color: 'var(--paper)' } : {}) }}
            >
              {d.agency}
            </button>
          ))}
        </div>
      )}
      <p className="z-text" style={{ whiteSpace: 'pre-line', margin: 0 }}>
        {open || !truncated ? full : short}
      </p>
      {truncated && (
        <button type="button" className="z-more" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ marginTop: 'var(--space-3)', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
          {open ? 'Skrýt popis' : 'Zobrazit celý popis'}
        </button>
      )}
      <p className="z-data z-ainote" style={{ textTransform: 'none' }}>
        <Icon name="info" size="sm" />Zdroj popisu: cestovní kancelář {current.agency}. Text je převzatý beze změn.
      </p>
    </div>
  )
}
