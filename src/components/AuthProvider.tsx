'use client'
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { Profile } from '@/types'
import { redirectToAppCenterLogin, APPCENTER_URL } from '@/lib/appcenter'

interface AuthContextType {
  profile: Profile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ profile: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search)
      const ssoToken = params.get('sso_token')

      // 1) Llegamos con token de un solo uso desde AppCenter → canjear sesión
      if (ssoToken) {
        try {
          const res = await fetch('/api/sso-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sso_token: ssoToken }),
          })
          if (res.ok) {
            const { access_token, refresh_token } = await res.json()
            await supabase.auth.setSession({ access_token, refresh_token })
            sessionStorage.removeItem('sso_redirect_count')
            window.history.replaceState({}, '', window.location.pathname)
          } else {
            const body = await res.json().catch(() => ({}))
            setError(body.error ?? 'No se pudo verificar la sesión de AppCenter.')
            setLoading(false)
            return
          }
        } catch {
          setError('Error de red al verificar la sesión con AppCenter.')
          setLoading(false)
          return
        }
      }

      // 2) ¿Hay sesión válida (propia o recién canjeada)?
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        sessionStorage.removeItem('sso_redirect_count')
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        setProfile(data)
        setLoading(false)
        if (data?.role === 'admin' && pathname === '/dashboard') router.replace('/admin')
        return
      }

      // 3) Sin sesión: redirigir a AppCenter, PERO con protección anti-bucle.
      // Si ya hemos rebotado y AppCenter no nos devuelve un sso_token válido, paramos.
      const count = Number(sessionStorage.getItem('sso_redirect_count') ?? '0')
      const cameBackFromAppCenter = params.has('sso_email') || params.has('sso_token')

      if (count >= 2 || (cameBackFromAppCenter && !ssoToken)) {
        setError(
          cameBackFromAppCenter && !ssoToken
            ? 'AppCenter no ha enviado el token de acceso (falta "sso_token" en la URL, solo llegó "sso_email"). Revisa la configuración del SSO en AppCenter.'
            : 'No se pudo iniciar sesión automáticamente tras varios intentos.'
        )
        setLoading(false)
        return
      }

      sessionStorage.setItem('sso_redirect_count', String(count + 1))
      redirectToAppCenterLogin()
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        setProfile(data)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Pantalla de error (en vez de bucle infinito)
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">No se pudo iniciar sesión</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <a href={APPCENTER_URL}
            className="inline-block bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">
            Volver a AppCenter
          </a>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
