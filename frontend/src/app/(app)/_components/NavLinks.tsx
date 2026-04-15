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
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
      {NAV.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? 'nav-item nav-item-active font-medium' : 'nav-item'}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
