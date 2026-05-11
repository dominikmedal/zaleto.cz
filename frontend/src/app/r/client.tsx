'use client'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

const AFF_BASE = 'https://www.dpbolvw.net/click-101468674-14358779'

const ALLOWED_HOSTS = new Set([
  'blue-style.cz',
  'www.blue-style.cz',
])

export default function AffRedirectClient() {
  const params = useSearchParams()

  useEffect(() => {
    const url = params.get('url')
    if (!url) return

    let parsed: URL
    try { parsed = new URL(url) } catch { return }

    if (!['http:', 'https:'].includes(parsed.protocol)) return
    if (!ALLOWED_HOSTS.has(parsed.hostname)) return

    window.location.replace(`${AFF_BASE}?url=${encodeURIComponent(url)}`)
  }, [params])

  return null
}
