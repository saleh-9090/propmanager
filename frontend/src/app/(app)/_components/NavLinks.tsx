'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard',      label: 'الرئيسية' },
  { href: '/projects',       label: 'المشاريع' },
  { href: '/units',          label: 'الوحدات' },
  { href: '/customers',      label: 'العملاء' },
  { href: '/reservations',   label: 'الحجوزات' },
  { href: '/sales',          label: 'المبيعات' },
  { href: '/reports',        label: 'التقارير' },
  { href: '/settings/users', label: 'الإعدادات' },
]

export default function NavLinks() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 p-4 space-y-1">
      {NAV.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2.5 rounded-xl text-sm transition-colors ${
              active
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
