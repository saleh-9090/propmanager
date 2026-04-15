'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/api'
import AddParticipantModal from './AddParticipantModal'

type Sale = {
  id: string
  total_commission_amount: number | null
  commission_finalized: boolean
  commission_finalized_at: string | null
}

type Participant = {
  id: string
  type: 'internal' | 'external'
  commission_percentage: number
  notes: string | null
  user_profiles?: { id: string; full_name: string; role: string } | null
  external_realtors?: { id: string; name: string; office_name: string | null } | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'المالك',
  cfo: 'المدير المالي',
  sales_manager: 'مدير المبيعات',
  reservation_manager: 'مدير الحجوزات',
  accountant: 'المحاسب',
}

export default function CommissionSection({
  sale,
  role,
  onChange,
}: {
  sale: Sale
  role: string
  onChange: () => void
}) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [totalInput, setTotalInput] = useState<string>(
    sale.total_commission_amount?.toString() ?? ''
  )
  const [savingTotal, setSavingTotal] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')

  const canEdit = !sale.commission_finalized && ['owner', 'sales_manager'].includes(role)
  const canFinalize = !sale.commission_finalized && role === 'owner'

  const loadParticipants = useCallback(async () => {
    try {
      const data = await apiGet<Participant[]>(`/sales/${sale.id}/participants`)
      setParticipants(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المشاركين')
    }
  }, [sale.id])

  useEffect(() => { loadParticipants() }, [loadParticipants])

  useEffect(() => {
    setTotalInput(sale.total_commission_amount?.toString() ?? '')
  }, [sale.total_commission_amount])

  const totalPct = participants.reduce((sum, p) => sum + Number(p.commission_percentage), 0)
  const totalAmount = Number(sale.total_commission_amount ?? 0)
  const allocated = Math.min(totalPct, 100)
  const pctColor = totalPct > 100 ? 'text-danger'
                 : totalPct === 100 ? 'text-success'
                 : 'text-warning'
  const barColor = totalPct > 100 ? 'bg-danger'
                 : totalPct === 100 ? 'bg-success'
                 : 'bg-warning'

  async function saveTotal() {
    const val = parseFloat(totalInput)
    if (isNaN(val) || val < 0) {
      setError('أدخل مبلغ صحيح')
      return
    }
    setSavingTotal(true)
    setError('')
    try {
      await apiPatch(`/sales/${sale.id}/commission-total`, { total_commission_amount: val })
      onChange()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ المبلغ')
    } finally {
      setSavingTotal(false)
    }
  }

  async function removeParticipant(id: string) {
    if (!confirm('حذف المشارك؟')) return
    setError('')
    try {
      await apiDelete(`/sales/${sale.id}/participants/${id}`)
      loadParticipants()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف')
    }
  }

  async function updatePercentage(id: string, newPct: number) {
    setError('')
    try {
      await apiPatch(`/sales/${sale.id}/participants/${id}`, { commission_percentage: newPct })
      setEditing(null)
      loadParticipants()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر التحديث')
    }
  }

  async function finalize() {
    if (!confirm('اعتماد العمولة نهائياً؟ لن يمكن التعديل بعد ذلك.')) return
    setFinalizing(true)
    setError('')
    try {
      await apiPost(`/sales/${sale.id}/finalize`, {})
      onChange()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الاعتماد')
    } finally {
      setFinalizing(false)
    }
  }

  function participantName(p: Participant): string {
    if (p.type === 'internal' && p.user_profiles) {
      return p.user_profiles.full_name
    }
    if (p.type === 'external' && p.external_realtors) {
      return p.external_realtors.name
    }
    return '—'
  }

  function participantSubtitle(p: Participant): string {
    if (p.type === 'internal' && p.user_profiles) {
      return ROLE_LABELS[p.user_profiles.role] ?? p.user_profiles.role
    }
    if (p.type === 'external' && p.external_realtors) {
      return p.external_realtors.office_name ?? 'وسيط خارجي'
    }
    return ''
  }

  return (
    <div className="card space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">العمولة</h2>
          <p className="text-text-muted text-xs mt-1">
            {sale.commission_finalized
              ? `معتمدة بتاريخ ${sale.commission_finalized_at?.slice(0, 10) ?? ''}`
              : 'حدد الإجمالي وأضف المشاركين ثم اعتمد العمولة'}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-input text-danger text-sm">
          {error}
        </div>
      )}

      {/* Total commission input */}
      <div>
        <label className="label">إجمالي العمولة</label>
        <div className="flex items-stretch gap-2">
          <div className="relative flex-1 max-w-xs">
            <input
              type="number"
              className="input pl-14"
              value={totalInput}
              onChange={e => setTotalInput(e.target.value)}
              disabled={!canEdit}
              placeholder="0"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">ر.س</span>
          </div>
          {canEdit && (
            <button
              onClick={saveTotal}
              disabled={savingTotal || totalInput === (sale.total_commission_amount?.toString() ?? '')}
              className="btn-secondary disabled:opacity-50"
            >
              {savingTotal ? 'جارٍ...' : 'حفظ'}
            </button>
          )}
        </div>
      </div>

      {/* Allocation bar */}
      {totalAmount > 0 && (
        <div className="bg-bg-base border border-border rounded-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">الموزّع</span>
            <span className={`font-semibold ${pctColor}`}>
              {totalPct.toFixed(1)}%
              {totalPct > 100 && ' (تجاوز)'}
            </span>
          </div>
          <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all`}
              style={{ width: `${Math.min(allocated, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{(totalAmount * (totalPct / 100)).toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س موزّع</span>
            <span>من {totalAmount.toLocaleString('ar-SA')} ر.س</span>
          </div>
        </div>
      )}

      {/* Participants list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text-primary">المشاركون</h3>
          {canEdit && (
            <button onClick={() => setShowAdd(true)} className="btn-ghost text-sm">
              + إضافة مشارك
            </button>
          )}
        </div>

        {participants.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8 border border-dashed border-border rounded-card">
            لم يُضف أي مشارك بعد
          </p>
        ) : (
          <div className="space-y-2">
            {participants.map(p => {
              const amount = totalAmount * (Number(p.commission_percentage) / 100)
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-bg-base border border-border rounded-card hover:border-border-hover transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                      p.type === 'internal'
                        ? 'bg-brand-primary/15 text-brand-primary'
                        : 'bg-brand-secondary/15 text-brand-secondary'
                    }`}>
                      {participantName(p).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-text-primary text-sm font-medium truncate">
                          {participantName(p)}
                        </p>
                        <span className={`badge ${p.type === 'internal' ? 'badge-primary' : 'badge-neutral'}`}>
                          {p.type === 'internal' ? 'داخلي' : 'خارجي'}
                        </span>
                      </div>
                      <p className="text-text-muted text-xs truncate">{participantSubtitle(p)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-left">
                      {editing === p.id ? (
                        <InlinePercentEdit
                          initial={Number(p.commission_percentage)}
                          onSave={(v) => updatePercentage(p.id, v)}
                          onCancel={() => setEditing(null)}
                        />
                      ) : (
                        <button
                          onClick={() => canEdit && setEditing(p.id)}
                          disabled={!canEdit}
                          className={`text-text-primary font-semibold text-sm ${canEdit ? 'hover:text-brand-primary cursor-pointer' : 'cursor-default'}`}
                        >
                          {Number(p.commission_percentage).toFixed(1)}%
                        </button>
                      )}
                      <p className="text-text-muted text-xs mt-0.5">
                        {amount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س
                      </p>
                    </div>
                    {canEdit && editing !== p.id && (
                      <button
                        onClick={() => removeParticipant(p.id)}
                        className="text-text-muted hover:text-danger text-sm"
                        title="حذف"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Finalize */}
      {canFinalize && participants.length > 0 && (
        <div className="pt-4 border-t border-border">
          <button
            onClick={finalize}
            disabled={finalizing || totalPct !== 100 || totalAmount <= 0}
            className="btn-primary disabled:opacity-50"
          >
            {finalizing ? 'جارٍ الاعتماد...' : 'اعتماد العمولة'}
          </button>
          <p className="text-text-muted text-xs mt-2">
            {totalAmount <= 0 && 'حدد إجمالي العمولة أولاً · '}
            {totalPct !== 100 && 'مجموع النسب يجب أن يكون 100٪ · '}
            الاعتماد يقفل التعديل
          </p>
        </div>
      )}

      {showAdd && (
        <AddParticipantModal
          saleId={sale.id}
          currentTotal={totalPct}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); loadParticipants() }}
        />
      )}
    </div>
  )
}

function InlinePercentEdit({
  initial,
  onSave,
  onCancel,
}: {
  initial: number
  onSave: (v: number) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(initial.toString())
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.1"
        min="0.1"
        max="100"
        value={val}
        onChange={e => setVal(e.target.value)}
        autoFocus
        className="w-20 bg-bg-surface border border-brand-primary text-text-primary rounded-btn px-2 py-1 text-sm"
      />
      <button
        onClick={() => {
          const n = parseFloat(val)
          if (!isNaN(n) && n > 0 && n <= 100) onSave(n)
        }}
        className="text-success text-sm px-1"
      >✓</button>
      <button onClick={onCancel} className="text-text-muted text-sm px-1">✕</button>
    </div>
  )
}
