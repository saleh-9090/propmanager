'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-base">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--color-primary) 20%, transparent), transparent 60%)',
        }}
      />
      <div className="card-elevated w-full max-w-md relative">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
          >
            P
          </div>
          <div>
            <p className="text-text-primary font-semibold">PropManager</p>
            <p className="text-text-muted text-xs">نظام إدارة المبيعات العقارية</p>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-text-primary mb-1">
          {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
        </h1>
        <p className="text-text-muted text-sm mb-6">
          {mode === 'login' ? 'أدخل بياناتك للدخول إلى لوحة التحكم' : 'ابدأ بإنشاء حساب جديد'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-input text-danger text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@company.sa"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'جارٍ التحميل...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
          className="mt-5 text-sm w-full text-center text-text-secondary hover:text-text-primary transition-colors"
        >
          {mode === 'login' ? 'إنشاء حساب جديد' : 'تسجيل الدخول بحساب موجود'}
        </button>
      </div>
    </div>
  )
}
