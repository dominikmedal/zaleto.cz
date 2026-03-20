'use client'
import { useEffect, useState } from 'react'
import { PiArrowUp } from 'react-icons/pi'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Zpět nahoru"
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-gray-500 hover:text-[#008afe] hover:border-[#008afe]/40 transition-all active:scale-95"
    >
      <PiArrowUp className="w-5 h-5" />
    </button>
  )
}
