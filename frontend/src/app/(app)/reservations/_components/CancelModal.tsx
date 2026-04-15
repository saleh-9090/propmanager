'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api'

type Props = {
  reservationId: string
  onClose: () => void
  onCancelled: () => void
}

export default function CancelModal({ reservationId, onClose, onCancelled }: Props) {
  const [reason, setReason] = useState('')
  const [refundAmount, setRefundAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      setError('سبب الإلغاء مطلوب')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiPost(`/reservations/${reservationId}/cancel`, {
        cancellation_reason: reason,
        refund_amount: refundAmount,
      })
      onCancelled()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الحجز')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-bg-surface rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-text-primary mb-4">إلغاء الحجز</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">سبب الإلغاء *</label>
            <textarea
              className="input w-full"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="أدخل سبب الإلغاء..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">مبلغ الاسترداد (ر.س)</label>
            <input
              type="number"
              className="input w-full"
              min={0}
              step={0.01}
              value={refundAmount}
              onChange={e => setRefundAmount(Number(e.target.value))}
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              تراجع
            </button>
            <button type="submit" disabled={saving} className="bg-danger text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-danger/90 disabled:opacity-50">
              {saving ? 'جارٍ الإلغاء...' : 'تأكيد الإلغاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
