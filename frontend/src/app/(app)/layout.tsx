import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import NavLinks from './_components/NavLinks'
import SignOutButton from './_components/SignOutButton'
import { ProfileProvider } from './_components/ProfileContext'

const ROLE_LABEL_AR: Record<string, string> = {
  owner:               'المالك',
  cfo:                 'المدير المالي',
  sales_manager:       'مدير المبيعات',
  reservation_manager: 'مدير الحجوزات',
  accountant:          'المحاسب',
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, role, companies(name_ar)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const companyName = (profile.companies as unknown as { name_ar: string } | null)?.name_ar ?? ''
  const roleLabel = ROLE_LABEL_AR[profile.role] ?? profile.role

  return (
    <div className="flex min-h-screen bg-bg-base">
      <aside className="w-64 bg-bg-surface border-l border-border flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
            >
              P
            </div>
            <div className="min-w-0">
              <p className="text-text-primary text-sm font-semibold truncate">PropManager</p>
              <p className="text-text-muted text-[10px] truncate">إدارة المبيعات العقارية</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-border">
          <p className="text-text-primary text-sm font-medium truncate">{companyName}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="badge badge-primary">{roleLabel}</span>
          </div>
        </div>

        <NavLinks />

        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-1">
            <p className="text-text-secondary text-xs truncate">{profile.full_name}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto min-w-0">
        <ProfileProvider
          value={{
            role: profile.role,
            fullName: profile.full_name,
            companyName,
          }}
        >
          {children}
        </ProfileProvider>
      </main>
    </div>
  )
}
