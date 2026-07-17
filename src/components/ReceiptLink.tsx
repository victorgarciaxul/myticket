'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSignedReceiptUrl } from '@/lib/receipts'

/**
 * Enlace a un ticket almacenado en el bucket privado.
 * Genera una URL firmada temporal en el momento del clic y la abre en otra pestaña.
 */
export function ReceiptLink({
  pathOrUrl,
  className,
  children,
}: {
  pathOrUrl: string
  className?: string
  children: React.ReactNode
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function open(e: React.MouseEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    const url = await getSignedReceiptUrl(supabase, pathOrUrl)
    setLoading(false)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else alert('No se pudo abrir el ticket. Puede que no tengas permiso o el fichero no exista.')
  }

  return (
    <a href="#" onClick={open} className={className} aria-busy={loading}>
      {children}
    </a>
  )
}
