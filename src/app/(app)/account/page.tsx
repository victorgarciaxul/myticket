'use client'
import { useAuth } from '@/components/AuthProvider'
import { User } from 'lucide-react'

export default function AccountPage() {
  const { profile } = useAuth()

  if (!profile) return null

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mi cuenta</h1>
      <p className="text-sm text-gray-400 mb-8">Gestiona tu información</p>

      {/* ── Perfil ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" /> Información personal
        </h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
            {profile.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{profile.full_name}</p>
            <p className="text-sm text-gray-400">{profile.email}</p>
            <span className="inline-block mt-1 text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              {profile.role === 'admin' ? 'Administrador' : 'Usuario'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Nombre</p>
            <p className="text-sm font-semibold text-gray-800">{profile.full_name}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Email</p>
            <p className="text-sm font-semibold text-gray-800">{profile.email}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
