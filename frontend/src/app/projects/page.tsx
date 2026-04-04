// frontend/src/app/projects/page.tsx
import { Suspense } from 'react'
import ProjectTree from './_components/ProjectTree'
import UnitsPanel from './_components/UnitsPanel'

export default function ProjectsPage() {
  return (
    <div className="flex h-full -m-8 overflow-hidden">
      <aside className="w-72 bg-white border-l border-stone-200 flex flex-col shrink-0 overflow-y-auto">
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
