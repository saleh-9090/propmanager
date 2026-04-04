// frontend/src/app/onboarding/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost } from '@/lib/api'

export default function OnboardingPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    company_name: '',
    company_name_ar: '',
    full_name: '',
    phone: '',
    rega_license: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiPost('/onboarding', {
        company_name: form.company_name,
        company_name_ar: form.company_name_ar || null,
        full_name: form.full_name,
        phone: form.phone || null,
        rega_license: form.rega_license || null,
      })
      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-lg">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">إعداد الشركة</h1>
        <p className="text-stone-500 text-sm mb-8">أدخل بيانات شركتك للبدء</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">اسم الشركة (بالعربي) *</label>
            <input
              className="input"
              value={form.company_name_ar}
              onChange={e => set('company_name_ar', e.target.value)}
              placeholder="شركة النرجس للتطوير العقاري"
              required
            />
          </div>
          <div>
            <label className="label">اسم الشركة (بالإنجليزي) *</label>
            <input
              className="input"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              placeholder="Al-Narjis Real Estate"
              required
            />
          </div>
          <div>
            <label className="label">اسمك الكامل *</label>
            <input
              className="input"
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">رقم الجوال</label>
            <input
              className="input"
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="05xxxxxxxx"
            />
          </div>
          <div>
            <label className="label">رقم ترخيص فال (اختياري)</label>
            <input
              className="input"
              value={form.rega_license}
              onChange={e => set('rega_license', e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? 'جارٍ الإعداد...' : 'ابدأ'}
          </button>
        </form>
      </div>
    </div>
  )
}
