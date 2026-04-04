'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiGet } from '@/lib/api'
import { getUserProfile } from '@/lib/supabase'
import SaleForm from './_components/SaleForm'

type Sale = {
  id: string
  unit_id: string
  customer_id: string
  reservation_id: string | null
  payment_amount: number
  payment_method: string
  payment_reference: string | null
  payment_date: string
  status: string
  units: { unit_number: string; building_id: string }
  customers: { full_name: string; id_number: string }
}

type Reservation = {
  id: string
  unit_id: string
  customer_id: string
  status: string
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقد',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
}

function SalesContent() {
  const searchParams = useSearchParams()
  const reservationId = searchParams.get('reservation_id') ?? undefined

  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canWrite, setCanWrite] = useState(false)

  const [form, setForm] = useState<{
    open: boolean
    reservation?: Reservation
  }>({ open: false })

  const [prefillError, setPrefillError] = useState('')

  useEffect(() => {
    getUserProfile().then(profile => {
      const role = (profile as { role?: string } | null)?.role
      setCanWrite(['owner', 'sales_manager'].includes(role ?? ''))
    })
  }, [])

  const loadSales = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<Sale[]>('/sales')
      setSales(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المبيعات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  // Auto-open form if URL has reservation_id
  useEffect(() => {
    if (!reservationId) return
    apiGet<Reservation[]>('/reservations')
      .then(reservations => {
        const r = reservations.find(r => r.id === reservationId)
        if (!r) {
          setPrefillError('الحجز غير موجود')
          return
        }
        if (r.status !== 'active') {
          setPrefillError('هذا الحجز لا يمكن تحويله')
          return
        }
        setForm({ open: true, reservation: r })
      })
      .catch(() => setPrefillError('تعذر تحميل بيانات الحجز'))
  }, [reservationId])

  function handleFormSaved() {
    setForm({ open: false })
    loadSales()
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">المبيعات</h1>
        {canWrite && (
          <button onClick={() => setForm({ open: true })} className="btn-primary">
            + بيعة جديدة
          </button>
        )}
      </div>

      {prefillError && (
        <p className="text-red-600 text-sm mb-4">{prefillError}</p>
      )}

      <div className="card">
        {loading ? (
          <p className="text-stone-500 text-sm">جارٍ التحميل...</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : sales.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">لا توجد مبيعات</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-right">
                <th className="pb-3 font-medium text-stone-600">الوحدة</th>
                <th className="pb-3 font-medium text-stone-600">العميل</th>
                <th className="pb-3 font-medium text-stone-600">مبلغ البيع</th>
                <th className="pb-3 font-medium text-stone-600">طريقة الدفع</th>
                <th className="pb-3 font-medium text-stone-600">تاريخ البيع</th>
                <th className="pb-3 font-medium text-stone-600">النوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sales.map(s => (
                <tr key={s.id}>
                  <td className="py-3 font-medium">{s.units.unit_number}</td>
                  <td className="py-3">{s.customers.full_name}</td>
                  <td className="py-3">{s.payment_amount.toLocaleString('ar-SA')} ر.س</td>
                  <td className="py-3">{PAYMENT_METHOD_LABELS[s.payment_method] ?? s.payment_method}</td>
                  <td className="py-3">{s.payment_date}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                      {s.reservation_id ? 'تحويل من حجز' : 'مباشر'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form.open && (
        <SaleForm
          reservation={form.reservation}
          onClose={() => setForm({ open: false })}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  )
}

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesContent />
    </Suspense>
  )
}
