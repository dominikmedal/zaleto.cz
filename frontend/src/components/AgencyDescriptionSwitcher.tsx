'use client'

import { useState } from 'react'

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

export default function AgencyDescriptionSwitcher({ descriptions }: Props) {
  const [active, setActive] = useState(0)

  if (!descriptions || descriptions.length === 0) return null

  const current = descriptions[active]

  return (
    <div>
      {descriptions.length > 1 && (
        <div className="z-chips" style={{ marginBottom: 'var(--space-4)' }}>
          {descriptions.map((d, i) => (
            <button
              key={d.agency}
              type="button"
              onClick={() => setActive(i)}
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
        {stripHtml(current.description)}
      </p>
    </div>
  )
}
