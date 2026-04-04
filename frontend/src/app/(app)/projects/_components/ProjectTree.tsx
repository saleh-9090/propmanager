// frontend/src/app/projects/_components/ProjectTree.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiDelete, apiGet } from '@/lib/api'
import ProjectFormModal from './ProjectFormModal'
import BuildingFormModal from './BuildingFormModal'

type Building = {
  id: string
  building_number: string
  name: string | null
  total_floors: number | null
}

type Project = {
  id: string
  name: string
  name_ar: string | null
  project_number: string
  city: string | null
  buildings: Building[]
}

export default function ProjectTree() {
  const router = useRouter()
  const params = useSearchParams()
  const selectedBuilding = params.get('building')

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [projectModal, setProjectModal] = useState<{ open: boolean; project?: Project }>({ open: false })
  const [buildingModal, setBuildingModal] = useState<{ open: boolean; projectId?: string; building?: Building }>({ open: false })

  const loadProjects = useCallback(async () => {
    try {
      const data = await apiGet<Project[]>('/projects')
      setProjects(data)
      setExpanded(new Set(data.map(p => p.id)))
    } catch {
      // silently fail — tree just stays empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadProjects() }, [loadProjects])

  function selectBuilding(buildingId: string, projectId: string) {
    router.replace(`/projects?building=${buildingId}&project=${projectId}`)
  }

  async function handleDeleteProject(projectId: string) {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟ سيتم حذف جميع المباني والوحدات.')) return
    try {
      await apiDelete(`/projects/${projectId}`)
      router.replace('/projects')
      await loadProjects()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف المشروع')
    }
  }

  async function handleDeleteBuilding(buildingId: string) {
    if (!confirm('هل أنت متأكد من حذف هذا المبنى؟ سيتم حذف جميع الوحدات.')) return
    try {
      await apiDelete(`/buildings/${buildingId}`)
      if (selectedBuilding === buildingId) router.replace('/projects')
      await loadProjects()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف المبنى')
    }
  }

  if (loading) return <div className="p-4 text-sm text-stone-500">جارٍ التحميل...</div>

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-stone-900">المشاريع</h2>
        <button
          onClick={() => setProjectModal({ open: true })}
          className="text-xs text-primary-600 hover:underline"
        >
          + مشروع
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {projects.length === 0 && (
          <p className="text-sm text-stone-400 p-2 text-center mt-8">
            لا توجد مشاريع
          </p>
        )}
        {projects.map(project => (
          <div key={project.id}>
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-stone-50 group">
              <button
                onClick={() => setExpanded(e => {
                  const next = new Set(e)
                  next.has(project.id) ? next.delete(project.id) : next.add(project.id)
                  return next
                })}
                className="text-stone-400 w-4 text-xs shrink-0"
              >
                {expanded.has(project.id) ? '▼' : '▶'}
              </button>
              <span className="flex-1 text-sm font-medium text-stone-800 truncate">
                {project.name_ar || project.name}
              </span>
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  onClick={() => setBuildingModal({ open: true, projectId: project.id })}
                  className="text-xs text-primary-600 px-1"
                  title="إضافة مبنى"
                >+ مبنى</button>
                <button
                  onClick={() => setProjectModal({ open: true, project })}
                  className="text-xs text-stone-400 hover:text-stone-700 px-1"
                >✎</button>
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-1"
                >×</button>
              </div>
            </div>

            {expanded.has(project.id) && (
              <div className="mr-5 space-y-0.5">
                {project.buildings.length === 0 && (
                  <p className="text-xs text-stone-400 px-4 py-1">لا توجد مبانٍ</p>
                )}
                {project.buildings.map(b => (
                  <div
                    key={b.id}
                    onClick={() => selectBuilding(b.id, project.id)}
                    className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group ${
                      selectedBuilding === b.id
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-stone-50 text-stone-600'
                    }`}
                  >
                    <span className="w-4 text-center text-stone-300 text-xs shrink-0">■</span>
                    <span className="flex-1 text-sm truncate">
                      {b.name || `مبنى ${b.building_number}`}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); setBuildingModal({ open: true, projectId: project.id, building: b }) }}
                        className="text-xs text-stone-400 hover:text-stone-700 px-1"
                      >✎</button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteBuilding(b.id) }}
                        className="text-xs text-red-400 hover:text-red-600 px-1"
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {projectModal.open && (
        <ProjectFormModal
          project={projectModal.project}
          onClose={() => setProjectModal({ open: false })}
          onSaved={loadProjects}
        />
      )}
      {buildingModal.open && buildingModal.projectId && (
        <BuildingFormModal
          projectId={buildingModal.projectId}
          building={buildingModal.building}
          onClose={() => setBuildingModal({ open: false })}
          onSaved={loadProjects}
        />
      )}
    </div>
  )
}
