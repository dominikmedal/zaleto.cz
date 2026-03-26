'use client'

import { useState } from 'react'

interface AgencyDesc {
  agency: string
  description: string
}

interface Props {
  descriptions: AgencyDesc[]
  stripHtml: (html: string) => string
}

export default function AgencyDescriptionSwitcher({ descriptions, stripHtml }: Props) {
  const [active, setActive] = useState(0)

  if (!descriptions || descriptions.length === 0) return null

  const current = descriptions[active]

  return (
    <div>
      {descriptions.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {descriptions.map((d, i) => (
            <button
              key={d.agency}
              onClick={() => setActive(i)}
              className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
                i === active
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-500'
              }`}
            >
              {d.agency}
            </button>
          ))}
        </div>
      )}
      <p className="text-gray-500 leading-relaxed text-sm whitespace-pre-line">
        {stripHtml(current.description)}
      </p>
    </div>
  )
}
