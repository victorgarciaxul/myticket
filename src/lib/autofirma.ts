/**
 * AutoFirma integration
 * AutoFirma es la app oficial de firma electrónica de España.
 * Abre un servidor local al que el navegador puede llamar.
 *
 * Puertos HTTP (sin SSL):  51236, 51237  → usados cuando la página va por HTTP
 * Puertos HTTPS (con SSL): 51234, 51235  → usados cuando la página va por HTTPS
 *
 * En producción HTTPS los puertos SSL fallan por certificado autofirmado.
 * En desarrollo HTTP funciona perfectamente.
 */

export interface SignatureResult {
  signature: string
  certificate: string
  signerName: string
  signingTime: string
}

// Orden preferido: HTTP primero (funciona sin restricciones SSL), luego HTTPS
const CANDIDATES = [
  { port: 51236, proto: 'http' },
  { port: 51237, proto: 'http' },
  { port: 51234, proto: 'https' },
  { port: 51235, proto: 'https' },
]

/** Detecta AutoFirma. Devuelve la URL base si está disponible, null si no. */
export async function detectAutoFirma(): Promise<{ port: number; proto: string } | null> {
  for (const { port, proto } of CANDIDATES) {
    try {
      const res = await fetch(`${proto}://127.0.0.1:${port}/ready`, {
        signal: AbortSignal.timeout(1500),
      })
      if (res.ok || res.status < 500) return { port, proto }
    } catch (e: any) {
      const msg = (e?.message ?? '') + (e?.cause?.message ?? '')
      // Si hay error de certificado (no de conexión rechazada), AutoFirma SÍ está corriendo
      if (/certificate|SSL|CERT|ERR_CERT/i.test(msg)) return { port, proto }
    }
  }
  return null
}

/** Firma el contenido del documento con AutoFirma */
export async function signWithAutoFirma(documentContent: string): Promise<SignatureResult> {
  const detected = await detectAutoFirma()

  if (!detected) {
    throw Object.assign(
      new Error('AutoFirma no detectado. Asegúrate de que AutoFirma está abierto e inténtalo de nuevo.'),
      { code: 'not_running' }
    )
  }

  const { port, proto } = detected
  const base = `${proto}://127.0.0.1:${port}`

  // Codifica el documento en base64
  const bytes = new TextEncoder().encode(documentContent)
  const base64Data = btoa(String.fromCharCode(...bytes))

  const params = new URLSearchParams({
    op: 'sign',
    algorithm: 'SHA256withRSA',
    format: 'CAdES',
    dat: base64Data,
    props: 'certSubject=true',
  })

  let res: Response
  try {
    res = await fetch(`${base}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(60000),
    })
  } catch (e: any) {
    const msg = (e?.message ?? '') + (e?.cause?.message ?? '')
    if (/certificate|SSL|CERT|ERR_CERT/i.test(msg)) {
      throw Object.assign(
        new Error(`AutoFirma usa HTTPS con certificado autofirmado. Visita ${base}/ en el navegador, acepta el certificado y vuelve a intentarlo.`),
        { code: 'ssl_untrusted', url: `${base}/` }
      )
    }
    throw Object.assign(new Error('Error de conexión con AutoFirma'), { code: 'connection_error' })
  }

  if (!res.ok) throw new Error(`AutoFirma devolvió error ${res.status}`)

  const json = await res.json()
  if (json.err) {
    if (/cancel/i.test(json.err)) throw Object.assign(new Error('Firma cancelada por el usuario'), { code: 'cancelled' })
    throw new Error(json.err)
  }

  return {
    signature: json.signature ?? json.sign ?? '',
    certificate: json.certificate ?? json.cert ?? '',
    signerName: json.subject ?? json.certSubject ?? '',
    signingTime: new Date().toISOString(),
  }
}

/** Parsea el DN del certificado para extraer nombre y DNI */
export function parseCertDN(dn: string): { name: string; dni: string } {
  const cn = dn.match(/CN=([^,]+)/)?.[1] ?? dn
  const dniMatch = cn.match(/[-\s](\d{8}[A-Z]|\d{7}[A-Z]{2})$/)
  const dni = dniMatch?.[1] ?? ''
  const name = cn.replace(dniMatch?.[0] ?? '', '').trim().replace(/-$/, '').trim()
  return { name: name || cn, dni }
}
