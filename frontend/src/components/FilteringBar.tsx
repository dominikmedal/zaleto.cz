'use client'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function FilteringBar() {
  const sp = useSearchParams()
  const [animKey, setAnimKey] = useState(0)
  const prevRef = useRef('')

  useEffect(() => {
    const curr = sp.toString()
    if (curr !== prevRef.current) {
      prevRef.current = curr
      setAnimKey(k => k + 1)
    }
  }, [sp])

  return (
    <div className="h-0.5 w-full overflow-hidden rounded-full mb-1">
      {animKey > 0 && (
        <div
          key={animKey}
          className="h-full bg-[#008afe] rounded-full animate-filter-bar"
        />
      )}
    </div>
  )
}
