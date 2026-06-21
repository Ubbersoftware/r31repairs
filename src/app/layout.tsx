import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeScript } from '@/components/layout/ThemeScript'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: '31Repairs — iPhone repair, booked & tracked',
  description: 'Book iPhone repairs in Gaborone and track them live.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  )
}
