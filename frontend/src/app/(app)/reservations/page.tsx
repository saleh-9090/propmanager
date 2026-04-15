'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiGet, apiOpenBlob } from '@/lib/api'
import { useRole } from '../_components/ProfileContext'
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
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-bg-elevated text-text-secondary">
        محوّلة
      </span>
    )
  }
  const expired = isExpired(reservation.expires_at)
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      expired ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success'
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
  const role = useRole()
  const canWrite = ['owner', 'sales_manager', 'reservation_manager'].includes(role)
  const canSale = ['owner', 'sales_manager'].includes(role)

  const [form, setForm] = useState<{
    open: boolean
    reservation?: Reservation
    prefillUnitId?: string
    prefillCustomerId?: string
  }>({ open: false })

  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [returnDepositTarget, setReturnDepositTarget] = useState<string | null>(null)

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
        <h1 className="text-2xl font-bold text-text-primary">الحجوزات</h1>
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
          <p className="text-text-secondary text-sm">جارٍ التحميل...</p>
        ) : error ? (
          <p className="text-danger text-sm">{error}</p>
        ) : reservations.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-12">لا توجد حجوزات</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right">
                <th className="pb-3 font-medium text-text-secondary">الوحدة</th>
                <th className="pb-3 font-medium text-text-secondary">العميل</th>
                <th className="pb-3 font-medium text-text-secondary">مبلغ العربون</th>
                <th className="pb-3 font-medium text-text-secondary">طريقة الدفع</th>
                <th className="pb-3 font-medium text-text-secondary">تاريخ الدفع</th>
                <th className="pb-3 font-medium text-text-secondary">تاريخ الانتهاء</th>
                <th className="pb-3 font-medium text-text-secondary">الحالة</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reservations.map(r => (
                <tr key={r.id}>
                  <td className="py-3 font-medium">{r.units.unit_number}</td>
                  <td className="py-3">{r.customers.full_name}</td>
                  <td className="py-3">{r.deposit_amount.toLocaleString('ar-SA')} ر.س</td>
                  <td className="py-3">{PAYMENT_METHOD_LABELS[r.payment_method] ?? r.payment_method}</td>
                  <td className="py-3">{r.payment_date}</td>
                  <td className="py-3">{r.expires_at}</td>
                  <td className="py-3"><StatusBadge reservation={r} /></td>
                  <td className="py-3 text-left flex items-center space-x-2 space-x-reverse">
                    <button
                      onClick={() =>
                        apiOpenBlob(`/reservations/${r.id}/receipt.pdf`).catch(err =>
                          alert(err instanceof Error ? err.message : 'تعذر تحميل السند')
                        )
                      }
                      className="text-text-muted hover:text-brand-primary text-xs font-medium"
                      title="تحميل السند (PDF)"
                    >سند</button>
                    {r.status === 'active' && canWrite && (
                      <>
                        <button
                          onClick={() => setForm({ open: true, reservation: r })}
                          className="text-text-muted hover:text-text-secondary text-xs"
                          title="تعديل"
                        >✎</button>
                        <button
                          onClick={() => setCancelTarget(r.id)}
                          className="text-danger/70 hover:text-danger text-xs"
                          title="إلغاء"
                        >✕</button>
                      </>
                    )}
                    {r.status === 'active' && canSale && (
                      <Link
                        href={`/sales?reservation_id=${r.id}`}
                        className="text-brand-primary hover:opacity-80 text-xs font-medium"
                      >
                        تحويل
                      </Link>
                    )}
                    {r.status === 'converted' && canSale && !r.deposit_returned && (
                      <button
                        onClick={() => setReturnDepositTarget(r.id)}
                        className="text-warning hover:text-warning text-xs font-medium"
                      >
                        سداد العربون
                      </button>
                    )}
                    {r.status === 'converted' && r.deposit_returned && (
                      <span className="text-success text-xs">✓ عربون مُسترد</span>
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
