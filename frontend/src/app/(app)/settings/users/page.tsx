// frontend/src/app/settings/users/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api'

type UserProfile = {
  id: string
  full_name: string
  role: string
  phone: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner:                'مالك',
  cfo:                  'مدير مالي',
  sales_manager:        'مدير مبيعات',
  reservation_manager:  'مدير حجوزات',
  accountant:           'محاسب',
}

const ROLES = Object.keys(ROLE_LABELS)

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [inviteForm, setInviteForm] = useState({
    email: '', full_name: '', role: 'sales_manager', phone: '',
  })
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiGet<UserProfile[]>('/users')
      setUsers(data)
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'تعذر تحميل المستخدمين')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    setInviteSuccess('')
    setInviting(true)
    try {
      await apiPost('/users/invite', {
        email: inviteForm.email,
        full_name: inviteForm.full_name,
        role: inviteForm.role,
        phone: inviteForm.phone || null,
      })
      setInviteSuccess(`تم إرسال الدعوة إلى ${inviteForm.email}`)
      setInviteForm({ email: '', full_name: '', role: 'sales_manager', phone: '' })
      await loadUsers()
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'تعذر إرسال الدعوة')
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    try {
      await apiPatch(`/users/${userId}/role`, { role })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر تغيير الدور')
    }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return
    try {
      await apiDelete(`/users/${userId}`)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'تعذر حذف المستخدم')
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-text-primary mb-8">إدارة المستخدمين</h1>

      {/* Invite form */}
      <div className="card mb-8">
        <h2 className="text-lg font-semibold mb-4">دعوة مستخدم جديد</h2>
        {inviteError && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">{inviteError}</div>
        )}
        {inviteSuccess && (
          <div className="mb-4 p-3 bg-success/10 border border-success/30 rounded-xl text-success text-sm">{inviteSuccess}</div>
        )}
        <form onSubmit={handleInvite} className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">البريد الإلكتروني *</label>
            <input
              className="input"
              type="email"
              value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">الاسم الكامل *</label>
            <input
              className="input"
              value={inviteForm.full_name}
              onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">الدور</label>
            <select
              className="input"
              value={inviteForm.role}
              onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
            >
              {ROLES.filter(r => r !== 'owner').map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">رقم الجوال</label>
            <input
              className="input"
              type="tel"
              value={inviteForm.phone}
              onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="05xxxxxxxx"
            />
          </div>
          <div className="col-span-2">
            <button type="submit" className="btn-primary" disabled={inviting}>
              {inviting ? 'جارٍ الإرسال...' : 'إرسال الدعوة'}
            </button>
          </div>
        </form>
      </div>

      {/* Users table */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">المستخدمون</h2>
        {loading ? (
          <p className="text-text-secondary text-sm">جارٍ التحميل...</p>
        ) : listError ? (
          <p className="text-danger text-sm">{listError}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-right pb-3 font-medium text-text-secondary">الاسم</th>
                <th className="text-right pb-3 font-medium text-text-secondary">الدور</th>
                <th className="text-right pb-3 font-medium text-text-secondary">الجوال</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id}>
                  <td className="py-3">{u.full_name}</td>
                  <td className="py-3">
                    <select
                      className="text-sm border border-border rounded-lg px-2 py-1 bg-bg-surface"
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                    >
                      {ROLES.filter(r => r !== 'owner').map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 text-text-secondary">{u.phone ?? '—'}</td>
                  <td className="py-3 text-left">
                    <button
                      onClick={() => handleDelete(u.id, u.full_name)}
                      className="text-danger hover:text-danger text-sm"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
