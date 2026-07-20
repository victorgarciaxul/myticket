/**
 * AutoFirma integration — vía oficial (protocolo afirma://)
 *
 * Versión anterior: intentaba llamar por HTTP/HTTPS directamente a puertos fijos
 * en 127.0.0.1, asumiendo que AutoFirma ya tenía un socket abierto ahí. Eso no
 * funciona: AutoFirma solo abre el socket cuando la página le pasa unos puertos
 * aleatorios mediante una invocación real por protocolo (afirma://), y además los
 * navegadores modernos bloquean por defecto las llamadas HTTP desde una página
 * HTTPS a localhost (mixed content / Private Network Access).
 *
 * Este fichero usa en su lugar la biblioteca oficial "autoscript.js" del Cliente
 * @firma (Gobierno de España, https://github.com/ctt-gob-es/clienteafirma),
 * vendorizada en /public/afirma/autoscript.js. Esa biblioteca ya se encarga de
 * la invocación por protocolo, la elección de puertos y el socket TLS — no hay
 * que reimplementar nada de eso a mano.
 *
 * Manual de referencia: "Manual del integrador del MiniApplet v1.6 del Cliente
 * @firma y la compatibilidad de sus despliegues con AutoFirma" (SGAD).
 */
import forge from 'node-forge'

export interface SignatureResult {
  signature: string
  certificate: string
  signerName: string
  signingTime: string
}

declare global {
  interface Window {
    MiniApplet?: {
      cargarAppAfirma: (codebase: string) => void
      sign: (
        dataB64: string | null,
        algorithm: string,
        format: string,
        params: string | null,
        successCallback: (signatureB64: string, certificateB64: string) => void,
        errorCallback: (type: string, message: string) => void
      ) => void
    }
  }
}

const SCRIPT_URL = '/afirma/autoscript.js'

let loadPromise: Promise<void> | null = null

/** Carga autoscript.js (una sola vez) y activa la carga directa de AutoFirma. */
function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (window.MiniApplet) {
      window.MiniApplet.cargarAppAfirma(window.location.origin)
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (!window.MiniApplet) {
        reject(new Error('autoscript.js cargó pero no expuso MiniApplet'))
        return
      }
      window.MiniApplet.cargarAppAfirma(window.location.origin)
      resolve()
    }
    script.onerror = () => reject(new Error('No se pudo cargar autoscript.js'))
    document.head.appendChild(script)
  })

  return loadPromise
}

/** Clasifica el error devuelto por MiniApplet.sign en los códigos que la UI entiende. */
function classifyError(type: string, message: string): { code: string; msg: string } {
  const t = `${type} ${message}`.toLowerCase()
  if (/cancel/.test(t)) {
    return { code: 'cancelled', msg: 'Firma cancelada por el usuario' }
  }
  if (/no se ha podido conectar|conectar con autofirma|connection|socket|econnrefused|timeout/.test(t)) {
    return {
      code: 'not_running',
      msg: 'AutoFirma no detectado. Asegúrate de que AutoFirma está abierto e inténtalo de nuevo.',
    }
  }
  return { code: 'unknown', msg: message || 'Error desconocido al firmar con AutoFirma' }
}

/** Extrae el Common Name (nombre + DNI) del certificado X.509 en base64 (DER). */
function extractSignerName(certificateB64: string): string {
  try {
    const der = forge.util.decode64(certificateB64)
    const asn1 = forge.asn1.fromDer(der)
    const cert = forge.pki.certificateFromAsn1(asn1)
    const cn = cert.subject.getField('CN')?.value
    return cn ?? ''
  } catch {
    return ''
  }
}

/** Firma el contenido del documento con AutoFirma (vía protocolo afirma://). */
export async function signWithAutoFirma(documentContent: string): Promise<SignatureResult> {
  try {
    await ensureLoaded()
  } catch {
    throw Object.assign(
      new Error('No se pudo cargar el componente de firma. Recarga la página e inténtalo de nuevo.'),
      { code: 'not_running' }
    )
  }

  const bytes = new TextEncoder().encode(documentContent)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  const dataB64 = btoa(binary)

  return new Promise((resolve, reject) => {
    window.MiniApplet!.sign(
      dataB64,
      'SHA256withRSA',
      'CAdES',
      null,
      (signatureB64, certificateB64) => {
        resolve({
          signature: signatureB64,
          certificate: certificateB64,
          signerName: extractSignerName(certificateB64),
          signingTime: new Date().toISOString(),
        })
      },
      (type, message) => {
        const { code, msg } = classifyError(type, message)
        reject(Object.assign(new Error(msg), { code }))
      }
    )
  })
}

/** Parsea el CN del certificado para extraer nombre y DNI (formato español habitual). */
export function parseCertDN(dn: string): { name: string; dni: string } {
  const cn = dn.match(/CN=([^,]+)/)?.[1] ?? dn
  const dniMatch = cn.match(/[-\s](\d{8}[A-Z]|\d{7}[A-Z]{2})$/)
  const dni = dniMatch?.[1] ?? ''
  const name = cn.replace(dniMatch?.[0] ?? '', '').trim().replace(/-$/, '').trim()
  return { name: name || cn, dni }
}
