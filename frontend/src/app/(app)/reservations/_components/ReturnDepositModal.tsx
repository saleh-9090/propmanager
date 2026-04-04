'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api'

type Props = {
  reservationId: string
  onClose: () => void
  onReturned: () => void
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقد' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' },
]

export default function ReturnDepositModal({ reservationId, onClose, onReturned }: Props) {
  const [returnMethod, setReturnMethod] = useState('bank_transfer')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10))
  const [returnReference, setReturnReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, string> = {
        deposit_return_method: returnMethod,
        deposit_return_date: returnDate,
      }
      if (returnReference) payload.deposit_return_reference = returnReference
      await apiPost(`/reservations/${reservationId}/return-deposit`, payload)
      onReturned()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل استرداد العربون')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-stone-900 mb-4">تسجيل استرداد العربون</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">طريقة الاسترداد *</label>
            <select
              className="input w-full"
              value={returnMethod}
              onChange={e => setReturnMethod(e.target.value)}
              required
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">تاريخ الاسترداد *</label>
            <input
              type="date"
              className="input w-full"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">رقم المرجع</label>
            <input
              className="input w-full"
              value={returnReference}
              onChange={e => setReturnReference(e.target.value)}
              placeholder="رقم التحويل أو الشيك..."
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">تراجع</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'جارٍ الحفظ...' : 'تأكيد الاسترداد'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
