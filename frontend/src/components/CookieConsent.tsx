'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const KEY = 'z-consent'

declare global { interface Window { gtag?: (...args: unknown[]) => void } }

/** Kompaktní lišta se souhlasem k analytickým cookies (Google Analytics, Consent Mode v2). Volba se pamatuje v localStorage. */
export default function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setShow(true) } catch { /* privátní režim */ }
  }, [])

  function choose(granted: boolean) {
    try { localStorage.setItem(KEY, granted ? 'granted' : 'denied') } catch { /* ignore */ }
    window.gtag?.('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' })
    setShow(false)
  }

  if (!show) return null
  return (
    <div className="z-consent" role="dialog" aria-label="Souhlas s cookies">
      <p className="z-consent__text">
        Měříme návštěvnost přes Google Analytics. <Link href="/ochrana-osobnich-udaju">Víc</Link>
      </p>
      <div className="z-consent__btns">
        <button type="button" className="z-btn z-btn--line z-btn--sm" onClick={() => choose(false)}>Odmítnout</button>
        <button type="button" className="z-btn z-btn--primary z-btn--sm" onClick={() => choose(true)}>Přijmout</button>
      </div>
    </div>
  )
}
