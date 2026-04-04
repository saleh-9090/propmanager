// frontend/src/app/customers/_components/CustomerFormModal.tsx
'use client'

import { useState } from 'react'
import { apiPatch, apiPost } from '@/lib/api'

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

type Props = {
  customer?: Customer
  onClose: () => void
  onSaved: () => void
}

const ID_TYPE_LABELS: Record<string, string> = {
  national_id: 'هوية وطنية',
  iqama:       'إقامة',
  passport:    'جواز سفر',
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

export default function CustomerFormModal({ customer, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    full_name:   customer?.full_name   ?? '',
    id_type:     customer?.id_type     ?? 'national_id',
    id_number:   customer?.id_number   ?? '',
    phone:       customer?.phone       ?? '',
    email:       customer?.email       ?? '',
    birthdate:   customer?.birthdate   ?? '',
    lead_source: customer?.lead_source ?? 'direct',
    notes:       customer?.notes       ?? '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = {
        full_name:   form.full_name,
        id_type:     form.id_type,
        id_number:   form.id_number,
        phone:       form.phone,
        lead_source: form.lead_source,
        email:       form.email     || null,
        birthdate:   form.birthdate || null,
        notes:       form.notes     || null,
      }
      if (customer) {
        await apiPatch(`/customers/${customer.id}`, payload)
      } else {
        await apiPost('/customers', payload)
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">{customer ? 'تعديل العميل' : 'عميل جديد'}</h2>
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">الاسم الكامل *</label>
            <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
          </div>
          <div>
            <label className="label">نوع الهوية *</label>
            <select className="input" value={form.id_type} onChange={e => set('id_type', e.target.value)} required>
              {Object.entries(ID_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">رقم الهوية *</label>
            <input className="input" value={form.id_number} onChange={e => set('id_number', e.target.value)} required />
          </div>
          <div>
            <label className="label">رقم الجوال *</label>
            <input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} required placeholder="05xxxxxxxx" />
          </div>
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="label">تاريخ الميلاد</label>
            <input className="input" type="date" value={form.birthdate} onChange={e => set('birthdate', e.target.value)} />
          </div>
          <div>
            <label className="label">مصدر العميل *</label>
            <select className="input" value={form.lead_source} onChange={e => set('lead_source', e.target.value)} required>
              {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">ملاحظات</label>
            <textarea className="input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
          <div className="col-span-2 flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost flex-1">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  )
}
