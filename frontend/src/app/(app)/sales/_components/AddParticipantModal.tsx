'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'

type CompanyUser = { id: string; full_name: string; role: string }
type Realtor = { id: string; name: string; office_name: string | null }

const ROLE_LABELS: Record<string, string> = {
  owner: 'المالك',
  cfo: 'المدير المالي',
  sales_manager: 'مدير المبيعات',
  reservation_manager: 'مدير الحجوزات',
  accountant: 'المحاسب',
}

export default function AddParticipantModal({
  saleId,
  currentTotal,
  onClose,
  onAdded,
}: {
  saleId: string
  currentTotal: number
  onClose: () => void
  onAdded: () => void
}) {
  const [kind, setKind] = useState<'internal' | 'external'>('internal')
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [realtors, setRealtors] = useState<Realtor[]>([])
  const [userId, setUserId] = useState('')
  const [realtorId, setRealtorId] = useState('')
  const [percentage, setPercentage] = useState('')
  const [notes, setNotes] = useState('')
  const [showNewRealtor, setShowNewRealtor] = useState(false)
  const [newRealtor, setNewRealtor] = useState({ name: '', phone: '', office_name: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      apiGet<CompanyUser[]>('/users'),
      apiGet<Realtor[]>('/external-realtors'),
    ])
      .then(([u, r]) => { setUsers(u); setRealtors(r) })
      .catch(err => setError(err instanceof Error ? err.message : 'تعذر التحميل'))
  }, [])

  const remaining = Math.max(0, 100 - currentTotal)

  async function createRealtor() {
    if (!newRealtor.name.trim()) {
      setError('اسم الوسيط مطلوب')
      return
    }
    setError('')
    try {
      const r = await apiPost<Realtor>('/external-realtors', {
        name: newRealtor.name.trim(),
        phone: newRealtor.phone.trim() || undefined,
        office_name: newRealtor.office_name.trim() || undefined,
      })
      setRealtors(prev => [...prev, r].sort((a, b) => a.name.localeCompare(b.name, 'ar')))
      setRealtorId(r.id)
      setShowNewRealtor(false)
      setNewRealtor({ name: '', phone: '', office_name: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إضافة الوسيط')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const pct = parseFloat(percentage)
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setError('نسبة غير صحيحة')
      return
    }
    if (pct > remaining + 0.01) {
      setError(`النسبة تتجاوز المتبقي (${remaining.toFixed(1)}%)`)
      return
    }
    if (kind === 'internal' && !userId) {
      setError('اختر موظفاً')
      return
    }
    if (kind === 'external' && !realtorId) {
      setError('اختر وسيطاً')
      return
    }

    setSaving(true)
    setError('')
    try {
      await apiPost(`/sales/${saleId}/participants`, {
        type: kind,
        user_id: kind === 'internal' ? userId : undefined,
        external_realtor_id: kind === 'external' ? realtorId : undefined,
        commission_percentage: pct,
        notes: notes.trim() || undefined,
      })
      onAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الإضافة')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="modal-panel w-full max-w-md p-6 pointer-events-auto">
          <h3 className="text-lg font-semibold text-text-primary mb-1">إضافة مشارك</h3>
          <p className="text-text-muted text-xs mb-5">
            المتبقي من العمولة: <span className="text-text-secondary">{remaining.toFixed(1)}%</span>
          </p>

          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-input text-danger text-sm">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="flex gap-2 p-1 bg-bg-base border border-border rounded-btn">
              <button
                type="button"
                onClick={() => setKind('internal')}
                className={`flex-1 py-2 rounded-btn text-sm font-medium transition-colors ${
                  kind === 'internal' ? 'bg-brand-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                موظف داخلي
              </button>
              <button
                type="button"
                onClick={() => setKind('external')}
                className={`flex-1 py-2 rounded-btn text-sm font-medium transition-colors ${
                  kind === 'external' ? 'bg-brand-primary text-white' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                وسيط خارجي
              </button>
            </div>

            {kind === 'internal' ? (
              <div>
                <label className="label">الموظف</label>
                <select
                  className="input"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  required
                >
                  <option value="">— اختر —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} · {ROLE_LABELS[u.role] ?? u.role}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">الوسيط الخارجي</label>
                  <button
                    type="button"
                    onClick={() => setShowNewRealtor(v => !v)}
                    className="text-brand-primary text-xs hover:opacity-80"
                  >
                    {showNewRealtor ? 'إلغاء' : '+ وسيط جديد'}
                  </button>
                </div>

                {showNewRealtor ? (
                  <div className="space-y-2 p-3 bg-bg-base border border-border rounded-card">
                    <input
                      className="input"
                      placeholder="اسم الوسيط *"
                      value={newRealtor.name}
                      onChange={e => setNewRealtor({ ...newRealtor, name: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="اسم المكتب (اختياري)"
                      value={newRealtor.office_name}
                      onChange={e => setNewRealtor({ ...newRealtor, office_name: e.target.value })}
                    />
                    <input
                      className="input"
                      type="tel"
                      placeholder="رقم الجوال (اختياري)"
                      value={newRealtor.phone}
                      onChange={e => setNewRealtor({ ...newRealtor, phone: e.target.value })}
                    />
                    <button type="button" onClick={createRealtor} className="btn-secondary w-full">
                      إضافة الوسيط
                    </button>
                  </div>
                ) : (
                  <select
                    className="input"
                    value={realtorId}
                    onChange={e => setRealtorId(e.target.value)}
                    required
                  >
                    <option value="">— اختر —</option>
                    {realtors.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name}{r.office_name ? ` · ${r.office_name}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="label">النسبة (%)</label>
              <input
                className="input"
                type="number"
                step="0.1"
                min="0.1"
                max={remaining}
                value={percentage}
                onChange={e => setPercentage(e.target.value)}
                placeholder={remaining.toFixed(1)}
                required
              />
            </div>

            <div>
              <label className="label">ملاحظات (اختياري)</label>
              <input
                className="input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'جارٍ...' : 'إضافة'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
