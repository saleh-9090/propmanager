import type { Metadata } from 'next'
import { Tajawal } from 'next/font/google'
import './globals.css'

const tajawal = Tajawal({
  subsets:  ['arabic', 'latin'],
  weight:   ['300', '400', '500', '700', '800'],
  display:  'swap',
  variable: '--font-tajawal',
})

export const metadata: Metadata = {
  title:       'PropManager — نظام إدارة المبيعات العقارية',
  description: 'منصة إدارة مشاريع التطوير العقاري والمبيعات للشركات السعودية',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="font-arabic min-h-screen">
        {children}
      </body>
    </html>
  )
}
