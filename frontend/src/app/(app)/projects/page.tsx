// frontend/src/app/projects/page.tsx
import { Suspense } from 'react'
import ProjectTree from './_components/ProjectTree'
import UnitsPanel from './_components/UnitsPanel'

export default function ProjectsPage() {
  return (
    <div className="flex flex-col md:flex-row h-full -m-4 md:-m-8 overflow-hidden">
      <aside className="w-full md:w-72 bg-bg-surface border-b md:border-b-0 md:border-l border-border flex flex-col shrink-0 overflow-y-auto max-h-64 md:max-h-none">
        <Suspense>
          <ProjectTree />
        </Suspense>
      </aside>
      <main className="flex-1 overflow-auto">
        <Suspense>
          <UnitsPanel />
        </Suspense>
      </main>
    </div>
  )
}
