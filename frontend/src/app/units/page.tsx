// frontend/src/app/units/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'

type Unit = {
  id: string
  unit_number: string
  floor: number
  area_sqm: number
  price: number
  sak_id: string
  status: 'available' | 'reserved' | 'sold'
  building_id: string
  project_id: string
}

type Building = {
  id: string
  building_number: string
  name: string | null
}

type Project = {
  id: string
  name: string
  name_ar: string | null
  buildings: Building[]
}

const STATUS_LABELS: Record<string, string> = {
  available: 'متاحة',
  reserved:  'محجوزة',
  sold:      'مباعة',
}
const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  reserved:  'bg-yellow-100 text-yellow-700',
  sold:      'bg-red-100 text-red-700',
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [checkedStatuses, setCheckedStatuses] = useState<Set<string>>(
    new Set(['available', 'reserved', 'sold'])
  )

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [unitsData, projectsData] = await Promise.all([
          apiGet<Unit[]>('/units'),
          apiGet<Project[]>('/projects'),
        ])
        setUnits(unitsData)
        setProjects(projectsData)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'تعذر تحميل البيانات')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const availableBuildings = selectedProject?.buildings ?? []

  const filtered = units.filter(u => {
    if (selectedProjectId && u.project_id !== selectedProjectId) return false
    if (selectedBuildingId && u.building_id !== selectedBuildingId) return false
    if (!checkedStatuses.has(u.status)) return false
    return true
  })

  const counts = {
    available: filtered.filter(u => u.status === 'available').length,
    reserved:  filtered.filter(u => u.status === 'reserved').length,
    sold:      filtered.filter(u => u.status === 'sold').length,
  }

  function toggleStatus(s: string) {
    setCheckedStatuses(prev => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-stone-900 mb-6">لوحة الوحدات</h1>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          className="input w-48"
          value={selectedProjectId}
          onChange={e => {
            setSelectedProjectId(e.target.value)
            setSelectedBuildingId('')
          }}
        >
          <option value="">كل المشاريع</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name_ar ?? p.name}</option>
          ))}
        </select>

        <select
          className="input w-48"
          value={selectedBuildingId}
          onChange={e => setSelectedBuildingId(e.target.value)}
          disabled={!selectedProjectId}
        >
          <option value="">كل المباني</option>
          {availableBuildings.map(b => (
            <option key={b.id} value={b.id}>{b.name ?? b.building_number}</option>
          ))}
        </select>

        <div className="flex gap-4">
          {(['available', 'reserved', 'sold'] as const).map(s => (
            <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={checkedStatuses.has(s)}
                onChange={() => toggleStatus(s)}
              />
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
                {STATUS_LABELS[s]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Summary row */}
      {!loading && !error && (
        <p className="text-sm text-stone-500 mb-4">
          {counts.available} متاحة · {counts.reserved} محجوزة · {counts.sold} مباعة
        </p>
      )}

      {loading && <p className="text-stone-500 text-sm">جارٍ التحميل...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="text-stone-400 text-sm text-center py-16">
          لا توجد وحدات تطابق الفلتر المحدد
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(u => (
            <div key={u.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="font-bold text-stone-900">{u.unit_number}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status]}`}>
                  {STATUS_LABELS[u.status]}
                </span>
              </div>
              <div className="text-sm text-stone-600 space-y-0.5">
                <div>ط {u.floor}</div>
                <div>{u.area_sqm.toLocaleString('ar-SA')} م²</div>
                <div>{u.price.toLocaleString('ar-SA')} ر.س</div>
              </div>
              <div className="mt-2 font-mono text-xs text-stone-400 truncate">{u.sak_id}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
