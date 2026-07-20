import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = ['admin@xul.es']

// Cliente admin: usa la secret key, SOLO en servidor, nunca expuesto al navegador.
// Perezoso: instanciarlo al cargar el módulo rompe el build (Next evalúa las
// rutas al recolectar page data, cuando aún no hay variables de entorno).
let _supabaseAdmin: SupabaseClient | null = null
function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY
    if (!url || !key) {
      throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY')
    }
    _supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _supabaseAdmin
}

export async function POST(req: NextRequest) {
  try {
    const { sso_token } = await req.json()
    if (!sso_token || typeof sso_token !== 'string') {
      return NextResponse.json({ error: 'Falta sso_token' }, { status: 400 })
    }

    // 1) Verificar el token contra AppCenter (server-to-server, el bearer nunca llega al navegador)
    const verifyRes = await fetch('https://qwlebsymypgauydkqxem.supabase.co/functions/v1/sso/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APPCENTER_SSO_TOKEN}`,
      },
      body: JSON.stringify({ sso_token }),
      signal: AbortSignal.timeout(10000),
    })

    if (!verifyRes.ok) {
      return NextResponse.json({ error: 'No se pudo verificar la sesión de AppCenter' }, { status: 401 })
    }

    const { valid, email } = await verifyRes.json()
    if (!valid || !email) {
      return NextResponse.json({ error: 'Token inválido o caducado' }, { status: 401 })
    }

    // 2) Buscar (o crear) el perfil correspondiente en MyTicket, usando el email ya verificado
    let { data: profile } = await getSupabaseAdmin()
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    let userId: string

    if (profile) {
      userId = profile.id
    } else {
      // Provisión automática: nuevo usuario verificado por AppCenter, rol por defecto = user
      const { data: created, error: createErr } = await getSupabaseAdmin().auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: email.split('@')[0] },
      })
      if (createErr || !created.user) {
        return NextResponse.json({ error: 'No se pudo crear el usuario' }, { status: 500 })
      }
      userId = created.user.id
      // El trigger handle_new_user crea la fila en profiles con role='user' por defecto.
      // Si el email está en la lista de admins conocidos, se ajusta el rol.
      if (ADMIN_EMAILS.includes(email)) {
        await getSupabaseAdmin().from('profiles').update({ role: 'admin' }).eq('id', userId)
      }
    }

    // 3) Generar un enlace mágico y canjearlo server-side para obtener tokens de sesión reales
    const { data: linkData, error: linkErr } = await getSupabaseAdmin().auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr || !linkData) {
      return NextResponse.json({ error: 'No se pudo generar la sesión' }, { status: 500 })
    }

    const hashedToken = linkData.properties?.hashed_token
    if (!hashedToken) {
      return NextResponse.json({ error: 'Respuesta inesperada al generar sesión' }, { status: 500 })
    }

    const { data: sessionData, error: sessionErr } = await getSupabaseAdmin().auth.verifyOtp({
      type: 'magiclink',
      token_hash: hashedToken,
    })
    if (sessionErr || !sessionData.session) {
      return NextResponse.json({ error: 'No se pudo canjear la sesión' }, { status: 500 })
    }

    return NextResponse.json({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error inesperado' }, { status: 500 })
  }
}
