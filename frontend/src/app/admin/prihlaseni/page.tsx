'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PiAirplane, PiLockKey, PiSpinner, PiEye, PiEyeSlash } from 'react-icons/pi'
import { adminLogin } from '@/lib/adminApi'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [show,     setShow]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200"
            style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
            <PiAirplane className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-[22px] font-bold text-gray-800">zaleto admin</h1>
          <p className="text-sm text-gray-500 mt-1">Přihlaste se pro přístup do administrace</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Heslo
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <PiLockKey className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Zadejte heslo"
                autoFocus
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-[14px] text-gray-800 outline-none focus:border-[#0093FF] focus:ring-4 focus:ring-[#0093FF]/10 transition-all"
              />
              <button type="button" onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <PiEyeSlash className="w-4 h-4" /> : <PiEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[12px] font-medium text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading || !password}
            className="w-full h-10 rounded-xl font-semibold text-[14px] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0093FF, #0060CC)' }}>
            {loading ? <PiSpinner className="w-4 h-4 animate-spin" /> : 'Přihlásit se'}
          </button>
        </form>
      </div>
    </div>
  )
}
