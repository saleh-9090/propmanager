'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase'

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <button onClick={handleSignOut} className="btn-ghost w-full justify-start">
      تسجيل الخروج
    </button>
  )
}
