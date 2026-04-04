// frontend/src/app/projects/_components/BuildingFormModal.tsx
'use client'

import { useState } from 'react'
import { apiPatch, apiPost } from '@/lib/api'

type Building = {
  id: string
  building_number: string
  name: string | null
  total_floors: number | null
}

type Props = {
  projectId: string
  building?: Building
  onClose: () => void
  onSaved: () => void
}

export default function BuildingFormModal({ projectId, building, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    building_number: building?.building_number ?? '',
    name: building?.name ?? '',
    total_floors: building?.total_floors?.toString() ?? '',
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
        building_number: form.building_number,
        name: form.name || null,
        total_floors: form.total_floors ? parseInt(form.total_floors) : null,
        ...(!building && { project_id: projectId }),
      }
      if (building) {
        await apiPatch(`/buildings/${building.id}`, payload)
      } else {
        await apiPost('/buildings', payload)
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
      <div className="card w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-4">{building ? 'تعديل المبنى' : 'مبنى جديد'}</h2>
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">رقم المبنى *</label>
            <input className="input" value={form.building_number} onChange={e => set('building_number', e.target.value)} required placeholder="A" />
          </div>
          <div>
            <label className="label">اسم المبنى (اختياري)</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="برج الشمال" />
          </div>
          <div>
            <label className="label">عدد الطوابق (اختياري)</label>
            <input className="input" type="number" min="1" value={form.total_floors} onChange={e => set('total_floors', e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
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
