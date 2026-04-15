// frontend/src/app/projects/_components/ProjectFormModal.tsx
'use client'

import { useState } from 'react'
import { apiPatch, apiPost } from '@/lib/api'

type Project = {
  id: string
  name: string
  name_ar: string | null
  project_number: string
  city: string | null
  location_notes: string | null
}

type Props = {
  project?: Project
  onClose: () => void
  onSaved: () => void
}

export default function ProjectFormModal({ project, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name_ar: project?.name_ar ?? '',
    name: project?.name ?? '',
    project_number: project?.project_number ?? '',
    city: project?.city ?? '',
    location_notes: project?.location_notes ?? '',
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
        name_ar: form.name_ar || null,
        name: form.name,
        project_number: form.project_number,
        city: form.city || null,
        location_notes: form.location_notes || null,
      }
      if (project) {
        await apiPatch(`/projects/${project.id}`, payload)
      } else {
        await apiPost('/projects', payload)
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
      <div className="card w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">{project ? 'تعديل المشروع' : 'مشروع جديد'}</h2>
        {error && (
          <div className="mb-3 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">اسم المشروع (بالعربي) *</label>
            <input className="input" value={form.name_ar} onChange={e => set('name_ar', e.target.value)} required placeholder="مشروع النرجس" />
          </div>
          <div>
            <label className="label">اسم المشروع (بالإنجليزي) *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Al Narjis" />
          </div>
          <div>
            <label className="label">رقم المشروع *</label>
            <input className="input" value={form.project_number} onChange={e => set('project_number', e.target.value)} required placeholder="P001" />
          </div>
          <div>
            <label className="label">المدينة</label>
            <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="الرياض" />
          </div>
          <div>
            <label className="label">ملاحظات الموقع</label>
            <input className="input" value={form.location_notes} onChange={e => set('location_notes', e.target.value)} />
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
