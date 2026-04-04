'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'

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
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string }
}

type Props = {
  reservation?: Reservation
  onClose: () => void
  onSaved: () => void
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقد' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'check', label: 'شيك' },
]

export default function SaleForm({ reservation, onClose, onSaved }: Props) {
  const isConversion = !!reservation

  const [units, setUnits] = useState<Unit[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [unitSearch, setUnitSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')

  const [unitId, setUnitId] = useState(reservation?.unit_id ?? '')
  const [customerId, setCustomerId] = useState(reservation?.customer_id ?? '')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isConversion) {
      apiGet<Unit[]>('/units').then(setUnits).catch(() => {})
      apiGet<Customer[]>('/customers').then(setCustomers).catch(() => {})
    }
  }, [isConversion])

  useEffect(() => {
    if (!isConversion && customerSearch) {
      apiGet<Customer[]>(`/customers?search=${encodeURIComponent(customerSearch)}`)
        .then(setCustomers)
        .catch(() => {})
    }
  }, [customerSearch, isConversion])

  const filteredUnits = units.filter(
    u => u.status === 'available' &&
    u.unit_number.toLowerCase().includes(unitSearch.toLowerCase())
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId || !customerId) {
      setError('الوحدة والعميل مطلوبان')
      return
    }
    if (paymentAmount <= 0) {
      setError('مبلغ البيع يجب أن يكون أكبر من صفر')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        unit_id: unitId,
        customer_id: customerId,
        payment_amount: paymentAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
      }
      if (reservation?.id) payload.reservation_id = reservation.id
      if (paymentReference) payload.payment_reference = paymentReference
      if (notes) payload.notes = notes
      await apiPost('/sales', payload)
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ البيعة')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-stone-900 mb-4">
          {isConversion ? 'تحويل حجز إلى بيعة' : 'بيعة جديدة'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Unit */}
          {isConversion ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">الوحدة</label>
              <p className="input bg-stone-50 text-stone-600">
                {reservation.units.unit_number} — {reservation.units.price.toLocaleString('ar-SA')} ر.س
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
          {isConversion ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">العميل</label>
              <p className="input bg-stone-50 text-stone-600">
                {reservation.customers.full_name} — {reservation.customers.id_number}
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

          {/* Payment amount */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">مبلغ البيع (ر.س) *</label>
            <input
              type="number"
              className="input w-full"
              min={1}
              step={0.01}
              value={paymentAmount || ''}
              onChange={e => setPaymentAmount(Number(e.target.value))}
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
            <label className="block text-sm font-medium text-stone-700 mb-1">تاريخ البيع *</label>
            <input
              type="date"
              className="input w-full"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
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

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">إلغاء</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'جارٍ الحفظ...' : isConversion ? 'تأكيد التحويل' : 'تسجيل البيعة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
