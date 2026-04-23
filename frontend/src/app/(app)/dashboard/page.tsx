'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiGet } from '@/lib/api'

type Unit = {
  id: string
  unit_number: string
  status: 'available' | 'reserved' | 'sold'
  price: number
  area_sqm: number
}

type Reservation = {
  id: string
  status: 'active' | 'converted' | 'cancelled'
  deposit_amount: number
  expires_at: string
  customers: { full_name: string }
  units: { unit_number: string }
}

type Sale = {
  id: string
  payment_amount: number
  payment_date: string
  status: string
  customers: { full_name: string }
  units: { unit_number: string }
}

type Customer = {
  id: string
}

export default function DashboardPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [u, r, s, c] = await Promise.all([
          apiGet<Unit[]>('/units'),
          apiGet<Reservation[]>('/reservations'),
          apiGet<Sale[]>('/sales'),
          apiGet<Customer[]>('/customers'),
        ])
        setUnits(u)
        setReservations(r)
        setSales(s)
        setCustomers(c)
      } catch {
        // silent — cards show 0
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const available = units.filter(u => u.status === 'available').length
  const reserved = units.filter(u => u.status === 'reserved').length
  const sold = units.filter(u => u.status === 'sold').length
  const activeRes = reservations.filter(r => r.status === 'active')
  const totalRevenue = sales.reduce((sum, s) => sum + s.payment_amount, 0)

  const expiringSoon = activeRes.filter(r => {
    const diff = (new Date(r.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff <= 7 && diff > 0
  })

  const recentSales = [...sales]
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
    .slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary text-sm">جارٍ التحميل...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary mb-6">لوحة التحكم</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="الوحدات المتاحة"
          value={available}
          sub={`من ${units.length}`}
          color="text-success"
          href="/units"
        />
        <StatCard
          label="حجوزات نشطة"
          value={activeRes.length}
          sub={expiringSoon.length > 0 ? `${expiringSoon.length} تنتهي قريباً` : undefined}
          color="text-warning"
          href="/reservations"
        />
        <StatCard
          label="مبيعات مكتملة"
          value={sales.length}
          color="text-primary"
          href="/sales"
        />
        <StatCard
          label="إجمالي الإيرادات"
          value={totalRevenue.toLocaleString('ar-SA')}
          sub="ر.س"
          color="text-secondary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unit Status Breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold text-text-primary mb-4">توزيع الوحدات</h2>
          <div className="space-y-3">
            <BarRow label="متاحة" count={available} total={units.length} color="bg-success" />
            <BarRow label="محجوزة" count={reserved} total={units.length} color="bg-warning" />
            <BarRow label="مباعة" count={sold} total={units.length} color="bg-danger" />
          </div>
          <div className="mt-4 pt-3 border-t border-border text-xs text-text-muted">
            {units.length} وحدة · {customers.length} عميل
          </div>
        </div>

        {/* Recent Sales */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-primary">آخر المبيعات</h2>
            <Link href="/sales" className="text-xs text-primary hover:underline">عرض الكل</Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-8">لا توجد مبيعات بعد</p>
          ) : (
            <div className="space-y-3">
              {recentSales.map(s => (
                <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center justify-between py-2 hover:bg-bg-elevated rounded-lg px-2 -mx-2 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{s.customers?.full_name}</p>
                    <p className="text-xs text-text-muted">وحدة {s.units?.unit_number}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-text-primary">{s.payment_amount.toLocaleString('ar-SA')} ر.س</p>
                    <p className="text-xs text-text-muted">{new Date(s.payment_date).toLocaleDateString('ar-SA')}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Reservations */}
        {expiringSoon.length > 0 && (
          <div className="card p-5 lg:col-span-2 border-warning/30">
            <h2 className="font-semibold text-warning mb-4">حجوزات تنتهي خلال 7 أيام</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {expiringSoon.map(r => {
                const daysLeft = Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                return (
                  <div key={r.id} className="p-3 bg-warning/5 rounded-xl border border-warning/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{r.customers?.full_name}</span>
                      <span className="text-xs font-bold text-warning">{daysLeft} يوم</span>
                    </div>
                    <p className="text-xs text-text-muted">وحدة {r.units?.unit_number} · {r.deposit_amount.toLocaleString('ar-SA')} ر.س</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, href }: {
  label: string
  value: string | number
  sub?: string
  color: string
  href?: string
}) {
  const content = (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <p className="text-xs text-text-secondary mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

function BarRow({ label, count, total, color }: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-bg-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium text-text-primary w-8 text-left">{count}</span>
    </div>
  )
}
