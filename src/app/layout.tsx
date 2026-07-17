import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MyTicket — Gestión de gastos de viaje',
  description: 'Registra, categoriza y valida gastos de viaje con seguimiento de emisiones CO₂',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} bg-gray-50 text-gray-900 h-full`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
