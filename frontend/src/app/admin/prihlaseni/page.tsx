'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Icon from '@/components/ui/Icon'
import { adminLogin } from '@/lib/adminApi'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await adminLogin(password)
      router.replace('/admin/prehled')
    } catch {
      setError('Nesprávné heslo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="z-login">
      <div className="z-login__box">
        <Image src="/img/logo/logo.png" alt="zaleto." width={130} height={38} className="z-logo" priority />
        <div className="z-kicker" style={{ marginTop: 'var(--space-6)' }}>Administrace</div>
        <h1 className="h2" style={{ margin: 'var(--space-2) 0 var(--space-5)' }}>přihlášení<span className="z-dot">.</span></h1>

        <form onSubmit={submit} className="z-tk"><div className="z-tk__in" style={{ padding: 'var(--space-5)' }}>
          <label className="z-sfield" style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--paper)', borderRadius: 'var(--radius-md)' }}>
            <span className="z-sfield__label"><Icon name="lock" />Heslo</span>
            <span className="z-clear">
              <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Zadej heslo" autoFocus />
              <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Skrýt heslo' : 'Zobrazit heslo'}>
                <Icon name={show ? 'eyeOff' : 'eye'} size="sm" />
              </button>
            </span>
          </label>

          {error && <p role="alert" className="z-data" style={{ margin: 'var(--space-3) 0 0', color: 'var(--danger)' }}>{error}</p>}

          <button type="submit" disabled={loading || !password} className="z-btn z-btn--primary z-btn--block" style={{ marginTop: 'var(--space-4)' }}>
            {loading ? 'Přihlašuji…' : 'Přihlásit se'}
            <span className="z-btn__go"><Icon name={loading ? 'spinner' : 'sipka'} className={loading ? 'animate-spin' : undefined} /></span>
          </button>
        </div></form>
      </div>
    </div>
  )
}
