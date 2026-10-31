'use client'

import { useState, useRef, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { API } from '@/lib/api'

type State = 'closed' | 'open' | 'sent'

/** Plovoucí „Poradíme s výběrem“: tlačítko vpravo dole a formulář jako palubní lístek. */
export default function ChatWidget() {
  const [state, setState] = useState<State>('closed')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const msgRef = useRef<HTMLTextAreaElement>(null)
  const open = state !== 'closed'

  useEffect(() => {
    if (state === 'open') setTimeout(() => msgRef.current?.focus(), 120)
  }, [state])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function handleSend() {
    if (!email.trim()) { setError('Zadej e-mail pro odpověď.'); return }
    if (!message.trim()) { setError('Napiš nám zprávu.'); return }
    setLoading(true); setError('')
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
      setError('Nepodařilo se odeslat. Zkus to znovu.')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setState('closed')
    setTimeout(() => { setName(''); setEmail(''); setMessage(''); setError('') }, 300)
  }

  return (
    <div className="z-chat">
      {open && (
        <div className="z-tk z-tk--h z-chat__panel" role="dialog" aria-label="Poradíme s výběrem" style={{ ['--cut' as string]: '84px' }}>
          <div className="z-tk__in">
            <div className="z-chat__head">
              <div>
                <div className="z-kicker">Poradíme s výběrem</div>
                <h2 className="h3" style={{ marginTop: 4 }}>napiš nám<span className="z-dot">.</span></h2>
              </div>
              <button type="button" className="z-iconbtn" onClick={handleClose} aria-label="Zavřít"><Icon name="zavrit" /></button>
            </div>

            {state === 'sent' ? (
              <div className="z-chat__sent">
                <Icon name="badge" size="lg" style={{ color: 'var(--success)' }} />
                <p className="h4" style={{ margin: 0 }}>zpráva odeslána<span className="z-dot">.</span></p>
                <p style={{ margin: 0, color: 'var(--ink-muted)' }}>Ozveme se ti co nejdřív.</p>
                <button type="button" className="z-more" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={handleClose}>Zavřít</button>
              </div>
            ) : (
              <div className="z-chat__form">
                <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14, lineHeight: '21px' }}>
                  Rádi ti poradíme s výběrem zájezdu nebo auta. Napiš a ozveme se.
                </p>
                <label className="z-chat__field">
                  <span className="z-sfield__label"><Icon name="ucet" />Jméno</span>
                  <input type="text" placeholder="Volitelné" value={name} onChange={e => setName(e.target.value)} />
                </label>
                <label className="z-chat__field">
                  <span className="z-sfield__label"><Icon name="envelope" />E-mail</span>
                  <input type="email" placeholder="Pro odpověď" value={email} onChange={e => { setEmail(e.target.value); setError('') }} />
                </label>
                <label className="z-chat__field">
                  <span className="z-sfield__label"><Icon name="chat" />Zpráva</span>
                  <textarea ref={msgRef} placeholder="Co hledáš?" value={message} rows={3} onChange={e => { setMessage(e.target.value); setError('') }} />
                </label>
                {error && <p role="alert" className="z-data" style={{ margin: 0, color: 'var(--danger)', textTransform: 'none' }}>{error}</p>}
                <button type="button" className="z-btn z-btn--primary z-btn--block" onClick={handleSend} disabled={loading}>
                  {loading ? 'Odesílám…' : 'Odeslat zprávu'}
                  <span className="z-btn__go"><Icon name={loading ? 'spinner' : 'paperPlane'} className={loading ? 'animate-spin' : undefined} /></span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className="z-btn z-btn--primary z-chat__toggle"
        aria-label={open ? 'Zavřít formulář' : 'Poradíme s výběrem'}
        aria-expanded={open}
        onClick={() => setState(s => (s === 'closed' ? 'open' : 'closed'))}
      >
        <Icon name={open ? 'zavrit' : 'chat'} />
        {!open && <span>Poradíme s výběrem</span>}
      </button>
    </div>
  )
}
