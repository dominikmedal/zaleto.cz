'use client'
import { useState, useEffect } from 'react'
import { PiEye } from 'react-icons/pi'

export default function ViewersBadge() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    // Weighted random: ~30% chance of 0 (no badge shown), otherwise 2–12
    const r = Math.random()
    if (r < 0.30) { setCount(0); return }
    setCount(Math.floor(Math.random() * 11) + 2) // 2–12
  }, [])

  if (!count) return null

  return (
    <div className="flex items-center gap-2  rounded-xl px-3 py-2.5 text-xs text-amber-700">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
      <PiEye className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        <strong className="font-semibold">{count} {count === 1 ? 'člověk' : count < 5 ? 'lidé' : 'lidí'}</strong>
        {' '}si právě prohlíží tuto nabídku
      </span>
    </div>
  )
}
