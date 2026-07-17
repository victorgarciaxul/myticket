import { redirect } from 'next/navigation'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // Preserva la query string (incluido sso_token) al redirigir, para que
  // AuthProvider pueda leerla y completar el login SSO con AppCenter.
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value)
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/dashboard${suffix}`)
}
