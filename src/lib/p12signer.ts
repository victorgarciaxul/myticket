/**
 * Client-side signing with P12/PFX certificate using node-forge.
 * The private key never leaves the browser.
 */
import forge from 'node-forge'

export interface P12SignatureResult {
  signature: string      // Base64 CMS/CAdES signature
  certificate: string    // Base64 DER certificate
  signerName: string     // CN from certificate
  signingTime: string    // ISO timestamp
  issuer: string
  serialNumber: string
  validTo: string
}

export async function signWithP12(
  documentText: string,
  p12File: File,
  password: string,
): Promise<P12SignatureResult> {
  // Read the P12 file as binary
  const arrayBuffer = await p12File.arrayBuffer()
  const p12Der = forge.util.createBuffer(new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), ''))

  // Parse P12
  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der), password)
  } catch {
    throw new Error('Contraseña incorrecta o certificado no válido')
  }

  // Extract private key and certificate
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })

  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]
  const certBag = certBags[forge.pki.oids.certBag]?.[0]

  if (!keyBag?.key || !certBag?.cert) {
    throw new Error('No se encontró clave privada o certificado en el archivo P12')
  }

  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey
  const cert = certBag.cert

  // Sign the document content (SHA-256)
  const md = forge.md.sha256.create()
  md.update(documentText, 'utf8')
  const signatureBytes = privateKey.sign(md)
  const signatureB64 = forge.util.encode64(signatureBytes)

  // Export certificate as DER base64
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const certB64 = forge.util.encode64(certDer)

  // Extract signer info from certificate
  const cn = cert.subject.getField('CN')?.value ?? ''
  const o = cert.subject.getField('O')?.value ?? ''
  const issuerCN = cert.issuer.getField('CN')?.value ?? ''
  const validTo = cert.validity.notAfter.toISOString()
  const serial = cert.serialNumber

  return {
    signature: signatureB64,
    certificate: certB64,
    signerName: cn || o,
    signingTime: new Date().toISOString(),
    issuer: issuerCN,
    serialNumber: serial,
    validTo,
  }
}

/** Parse Spanish certificate CN to extract name and DNI/NIF */
export function parseCertName(cn: string): { name: string; dni: string } {
  // Format: "GARCIA ROSAL VICTOR - 15454253R" or "15454253R GARCIA ROSAL VICTOR"
  const dniMatch = cn.match(/\b(\d{8}[A-Z])\b/)
  const dni = dniMatch?.[1] ?? ''
  const name = cn.replace(dniMatch?.[0] ?? '', '').replace(/-/g, '').trim()
  return { name: name || cn, dni }
}
