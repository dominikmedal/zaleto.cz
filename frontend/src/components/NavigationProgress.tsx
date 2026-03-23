'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPathname = useRef(pathname)
  // Track whether we started the animation for current navigation
  const pendingRef = useRef(false)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Skip clicks on buttons (FavoriteButton, ToursModal, dots, etc.)
      if ((e.target as HTMLElement).closest('button')) return

      const link = (e.target as HTMLElement).closest('a')
      if (!link?.href) return
      let url: URL
      try { url = new URL(link.href) } catch { return }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      if (timerRef.current) clearInterval(timerRef.current)
      if (hideRef.current) clearTimeout(hideRef.current)

      pendingRef.current = true
      setVisible(true)
      setProgress(15)

      timerRef.current = setInterval(() => {
        setProgress(p => p + (85 - p) * 0.07)
      }, 120)
    }

    // Capture phase — fires before any child stopPropagation()
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  // Complete when pathname changes
  useEffect(() => {
    if (pathname === prevPathname.current) return
    prevPathname.current = pathname
    if (!pendingRef.current) return
    pendingRef.current = false

    if (timerRef.current) clearInterval(timerRef.current)
    setProgress(100)

    hideRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 350)
  }, [pathname])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[9999] h-[2px] bg-[#008afe]"
      style={{
        width: `${progress}%`,
        opacity: visible ? 1 : 0,
        transition: progress === 100
          ? 'width 150ms ease-out, opacity 200ms ease 200ms'
          : 'width 120ms ease-out',
        boxShadow: visible ? '0 0 6px rgba(0,138,254,0.5)' : 'none',
      }}
    />
  )
}
