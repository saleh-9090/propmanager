// frontend/src/app/projects/_components/UnitsPanel.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiDelete, apiGet } from '@/lib/api'
import UnitFormModal from './UnitFormModal'
import CsvImportModal from './CsvImportModal'

type Unit = {
  id: string
  unit_number: string
  floor: number
  area_sqm: number
  price: number
  sak_id: string
  status: 'available' | 'reserved' | 'sold'
  electricity_meter_id: string | null
  water_meter_id: string | null
}

const STATUS_LABELS = { available: 'متاحة', reserved: 'محجوزة', sold: 'مباعة' }
const STATUS_COLORS = {
  available: 'bg-success/15 text-success',
  reserved:  'bg-warning/15 text-warning',
  sold:      'bg-danger/15 text-danger',
}

export default function UnitsPanel() {
  const params = useSearchParams()
  const buildingId = params.get('building')
  const projectId  = params.get('project')

  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [unitModal, setUnitModal] = useState<{ open: boolean; unit?: Unit }>({ open: false })
  const [csvModal, setCsvModal] = useState(false)

  const loadUnits = useCallback(async () => {
    if (!buildingId) return
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<Unit[]>(`/units?building_id=${buildingId}`)
      setUnits(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الوحدات')
    } finally {
      setLoading(false)
    }
  }, [buildingId])

  useEffect(() => { loadUnits() }, [loadUnits])

  async function handleDelete(unitId: string) {
    if (!confirm('هل أنت متأكد من حذف هذه الوحدة؟')) return
    try {
      await apiDelete(`/units/${unitId}`)
      setUnits(prev => prev.filter(u => u.id !== unitId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف الوحدة')
    }
  }

  if (!buildingId) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        اختر مبنى من القائمة لعرض وحداته
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-text-primary">الوحدات</h2>
        <div className="flex gap-2">
          {projectId && (
            <button onClick={() => setCsvModal(true)} className="btn-ghost text-sm">
              ↑ استيراد CSV
            </button>
          )}
          <button
            onClick={() => setUnitModal({ open: true })}
            className="btn-primary text-sm py-2 px-4"
          >
            + وحدة
          </button>
        </div>
      </div>

      {loading && <p className="text-text-secondary text-sm">جارٍ التحميل...</p>}
      {error && <p className="text-danger text-sm">{error}</p>}

      {!loading && !error && units.length === 0 && (
        <div className="text-center py-16 text-text-muted text-sm">
          لا توجد وحدات — أضف وحدة أو استورد ملف CSV
        </div>
      )}

      {!loading && units.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-right">
              <th className="pb-3 font-medium text-text-secondary">رقم الوحدة</th>
              <th className="pb-3 font-medium text-text-secondary">الطابق</th>
              <th className="pb-3 font-medium text-text-secondary">م²</th>
              <th className="pb-3 font-medium text-text-secondary">السعر (ر.س)</th>
              <th className="pb-3 font-medium text-text-secondary">رقم الصك</th>
              <th className="pb-3 font-medium text-text-secondary">الحالة</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {units.map(u => (
              <tr key={u.id}>
                <td className="py-3 font-medium">{u.unit_number}</td>
                <td className="py-3">{u.floor}</td>
                <td className="py-3">{u.area_sqm.toLocaleString('ar-SA')}</td>
                <td className="py-3">{u.price.toLocaleString('ar-SA')}</td>
                <td className="py-3 font-mono text-xs text-text-secondary">{u.sak_id}</td>
                <td className="py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status]}`}>
                    {STATUS_LABELS[u.status]}
                  </span>
                </td>
                <td className="py-3 text-left">
                  <button
                    onClick={() => setUnitModal({ open: true, unit: u })}
                    className="text-text-muted hover:text-text-secondary ml-2 text-xs"
                    title="تعديل"
                  >✎</button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="text-danger/70 hover:text-danger text-xs"
                    title="حذف"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {unitModal.open && buildingId && projectId && (
        <UnitFormModal
          buildingId={buildingId}
          projectId={projectId}
          unit={unitModal.unit}
          onClose={() => setUnitModal({ open: false })}
          onSaved={loadUnits}
        />
      )}

      {csvModal && projectId && (
        <CsvImportModal
          projectId={projectId}
          onClose={() => setCsvModal(false)}
          onSaved={loadUnits}
        />
      )}
    </div>
  )
}
