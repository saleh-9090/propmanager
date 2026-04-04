// frontend/src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import Link from 'next/link'
import SignOutButton from './_components/SignOutButton'

const NAV = [
  { href: '/dashboard',       label: 'الرئيسية' },
  { href: '/projects',        label: 'المشاريع' },
  { href: '/units',           label: 'الوحدات' },
  { href: '/customers',       label: 'العملاء' },
  { href: '/reservations',    label: 'الحجوزات' },
  { href: '/sales',           label: 'المبيعات' },
  { href: '/reports',         label: 'التقارير' },
  { href: '/settings/users',  label: 'الإعدادات' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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

  const companyName = (profile.companies as { name_ar: string } | null)?.name_ar ?? ''

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-l border-stone-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-stone-200">
          <p className="font-bold text-stone-900 text-sm truncate">{companyName}</p>
          <p className="text-stone-500 text-xs mt-1 truncate">{profile.full_name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 rounded-xl text-sm text-stone-700 hover:bg-stone-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-stone-200">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  )
}
