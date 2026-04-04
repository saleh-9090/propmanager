'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import { supabase } from '@/lib/supabase'

type Unit = {
  id: string
  unit_number: string
  building_id: string
  price: number
  status: string
}

type Customer = {
  id: string
  full_name: string
  id_number: string
}

type Reservation = {
  id: string
  unit_id: string
  customer_id: string
  deposit_amount: number
  payment_method: string
  payment_reference: string | null
  payment_date: string
  expires_at: string
  receipt_file_url: string | null
  notes: string | null
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string }
}

type Props = {
  reservation?: Reservation
  prefillUnitId?: string
  prefillCustomerId?: string
  onClose: () => void
  onSaved: () => void
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقد' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' },
]

function defaultExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

export default function ReservationForm({ reservation, prefillUnitId, prefillCustomerId, onClose, onSaved }: Props) {
  const isEdit = !!reservation

  const [units, setUnits] = useState<Unit[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [unitSearch, setUnitSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [unitId, setUnitId] = useState(reservation?.unit_id ?? prefillUnitId ?? '')
  const [customerId, setCustomerId] = useState(reservation?.customer_id ?? prefillCustomerId ?? '')
  const [depositAmount, setDepositAmount] = useState(reservation?.deposit_amount ?? 0)
  const [paymentMethod, setPaymentMethod] = useState(reservation?.payment_method ?? 'bank_transfer')
  const [paymentReference, setPaymentReference] = useState(reservation?.payment_reference ?? '')
  const [paymentDate, setPaymentDate] = useState(reservation?.payment_date ?? new Date().toISOString().slice(0, 10))
  const [expiresAt, setExpiresAt] = useState(reservation?.expires_at ?? defaultExpiry())
  const [notes, setNotes] = useState(reservation?.notes ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const [prefillUnitLabel, setPrefillUnitLabel] = useState<string>('')
  const [prefillCustomerLabel, setPrefillCustomerLabel] = useState<string>('')

  const unitLocked = !!prefillUnitId || isEdit
  const customerLocked = !!prefillCustomerId || isEdit

  useEffect(() => {
    if (!unitLocked) {
      apiGet<Unit[]>('/units').then(setUnits).catch(() => {})
    }
  }, [unitLocked])

  useEffect(() => {
    if (!customerLocked) {
      const url = customerSearch
        ? `/customers?search=${encodeURIComponent(customerSearch)}`
        : '/customers'
      apiGet<Customer[]>(url).then(setCustomers).catch(() => {})
    }
  }, [customerSearch, customerLocked])

  useEffect(() => {
    if (prefillUnitId && !isEdit) {
      apiGet<{ id: string; unit_number: string; price: number }[]>(`/units`).then(units => {
        const u = units.find(u => u.id === prefillUnitId)
        if (u) setPrefillUnitLabel(`${u.unit_number} — ${u.price.toLocaleString('ar-SA')} ر.س`)
      }).catch(() => setPrefillUnitLabel(prefillUnitId))
    }
  }, [prefillUnitId, isEdit])

  useEffect(() => {
    if (prefillCustomerId && !isEdit) {
      apiGet<{ id: string; full_name: string; id_number: string }[]>('/customers').then(customers => {
        const c = customers.find(c => c.id === prefillCustomerId)
        if (c) setPrefillCustomerLabel(`${c.full_name} — ${c.id_number}`)
      }).catch(() => setPrefillCustomerLabel(prefillCustomerId))
    }
  }, [prefillCustomerId, isEdit])

  const filteredUnits = units.filter(u =>
    u.status === 'available' &&
    u.unit_number.toLowerCase().includes(unitSearch.toLowerCase())
  )

  async function handleReceiptUpload(file: File) {
    if (!reservation) return
    setUploading(true)
    setError('')
    try {
      const path = `${reservation.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data } = supabase.storage.from('receipts').getPublicUrl(path)
      await apiPatch(`/reservations/${reservation.id}`, { receipt_file_url: data.publicUrl })
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر رفع الإيصال')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId || !customerId) {
      setError('الوحدة والعميل مطلوبان')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        deposit_amount: depositAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        expires_at: expiresAt,
      }
      if (paymentReference) payload.payment_reference = paymentReference
      if (notes) payload.notes = notes

      if (isEdit) {
        await apiPatch(`/reservations/${reservation.id}`, payload)
      } else {
        payload.unit_id = unitId
        payload.customer_id = customerId
        await apiPost('/reservations', payload)
      }
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الحجز')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-stone-900 mb-4">
          {isEdit ? 'تعديل الحجز' : 'حجز جديد'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Unit */}
          {unitLocked ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">الوحدة</label>
              <p className="input bg-stone-50 text-stone-600">
                {reservation?.units.unit_number ?? (prefillUnitLabel || prefillUnitId)}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">الوحدة *</label>
              <input
                className="input w-full mb-1"
                placeholder="بحث برقم الوحدة..."
                value={unitSearch}
                onChange={e => setUnitSearch(e.target.value)}
              />
              <select
                className="input w-full"
                value={unitId}
                onChange={e => setUnitId(e.target.value)}
                required
              >
                <option value="">اختر وحدة...</option>
                {filteredUnits.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number} — {u.price.toLocaleString('ar-SA')} ر.س
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer */}
          {customerLocked ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">العميل</label>
              <p className="input bg-stone-50 text-stone-600">
                {reservation?.customers.full_name ?? (prefillCustomerLabel || prefillCustomerId)}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">العميل *</label>
              <input
                className="input w-full mb-1"
                placeholder="بحث بالاسم أو الهوية..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
              <select
                className="input w-full"
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                required
              >
                <option value="">اختر عميل...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} — {c.id_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Deposit amount */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">مبلغ العربون (ر.س) *</label>
            <input
              type="number"
              className="input w-full"
              min={0}
              step={0.01}
              value={depositAmount}
              onChange={e => setDepositAmount(Number(e.target.value))}
              required
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">طريقة الدفع *</label>
            <select
              className="input w-full"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              required
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Payment reference */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">رقم المرجع</label>
            <input
              className="input w-full"
              value={paymentReference}
              onChange={e => setPaymentReference(e.target.value)}
              placeholder="رقم التحويل أو الشيك..."
            />
          </div>

          {/* Payment date */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">تاريخ الدفع *</label>
            <input
              type="date"
              className="input w-full"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              required
            />
          </div>

          {/* Expires at */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">تاريخ انتهاء الحجز *</label>
            <input
              type="date"
              className="input w-full"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">ملاحظات</label>
            <textarea
              className="input w-full"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Receipt upload — edit mode only */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">الإيصال</label>
              {reservation.receipt_file_url ? (
                <div className="flex items-center gap-3">
                  <a
                    href={reservation.receipt_file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 text-sm underline"
                  >
                    عرض الإيصال
                  </a>
                  <label className="text-sm text-stone-500 cursor-pointer hover:text-stone-700">
                    استبدال
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])}
                    />
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-sm text-stone-500 cursor-pointer hover:text-stone-700">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])}
                  />
                  {uploading ? 'جارٍ الرفع...' : 'رفع إيصال'}
                </label>
              )}
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إنشاء الحجز'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
