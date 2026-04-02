import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseKey)

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserProfile() {
  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}
