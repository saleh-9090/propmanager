'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

export default function AppShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-bg-base">
      {/* Mobile top bar */}
      <div className="fixed top-0 right-0 left-0 h-14 bg-bg-surface border-b border-border flex items-center px-4 z-40 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -mr-2 text-text-secondary hover:text-text-primary"
          aria-label="القائمة"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <span className="mr-3 text-sm font-semibold text-text-primary">PropManager</span>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 right-0 h-full w-64 bg-bg-surface border-l border-border flex flex-col shrink-0 z-50
          transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
          md:translate-x-0 md:static md:z-auto
        `}
      >
        {/* Mobile close button */}
        <div className="md:hidden flex justify-start p-3">
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-text-muted hover:text-text-primary"
            aria-label="إغلاق"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l8 8M14 6l-8 8" />
            </svg>
          </button>
        </div>

        {/* Click nav links to close on mobile */}
        <div onClick={() => setOpen(false)} className="flex flex-col flex-1 min-h-0">
          {sidebar}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto min-w-0 mt-14 md:mt-0">
        {children}
      </main>
    </div>
  )
}
