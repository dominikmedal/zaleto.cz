'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { PiShareNetwork, PiLink, PiCheck, PiEnvelope, PiWhatsappLogo, PiFacebookLogo } from 'react-icons/pi'

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
        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
          open
            ? 'bg-blue-50 border-blue-200 text-blue-600'
            : 'bg-white border-gray-200 text-gray-500 hover:border-blue-200 hover:text-blue-500'
        }`}
      >
        <PiShareNetwork className="w-4 h-4" />
        <span>Sdílet</span>
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="fixed w-52 bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-900/10 overflow-hidden z-[9999] py-1.5"
        >
          <button
            type="button"
            onClick={copyLink}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {copied
              ? <PiCheck className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              : <PiLink className="w-4 h-4 flex-shrink-0 text-gray-400" />
            }
            <span>{copied ? 'Zkopírováno!' : 'Kopírovat odkaz'}</span>
          </button>
          <a
            href={`https://wa.me/?text=${enc(name + ' — ' + url)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <PiWhatsappLogo className="w-4 h-4 flex-shrink-0 text-green-500" />
            <span>WhatsApp</span>
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <PiFacebookLogo className="w-4 h-4 flex-shrink-0 text-blue-600" />
            <span>Facebook</span>
          </a>
          <a
            href={`mailto:?subject=${enc(name)}&body=${enc(url)}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <PiEnvelope className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span>E-mail</span>
          </a>
        </div>,
        document.body
      )}
    </div>
  )
}
