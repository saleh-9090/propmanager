// frontend/src/app/customers/page.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { apiDelete, apiGet } from '@/lib/api'
import { useRole } from '../_components/ProfileContext'
import CustomerFormModal from './_components/CustomerFormModal'

type Customer = {
  id: string
  full_name: string
  id_type: string
  id_number: string
  phone: string
  email: string | null
  birthdate: string | null
  lead_source: string
  notes: string | null
}

const ID_TYPE_LABELS: Record<string, string> = {
  national_id: 'هوية',
  iqama:       'إقامة',
  passport:    'جواز',
}

const ID_TYPE_COLORS: Record<string, string> = {
  national_id: 'bg-blue-100 text-blue-700',
  iqama:       'bg-purple-100 text-purple-700',
  passport:    'bg-bg-elevated text-text-secondary',
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  instagram:        'انستغرام',
  snapchat:         'سناب شات',
  tiktok:           'تيك توك',
  realtor_referral: 'وسيط عقاري',
  walk_in:          'زيارة مباشرة',
  direct:           'مباشر',
  other:            'أخرى',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<{ open: boolean; customer?: Customer }>({ open: false })
  const role = useRole()
  const isOwner = role === 'owner'
  const canWrite = ['owner', 'sales_manager', 'reservation_manager'].includes(role)

  const isFirstRender = useRef(true)

  const loadCustomers = useCallback(async (searchTerm: string) => {
    setLoading(true)
    setError('')
    try {
      const url = searchTerm ? `/customers?search=${encodeURIComponent(searchTerm)}` : '/customers'
      const data = await apiGet<Customer[]>(url)
      setCustomers(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل العملاء')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load is instant; subsequent search changes are debounced 300ms
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      loadCustomers(search)
      return
    }
    const t = setTimeout(() => loadCustomers(search), 300)
    return () => clearTimeout(t)
  }, [search, loadCustomers])

  async function handleDelete(customerId: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return
    try {
      await apiDelete(`/customers/${customerId}`)
      setCustomers(prev => prev.filter(c => c.id !== customerId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف العميل')
    }
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">العملاء</h1>
        {canWrite && (
          <button onClick={() => setModal({ open: true })} className="btn-primary">
            + عميل جديد
          </button>
        )}
      </div>

      <div className="mb-4">
        <input
          className="input max-w-md"
          placeholder="بحث بالاسم أو رقم الهوية أو الجوال..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        {loading ? (
          <p className="text-text-secondary text-sm">جارٍ التحميل...</p>
        ) : error ? (
          <p className="text-danger text-sm">{error}</p>
        ) : customers.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-12">
            {search ? 'لا توجد نتائج' : 'لا يوجد عملاء — أضف عميلاً جديداً'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-right">
                <th className="pb-3 font-medium text-text-secondary">الاسم</th>
                <th className="pb-3 font-medium text-text-secondary">الهوية</th>
                <th className="pb-3 font-medium text-text-secondary">رقم الهوية</th>
                <th className="pb-3 font-medium text-text-secondary">الجوال</th>
                <th className="pb-3 font-medium text-text-secondary">المصدر</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map(c => (
                <tr key={c.id}>
                  <td className="py-3 font-medium">{c.full_name}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ID_TYPE_COLORS[c.id_type] ?? 'bg-bg-elevated text-text-secondary'}`}>
                      {ID_TYPE_LABELS[c.id_type] ?? c.id_type}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-xs text-text-secondary">{c.id_number}</td>
                  <td className="py-3">{c.phone}</td>
                  <td className="py-3 text-text-secondary">{LEAD_SOURCE_LABELS[c.lead_source] ?? c.lead_source}</td>
                  <td className="py-3 text-left">
                    <Link
                      href={`/reservations?customer_id=${c.id}`}
                      className="btn-ghost text-xs ml-2"
                    >
                      احجز
                    </Link>
                    {canWrite && (
                      <button
                        onClick={() => setModal({ open: true, customer: c })}
                        className="text-text-muted hover:text-text-secondary ml-2 text-xs"
                        title="تعديل"
                      >✎</button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(c.id, c.full_name)}
                        className="text-danger/70 hover:text-danger text-xs"
                        title="حذف"
                      >×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <CustomerFormModal
          customer={modal.customer}
          onClose={() => setModal({ open: false })}
          onSaved={() => loadCustomers(search)}
        />
      )}
    </div>
  )
}
