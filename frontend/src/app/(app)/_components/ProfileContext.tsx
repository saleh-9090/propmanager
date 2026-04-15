'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type SessionProfile = {
  role: string
  fullName: string
  companyName: string
}

const Ctx = createContext<SessionProfile | null>(null)

export function ProfileProvider({
  value,
  children,
}: {
  value: SessionProfile
  children: ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useProfile(): SessionProfile {
  const v = useContext(Ctx)
  if (!v) throw new Error('useProfile must be used inside ProfileProvider')
  return v
}

export function useRole(): string {
  return useProfile().role
}
