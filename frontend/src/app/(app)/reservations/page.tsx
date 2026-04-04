'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import { getUserProfile } from '@/lib/supabase'
import ReservationForm from './_components/ReservationForm'
import CancelModal from './_components/CancelModal'
import ReturnDepositModal from './_components/ReturnDepositModal'

type Reservation = {
  id: string
  unit_id: string
  customer_id: string
  status: 'active' | 'converted' | 'cancelled'
  deposit_amount: number
  deposit_returned: boolean
  payment_method: string
  payment_reference: string | null
  payment_date: string
  expires_at: string
  receipt_file_url: string | null
  notes: string | null
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقد',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date(new Date().toDateString())
}

function StatusBadge({ reservation }: { reservation: Reservation }) {
  if (reservation.status === 'converted') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
        محوّلة
      </span>
    )
  }
  const expired = isExpired(reservation.expires_at)
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      expired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
    }`}>
      {expired ? 'منتهية' : 'نشطة'}
    </span>
  )
}

function ReservationsContent() {
  const searchParams = useSearchParams()
  const prefillUnitId = searchParams.get('unit_id') ?? undefined
  const prefillCustomerId = searchParams.get('customer_id') ?? undefined

  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [canWrite, setCanWrite] = useState(false)
  const [canSale, setCanSale] = useState(false)

  const [form, setForm] = useState<{
    open: boolean
    reservation?: Reservation
    prefillUnitId?: string
    prefillCustomerId?: string
  }>({ open: false })

  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [returnDepositTarget, setReturnDepositTarget] = useState<string | null>(null)

  useEffect(() => {
    getUserProfile().then(profile => {
      const role = (profile as { role?: string } | null)?.role
      setCanWrite(['owner', 'sales_manager', 'reservation_manager'].includes(role ?? ''))
      setCanSale(['owner', 'sales_manager'].includes(role ?? ''))
    })
  }, [])

  const loadReservations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<Reservation[]>('/reservations')
      setReservations(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الحجوزات')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReservations()
  }, [loadReservations])

  useEffect(() => {
    if (prefillUnitId || prefillCustomerId) {
      setForm({ open: true, prefillUnitId, prefillCustomerId })
    }
  }, [prefillUnitId, prefillCustomerId])

  function handleFormSaved() {
    setForm({ open: false })
    loadReservations()
  }

  function handleCancelled() {
    setCancelTarget(null)
    loadReservations()
  }

  function handleDepositReturned() {
    setReturnDepositTarget(null)
    loadReservations()
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">الحجوزات</h1>
        {canWrite && (
          <button
            onClick={() => setForm({ open: true })}
            className="btn-primary"
          >
            + حجز جديد
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p className="text-stone-500 text-sm">جارٍ التحميل...</p>
        ) : error ? (
          <p className="text-red-600 text-sm">{error}</p>
        ) : reservations.length === 0 ? (
          <p className="text-stone-400 text-sm text-center py-12">لا توجد حجوزات</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-right">
                <th className="pb-3 font-medium text-stone-600">الوحدة</th>
                <th className="pb-3 font-medium text-stone-600">العميل</th>
                <th className="pb-3 font-medium text-stone-600">مبلغ العربون</th>
                <th className="pb-3 font-medium text-stone-600">طريقة الدفع</th>
                <th className="pb-3 font-medium text-stone-600">تاريخ الدفع</th>
                <th className="pb-3 font-medium text-stone-600">تاريخ الانتهاء</th>
                <th className="pb-3 font-medium text-stone-600">الحالة</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reservations.map(r => (
                <tr key={r.id}>
                  <td className="py-3 font-medium">{r.units.unit_number}</td>
                  <td className="py-3">{r.customers.full_name}</td>
                  <td className="py-3">{r.deposit_amount.toLocaleString('ar-SA')} ر.س</td>
                  <td className="py-3">{PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method}</td>
                  <td className="py-3">{r.payment_date}</td>
                  <td className="py-3">{r.expires_at}</td>
                  <td className="py-3"><StatusBadge reservation={r} /></td>
                  <td className="py-3 text-left space-x-2 space-x-reverse">
                    {r.status === 'active' && canWrite && (
                      <>
                        <button
                          onClick={() => setForm({ open: true, reservation: r })}
                          className="text-stone-400 hover:text-stone-700 text-xs"
                          title="تعديل"
                        >✎</button>
                        <button
                          onClick={() => setCancelTarget(r.id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                          title="إلغاء"
                        >✕</button>
                      </>
                    )}
                    {r.status === 'active' && canSale && (
                      <Link
                        href={`/sales?reservation_id=${r.id}`}
                        className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                      >
                        تحويل
                      </Link>
                    )}
                    {r.status === 'converted' && canSale && !r.deposit_returned && (
                      <button
                        onClick={() => setReturnDepositTarget(r.id)}
                        className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                      >
                        سداد العربون
                      </button>
                    )}
                    {r.status === 'converted' && r.deposit_returned && (
                      <span className="text-green-600 text-xs">✓ عربون مُسترد</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form.open && (
        <ReservationForm
          reservation={form.reservation}
          prefillUnitId={form.prefillUnitId}
          prefillCustomerId={form.prefillCustomerId}
          onClose={() => setForm({ open: false })}
          onSaved={handleFormSaved}
        />
      )}

      {cancelTarget && (
        <CancelModal
          reservationId={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={handleCancelled}
        />
      )}

      {returnDepositTarget && (
        <ReturnDepositModal
          reservationId={returnDepositTarget}
          onClose={() => setReturnDepositTarget(null)}
          onReturned={handleDepositReturned}
        />
      )}
    </div>
  )
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={null}>
      <ReservationsContent />
    </Suspense>
  )
}
