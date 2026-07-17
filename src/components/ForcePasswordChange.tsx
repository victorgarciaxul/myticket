'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { KeyRound, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import type { Profile } from '@/types'

/**
 * Pantalla bloqueante: se muestra cuando el usuario tiene la contraseña
 * provisional compartida y aún no la ha cambiado (must_change_password = true).
 */
export function ForcePasswordChange({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const supabase = createClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (newPassword !== confirm) { setError('Las contraseñas no coinciden.'); return }
    if (newPassword === 'Xul2024$' || newPassword === 'Xul14$') {
      setError('No puedes reutilizar la contraseña provisional. Elige una nueva.'); return
    }
    setLoading(true)
    const { error: upErr } = await supabase.auth.updateUser({ password: newPassword })
    if (upErr) { setError(upErr.message); setLoading(false); return }
    const { error: profErr } = await supabase.from('profiles')
      .update({ must_change_password: false } as any)
      .eq('id', profile.id)
    if (profErr) { setError(profErr.message); setLoading(false); return }
    setLoading(false)
    onDone()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Crea tu contraseña</h1>
        <p className="text-sm text-gray-500 mb-6">
          Por seguridad, debes sustituir la contraseña provisional por una personal antes de continuar.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nueva contraseña</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} value={newPassword}
                onChange={e => setNewPassword(e.target.value)} required autoFocus
                className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Mínimo 8 caracteres</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirmar contraseña</label>
            <input type={show ? 'text' : 'password'} value={confirm}
              onChange={e => setConfirm(e.target.value)} required
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <Button type="submit" loading={loading} disabled={!newPassword || !confirm} className="w-full justify-center">
            <KeyRound className="h-4 w-4" /> Guardar y continuar
          </Button>
        </form>
      </div>
    </div>
  )
}
