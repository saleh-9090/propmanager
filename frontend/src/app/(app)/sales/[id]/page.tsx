'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '@/lib/api'
import { getUserProfile } from '@/lib/supabase'
import CommissionSection from '../_components/CommissionSection'

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
  total_commission_amount: number | null
  commission_finalized: boolean
  commission_finalized_at: string | null
  units: { unit_number: string; building_id: string; price: number }
  customers: { full_name: string; id_number: string; phone: string }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقد',
  bank_transfer: 'تحويل بنكي',
  check: 'شيك',
}

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const saleId = params.id

  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [role, setRole] = useState<string>('')

  const loadSale = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<Sale>(`/sales/${saleId}`)
      setSale(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل البيعة')
    } finally {
      setLoading(false)
    }
  }, [saleId])

  useEffect(() => {
    loadSale()
    getUserProfile().then(p => setRole((p as { role?: string } | null)?.role ?? ''))
  }, [loadSale])

  if (loading) {
    return (
      <div className="max-w-5xl">
        <p className="text-text-secondary text-sm">جارٍ التحميل...</p>
      </div>
    )
  }

  if (error || !sale) {
    return (
      <div className="max-w-5xl">
        <p className="text-danger text-sm mb-4">{error || 'البيعة غير موجودة'}</p>
        <Link href="/sales" className="btn-ghost">← العودة للمبيعات</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/sales')}
            className="text-text-muted hover:text-text-secondary text-sm mb-3 flex items-center gap-1"
          >
            ← المبيعات
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              بيعة الوحدة {sale.units.unit_number}
            </h1>
            {sale.commission_finalized && (
              <span className="badge badge-success">معتمدة</span>
            )}
            {!sale.commission_finalized && (
              <span className="badge badge-neutral">قيد الإعداد</span>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="label">العميل</p>
            <p className="text-text-primary font-medium">{sale.customers.full_name}</p>
            <p className="text-text-muted text-xs mt-0.5">
              {sale.customers.id_number} · {sale.customers.phone}
            </p>
          </div>
          <div>
            <p className="label">مبلغ البيع</p>
            <p className="text-text-primary font-semibold text-lg">
              {sale.payment_amount.toLocaleString('ar-SA')} <span className="text-text-muted text-sm font-normal">ر.س</span>
            </p>
          </div>
          <div>
            <p className="label">طريقة الدفع</p>
            <p className="text-text-primary">
              {PAYMENT_METHOD_LABELS[sale.payment_method] ?? sale.payment_method}
            </p>
            {sale.payment_reference && (
              <p className="text-text-muted text-xs mt-0.5">مرجع: {sale.payment_reference}</p>
            )}
          </div>
          <div>
            <p className="label">تاريخ البيع</p>
            <p className="text-text-primary">{sale.payment_date}</p>
          </div>
        </div>
      </div>

      <CommissionSection
        sale={sale}
        role={role}
        onChange={loadSale}
      />
    </div>
  )
}
