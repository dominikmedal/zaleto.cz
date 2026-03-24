'use client'

import { useState, useRef, useEffect } from 'react'
import { PiChatCircle, PiX, PiPaperPlaneTilt, PiCheckCircle } from 'react-icons/pi'
import { API } from '@/lib/api'

type State = 'closed' | 'open' | 'sent'

export default function ChatWidget() {
  const [state, setState] = useState<State>('closed')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const msgRef = useRef<HTMLTextAreaElement>(null)

  // Fokus na textarea při otevření
  useEffect(() => {
    if (state === 'open') setTimeout(() => msgRef.current?.focus(), 120)
  }, [state])

  async function handleSend() {
    if (!email.trim()) { setError('Zadejte e-mail pro odpověď.'); return }
    if (!message.trim()) { setError('Napište nám zprávu.'); return }
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`${API}/api/contact`, {
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
    // Reset po zavření
    setTimeout(() => { setName(''); setEmail(''); setMessage(''); setError('') }, 300)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">

      {/* Panel */}
      <div
        className={`
          bg-white rounded-2xl shadow-2xl border border-gray-100 w-80
          transition-all duration-300 origin-bottom-right overflow-hidden
          ${state !== 'closed' ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}
        `}
        style={{ maxHeight: state !== 'closed' ? '480px' : '0' }}
      >
        {/* Hlavička */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#008afe] rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-white text-sm font-semibold">Jsme online</span>
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors">
            <PiX className="w-4 h-4" />
          </button>
        </div>

        {state === 'sent' ? (
          /* Potvrzení */
          <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
            <PiCheckCircle className="w-12 h-12 text-green-500" />
            <p className="font-semibold text-gray-800">Zpráva odeslána!</p>
            <p className="text-sm text-gray-500">Ozveme se Vám co nejdříve.</p>
            <button
              onClick={handleClose}
              className="mt-2 text-sm text-[#008afe] hover:underline"
            >
              Zavřít
            </button>
          </div>
        ) : (
          /* Formulář */
          <div className="px-4 py-4 flex flex-col gap-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Rádi Vám poradíme s výběrem zájezdu. Napište nám a ozveme se.
            </p>

            <input
              type="text"
              placeholder="Jméno (volitelné)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#008afe] transition-colors"
            />
            <input
              type="email"
              placeholder="E-mail pro odpověď *"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#008afe] transition-colors"
            />
            <textarea
              ref={msgRef}
              placeholder="Vaše zpráva..."
              value={message}
              onChange={e => { setMessage(e.target.value); setError('') }}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#008afe] transition-colors resize-none"
            />

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              onClick={handleSend}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-[#008afe] hover:bg-[#0070d8] text-white text-sm font-semibold rounded-xl py-2.5 transition-colors disabled:opacity-60"
            >
              <PiPaperPlaneTilt className="w-4 h-4" />
              {loading ? 'Odesílám…' : 'Odeslat zprávu'}
            </button>
          </div>
        )}
      </div>

      {/* Tlačítko */}
      <button
        onClick={() => setState(s => s === 'closed' ? 'open' : 'closed')}
        className="flex items-center gap-2.5 bg-[#008afe] hover:bg-[#0070d8] text-white rounded-full shadow-lg px-4 py-3 transition-all duration-200 hover:shadow-xl"
        aria-label="Kontaktujte nás"
      >
        <PiChatCircle className="w-5 h-5 flex-shrink-0" />
        {state === 'closed' && (
          <span className="text-sm font-medium whitespace-nowrap pr-0.5">Poradíme s výběrem</span>
        )}
      </button>

    </div>
  )
}
