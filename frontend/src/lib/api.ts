import { supabase } from './supabase'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function apiDelete(path: string): Promise<void> {
  const token = await getToken()
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await res.text())
}
