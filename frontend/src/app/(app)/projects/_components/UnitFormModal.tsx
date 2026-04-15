// frontend/src/app/projects/_components/UnitFormModal.tsx
'use client'

import { useState } from 'react'
import { apiPatch, apiPost } from '@/lib/api'

type Unit = {
  id: string
  unit_number: string
  floor: number
  area_sqm: number
  price: number
  sak_id: string
  electricity_meter_id: string | null
  water_meter_id: string | null
}

type Props = {
  buildingId: string
  projectId: string
  unit?: Unit
  onClose: () => void
  onSaved: () => void
}

export default function UnitFormModal({ buildingId, projectId, unit, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    unit_number: unit?.unit_number ?? '',
    floor: unit?.floor?.toString() ?? '',
    area_sqm: unit?.area_sqm?.toString() ?? '',
    price: unit?.price?.toString() ?? '',
    sak_id: unit?.sak_id ?? '',
    electricity_meter_id: unit?.electricity_meter_id ?? '',
    water_meter_id: unit?.water_meter_id ?? '',
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
        unit_number: form.unit_number,
        floor: parseInt(form.floor),
        area_sqm: parseFloat(form.area_sqm),
        price: parseFloat(form.price),
        sak_id: form.sak_id,
        electricity_meter_id: form.electricity_meter_id || null,
        water_meter_id: form.water_meter_id || null,
        ...(!unit && { building_id: buildingId, project_id: projectId }),
      }
      if (unit) {
        await apiPatch(`/units/${unit.id}`, payload)
      } else {
        await apiPost('/units', payload)
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
        <h2 className="text-lg font-semibold mb-4">{unit ? 'تعديل الوحدة' : 'وحدة جديدة'}</h2>
        {error && (
          <div className="mb-3 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">رقم الوحدة *</label>
            <input className="input" value={form.unit_number} onChange={e => set('unit_number', e.target.value)} required placeholder="A-101" />
          </div>
          <div>
            <label className="label">الطابق *</label>
            <input className="input" type="number" min="0" value={form.floor} onChange={e => set('floor', e.target.value)} required />
          </div>
          <div>
            <label className="label">المساحة م² *</label>
            <input className="input" type="number" step="0.01" min="0.01" value={form.area_sqm} onChange={e => set('area_sqm', e.target.value)} required />
          </div>
          <div>
            <label className="label">السعر ر.س *</label>
            <input className="input" type="number" step="0.01" min="0.01" value={form.price} onChange={e => set('price', e.target.value)} required />
          </div>
          <div className="col-span-2">
            <label className="label">رقم الصك (SAK) *</label>
            <input className="input" value={form.sak_id} onChange={e => set('sak_id', e.target.value)} required />
          </div>
          <div>
            <label className="label">عداد الكهرباء</label>
            <input className="input" value={form.electricity_meter_id} onChange={e => set('electricity_meter_id', e.target.value)} />
          </div>
          <div>
            <label className="label">عداد الماء</label>
            <input className="input" value={form.water_meter_id} onChange={e => set('water_meter_id', e.target.value)} />
          </div>
          <div className="col-span-2 flex gap-2 pt-2">
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
