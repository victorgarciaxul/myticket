'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { Button } from '@/components/ui/Button'
import {
  KeyRound, Eye, EyeOff, CheckCircle, AlertCircle, User,
  ShieldCheck, ShieldOff, Smartphone, Loader2, X,
} from 'lucide-react'
import QRCode from 'qrcode'

export default function AccountPage() {
  const { profile } = useAuth()
  const supabase = createClient()

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdError, setPwdError] = useState<string | null>(null)

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null)

  const loadMfaStatus = useCallback(async () => {
    setMfaLoading(true)
    const { data } = await supabase.auth.mfa.listFactors()
    const verified = data?.totp?.find(f => f.status === 'verified')
    if (verified) {
      setMfaEnabled(true)
      setMfaFactorId(verified.id)
    } else {
      setMfaEnabled(false)
      setMfaFactorId(null)
    }
    setMfaLoading(false)
  }, [supabase])

  useEffect(() => { loadMfaStatus() }, [loadMfaStatus])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    setPwdSuccess(false)
    if (newPassword.length < 8) { setPwdError('La nueva contraseña debe tener al menos 8 caracteres.'); return }
    if (newPassword !== confirmPassword) { setPwdError('Las contraseñas nuevas no coinciden.'); return }
    setPwdLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) { setPwdError('No se pudo obtener el usuario.'); setPwdLoading(false); return }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (signInError) { setPwdError('La contraseña actual no es correcta.'); setPwdLoading(false); return }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) { setPwdError(updateError.message); setPwdLoading(false); return }
    // Limpiar el flag de contraseña provisional si estuviera activo
    await supabase.from('profiles').update({ must_change_password: false } as any).eq('id', user.id)
    setPwdSuccess(true)
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    setPwdLoading(false)
  }

  async function startEnroll() {
    setEnrolling(true)
    setVerifyError(null)
    setMfaSuccess(null)
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'MyTicket' })
    if (error || !data) { setVerifyError(error?.message ?? 'Error al iniciar la configuración'); setEnrolling(false); return }
    setEnrollFactorId(data.id)
    setTotpSecret(data.totp.secret)
    const dataUrl = await QRCode.toDataURL(data.totp.uri, { width: 200, margin: 1 })
    setQrDataUrl(dataUrl)
    setEnrolling(false)
  }

  function cancelEnroll() {
    setQrDataUrl(null)
    setTotpSecret(null)
    setEnrollFactorId(null)
    setVerifyCode('')
    setVerifyError(null)
  }

  async function verifyEnroll() {
    if (!enrollFactorId || verifyCode.length !== 6) return
    setVerifying(true)
    setVerifyError(null)
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollFactorId })
    if (chErr || !challenge) { setVerifyError(chErr?.message ?? 'Error al crear el desafío'); setVerifying(false); return }
    const { error: verErr } = await supabase.auth.mfa.verify({ factorId: enrollFactorId, challengeId: challenge.id, code: verifyCode })
    if (verErr) { setVerifyError('Código incorrecto. Comprueba la hora de tu dispositivo e inténtalo de nuevo.'); setVerifying(false); return }
    setMfaSuccess('Verificación en dos pasos activada correctamente.')
    cancelEnroll()
    await loadMfaStatus()
    setVerifying(false)
  }

  async function disableMfa() {
    if (!mfaFactorId) return
    if (!confirm('¿Desactivar la verificación en dos pasos? Tu cuenta será menos segura.')) return
    setDisabling(true)
    setMfaSuccess(null)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    if (error) { setVerifyError(error.message); setDisabling(false); return }
    setMfaSuccess('Verificación en dos pasos desactivada.')
    await loadMfaStatus()
    setDisabling(false)
  }

  if (!profile) return null

  return (
    <div className="px-8 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Mi cuenta</h1>
      <p className="text-sm text-gray-400 mb-8">Gestiona tu información y seguridad</p>

      {/* ── Perfil ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
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

      {/* ── Verificación en dos pasos ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-gray-400" /> Verificación en dos pasos (2FA)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Protege tu cuenta con una app de autenticación (Google Authenticator, Authy…)
            </p>
          </div>
          {!mfaLoading && (
            <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
              mfaEnabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'
            }`}>
              {mfaEnabled
                ? <><ShieldCheck className="h-3.5 w-3.5" /> Activa</>
                : <><ShieldOff className="h-3.5 w-3.5" /> Inactiva</>}
            </span>
          )}
        </div>

        {mfaSuccess && (
          <div className="mt-4 flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> {mfaSuccess}
          </div>
        )}

        {mfaLoading ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Comprobando estado…
          </div>
        ) : mfaEnabled ? (
          /* ── Desactivar ── */
          <div className="mt-5">
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-100 rounded-xl mb-4">
              <ShieldCheck className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">2FA activado</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Al iniciar sesión se te pedirá el código de tu app de autenticación.
                </p>
              </div>
            </div>
            <button
              onClick={disableMfa}
              disabled={disabling}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              {disabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Desactivar verificación en dos pasos
            </button>
          </div>
        ) : qrDataUrl ? (
          /* ── Flujo de activación ── */
          <div className="mt-5 space-y-5">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0">
                <p className="text-xs font-semibold text-gray-600 mb-2">1. Escanea este código QR</p>
                <div className="border border-gray-200 rounded-xl p-2 inline-block bg-white shadow-sm">
                  <img src={qrDataUrl} alt="QR 2FA" className="w-40 h-40" />
                </div>
              </div>
              <div className="flex-1 pt-1">
                <p className="text-xs font-semibold text-gray-600 mb-2">¿No puedes escanear? Introduce el código manualmente</p>
                {totpSecret && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Clave secreta</p>
                    <p className="font-mono text-sm text-gray-800 tracking-widest break-all">{totpSecret}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400 leading-relaxed">
                  Abre tu app de autenticación (Google Authenticator, Authy, 1Password…),
                  pulsa <strong className="text-gray-600">Añadir cuenta</strong> y escanea el QR.
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">2. Introduce el código de 6 dígitos que muestra la app</p>
              <div className="flex gap-3 items-start">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, '')); setVerifyError(null) }}
                  placeholder="000000"
                  className="w-36 px-4 py-2.5 border border-gray-200 rounded-xl text-center text-lg font-mono tracking-widest text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <Button onClick={verifyEnroll} loading={verifying} disabled={verifyCode.length !== 6}>
                    <CheckCircle className="h-4 w-4" /> Activar 2FA
                  </Button>
                  <button onClick={cancelEnroll}
                    className="px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {verifyError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {verifyError}
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ── Activar ── */
          <div className="mt-5">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl mb-4">
              <ShieldOff className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                La verificación en dos pasos no está activada. Te recomendamos activarla para mayor seguridad.
              </p>
            </div>
            <Button onClick={startEnroll} loading={enrolling} variant="secondary">
              <Smartphone className="h-4 w-4" /> Activar verificación en dos pasos
            </Button>
          </div>
        )}
      </div>

      {/* ── Cambiar contraseña ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-gray-400" /> Cambiar contraseña
        </h2>
        <p className="text-xs text-gray-400 mb-5">Elige una contraseña segura de al menos 8 caracteres</p>

        {pwdSuccess && (
          <div className="mb-5 flex items-center gap-2.5 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" /> Contraseña actualizada correctamente.
          </div>
        )}
        {pwdError && (
          <div className="mb-5 flex items-center gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {pwdError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <PasswordField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword}
            show={showCurrent} onToggle={() => setShowCurrent(v => !v)} autoComplete="current-password" />
          <PasswordField label="Nueva contraseña" value={newPassword} onChange={setNewPassword}
            show={showNew} onToggle={() => setShowNew(v => !v)} autoComplete="new-password" hint="Mínimo 8 caracteres" />
          <PasswordField label="Confirmar nueva contraseña" value={confirmPassword} onChange={setConfirmPassword}
            show={showConfirm} onToggle={() => setShowConfirm(v => !v)} autoComplete="new-password" />
          <div className="pt-2">
            <Button type="submit" loading={pwdLoading} disabled={!currentPassword || !newPassword || !confirmPassword}>
              <KeyRound className="h-4 w-4" /> Actualizar contraseña
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PasswordField({ label, value, onChange, show, onToggle, autoComplete, hint }: {
  label: string; value: string; onChange: (v: string) => void
  show: boolean; onToggle: () => void; autoComplete?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete} required
          className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}
