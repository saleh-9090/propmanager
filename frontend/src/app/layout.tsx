import type { Metadata } from 'next'
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const ibmArabic = IBM_Plex_Sans_Arabic({
  subsets:  ['arabic', 'latin'],
  weight:   ['300', '400', '500', '600', '700'],
  display:  'swap',
  variable: '--font-ibm-arabic',
})

const ibmMono = IBM_Plex_Mono({
  subsets:  ['latin'],
  weight:   ['400', '500'],
  display:  'swap',
  variable: '--font-ibm-mono',
})

export const metadata: Metadata = {
  title:       'PropManager — نظام إدارة المبيعات العقارية',
  description: 'منصة إدارة مشاريع التطوير العقاري والمبيعات للشركات السعودية',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${ibmArabic.variable} ${ibmMono.variable}`}>
      <body className="font-arabic min-h-screen bg-bg-base text-text-primary">
        {children}
      </body>
    </html>
  )
}
