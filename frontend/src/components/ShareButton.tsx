'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/components/ui/Icon'
interface Props {
  slug: string
  name: string
  className?: string
}

export default function ShareButton({ slug, name, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const url = `https://zaleto.cz/hotel/${slug}`

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setDropdownStyle({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', updatePosition, { passive: true })
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', updatePosition)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => { setCopied(false); setOpen(false) }, 1500)
    } catch {}
  }

  const handleClick = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: name, url }).catch(() => {})
    } else {
      updatePosition()
      setOpen(o => !o)
    }
  }

  const enc = encodeURIComponent

  return (
    <div className={className}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        aria-label="Sdílet"
        aria-expanded={open}
        className="z-btn z-btn--line z-btn--sm"
        style={{ justifyContent: 'center' }}
      >
        <Icon name="sdilet" size="sm" />
        <span>Sdílet</span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div ref={dropdownRef} style={{ ...dropdownStyle, position: 'fixed', width: 220, zIndex: 9999 }} className="z-suggest">
          <button type="button" onClick={copyLink}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Icon name={copied ? 'ok' : 'link'} size="sm" style={copied ? { color: 'var(--success)' } : undefined} />
              <b style={{ font: '500 15px/22px var(--font-sans)' }}>{copied ? 'Zkopírováno' : 'Kopírovat odkaz'}</b>
            </span>
          </button>
          <a href={`https://wa.me/?text=${enc(name + ' — ' + url)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="z-suggest__item">
            <Icon name="whatsapp" size="sm" />WhatsApp
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="z-suggest__item">
            <Icon name="facebook" size="sm" />Facebook
          </a>
          <a href={`mailto:?subject=${enc(name)}&body=${enc(url)}`} onClick={() => setOpen(false)} className="z-suggest__item">
            <Icon name="envelope" size="sm" />E-mail
          </a>
        </div>,
        document.body
      )}
    </div>
  )
}
