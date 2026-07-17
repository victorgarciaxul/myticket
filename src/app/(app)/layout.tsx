'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Sidebar } from '@/components/layout/Sidebar'
import { ForcePasswordChange } from '@/components/ForcePasswordChange'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const [changed, setChanged] = useState(false)

  useEffect(() => { setChanged(false) }, [profile?.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!profile) return null

  // Contraseña provisional pendiente de cambio: pantalla bloqueante
  if (profile.must_change_password && !changed) {
    return <ForcePasswordChange profile={profile} onDone={() => setChanged(true)} />
  }

  return (
    <div className="flex h-full min-h-screen">
      <Sidebar profile={profile} />
      <main className="flex-1 overflow-auto bg-[#F7F8FA]">{children}</main>
    </div>
  )
}
