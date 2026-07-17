import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * El bucket `receipts` es PRIVADO. Los tickets solo se acceden mediante URLs
 * firmadas temporales generadas bajo demanda con el JWT del usuario.
 *
 * En BD guardamos la RUTA del objeto (ej. "{userId}/162...-ab.jpg"), no la URL.
 * Este helper también acepta URLs completas antiguas y extrae la ruta.
 */

/** Normaliza a ruta de objeto dentro del bucket 'receipts'. */
export function toReceiptPath(urlOrPath: string): string {
  if (!urlOrPath) return ''
  const marker = '/receipts/'
  const i = urlOrPath.indexOf(marker)
  if (i !== -1) return urlOrPath.slice(i + marker.length)
  return urlOrPath.replace(/^receipts\//, '')
}

/** Genera una URL firmada temporal (por defecto 1 hora) para un ticket. */
export async function getSignedReceiptUrl(
  supabase: SupabaseClient,
  urlOrPath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const path = toReceiptPath(urlOrPath)
  if (!path) return null
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}
