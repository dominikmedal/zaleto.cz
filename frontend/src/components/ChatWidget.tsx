'use client'

import { useState, useRef, useEffect } from 'react'
import { PiChatCircle, PiX, PiPaperPlaneTilt, PiCheckCircle, PiSparkleFill } from 'react-icons/pi'
import { API } from '@/lib/api'

type State = 'closed' | 'open' | 'sent'

const inputCls = [
  'w-full text-sm rounded-xl px-3 py-2.5 outline-none transition-all duration-200 resize-none',
  'bg-[rgba(237,246,255,0.60)] border placeholder-gray-400 text-gray-800',
  'focus:bg-white focus:border-[rgba(0,147,255,0.40)] focus:shadow-[0_0_0_3px_rgba(0,147,255,0.08)]',
].join(' ')

export default function ChatWidget() {
  const [state,   setState]   = useState<State>('closed')
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [message, setMessage] = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (state === 'open') setTimeout(() => msgRef.current?.focus(), 120)
  }, [state])

  async function handleSend() {
    if (!email.trim())   { setError('Zadejte e-mail pro odpověď.'); return }
    if (!message.trim()) { setError('Napište nám zprávu.'); return }
    setLoading(true); setError('')
    try {
      const r    = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, pageUrl: window.location.href }),
      })
      const json = await r.json()
      if (!r.ok) { setError(json.error || 'Chyba při odesílání.'); return }
      setState('sent')
    } catch {
      setError('Nepodařilo se odeslat. Zkuste to znovu.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setState('closed')
    setTimeout(() => { setName(''); setEmail(''); setMessage(''); setError('') }, 300)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">

      {/* Panel */}
      <div
        className={`w-80 rounded-2xl overflow-hidden transition-all duration-300 origin-bottom-right ${
          state !== 'closed' ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        style={{
          maxHeight: state !== 'closed' ? '520px' : '0',
          background: 'rgba(245,248,255,0.97)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          border: '1px solid rgba(200,227,255,0.70)',
          boxShadow: '0 20px 60px rgba(0,80,200,0.18), 0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3.5"
          style={{
            background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-white text-sm font-semibold">Jsme online</span>
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors p-0.5">
            <PiX className="w-4 h-4" />
          </button>
        </div>

        {state === 'sent' ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.10)' }}>
              <PiCheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-bold text-gray-800">Zpráva odeslána!</p>
            <p className="text-sm text-gray-500 leading-relaxed">Ozveme se Vám co nejdříve.</p>
            <button onClick={handleClose} className="mt-1 text-sm text-[#0093FF] hover:underline font-medium">
              Zavřít
            </button>
          </div>
        ) : (
          <div className="px-4 py-4 flex flex-col gap-3">
            <p className="text-[12px] text-gray-500 leading-relaxed">
              Rádi Vám poradíme s výběrem zájezdu. Napište nám a ozveme se.
            </p>

            <input
              type="text"
              placeholder="Jméno (volitelné)"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputCls}
              style={{ borderColor: 'rgba(200,227,255,0.65)' }}
            />
            <input
              type="email"
              placeholder="E-mail pro odpověď *"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              className={inputCls}
              style={{ borderColor: 'rgba(200,227,255,0.65)' }}
            />
            <textarea
              ref={msgRef}
              placeholder="Vaše zpráva…"
              value={message}
              onChange={e => { setMessage(e.target.value); setError('') }}
              rows={3}
              className={inputCls}
              style={{ borderColor: 'rgba(200,227,255,0.65)' }}
            />

            {error && (
              <p className="text-[11px] text-red-500 px-1">{error}</p>
            )}

            <button
              onClick={handleSend}
              disabled={loading}
              className="btn-cta w-full justify-center disabled:opacity-60"
            >
              <PiPaperPlaneTilt className="w-4 h-4" />
              {loading ? 'Odesílám…' : 'Odeslat zprávu'}
            </button>
          </div>
        )}
      </div>

      {/* Floating toggle button */}
      <button
        onClick={() => setState(s => s === 'closed' ? 'open' : 'closed')}
        aria-label="Kontaktujte nás"
        className="flex items-center gap-2.5 rounded-full transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, #0093FF 0%, #0070E0 100%)',
          boxShadow: state !== 'closed'
            ? '0 4px 16px rgba(0,147,255,0.40)'
            : '0 6px 24px rgba(0,147,255,0.36), 0 2px 8px rgba(0,0,0,0.10)',
          padding: '12px 20px 12px 16px',
          color: '#fff',
        }}
      >
        {state !== 'closed'
          ? <PiX className="w-5 h-5 flex-shrink-0" />
          : <PiSparkleFill className="w-4 h-4 flex-shrink-0" />
        }
        {state === 'closed' && (
          <span className="text-sm font-semibold whitespace-nowrap">Poradíme s výběrem</span>
        )}
      </button>

    </div>
  )
}
