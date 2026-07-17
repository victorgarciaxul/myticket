'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ShieldCheck, Clock, ChevronDown, ChevronRight, User,
  FolderOpen, CheckCircle, XCircle, Loader2, FileText, Download,
} from 'lucide-react'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  submitted:  { label: 'Pendiente',  color: 'bg-amber-100 text-amber-700' },
  approved:   { label: 'Aprobado',   color: 'bg-green-100 text-green-700' },
  rejected:   { label: 'Denegado',   color: 'bg-red-100 text-red-600' },
  signed:     { label: 'Firmado',    color: 'bg-indigo-100 text-indigo-700' },
}

export default function AdminPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openUsers, setOpenUsers] = useState<Record<string, boolean>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState<Record<string, string>>({})
  const [rejectOpen, setRejectOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'admin') { router.replace('/dashboard'); return }
    load()
  }, [profile])

  async function load() {
    const [{ data: projectsData }, { data: usersData }] = await Promise.all([
      supabase
        .from('projects')
        .select('*, profiles(id, full_name, email), expenses(id, amount), report_content')
        .in('status', ['submitted', 'approved', 'rejected', 'signed'])
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'user')
        .order('full_name'),
    ])
    setProjects(projectsData ?? [])
    setUsers(usersData ?? [])
    // Abrir por defecto carpetas con pendientes
    const open: Record<string, boolean> = {}
    ;(projectsData ?? []).forEach((p: any) => {
      if (p.status === 'submitted') open[p.profiles?.id] = true
    })
    setOpenUsers(open)
    setLoading(false)
  }

  function downloadDocument(p: any) {
    const content = p.report_content ? JSON.parse(p.report_content) : null
    if (!content) return
    const lines: string[] = [
      'NOTA DE GASTOS — IMAGINE COMUNICACIÓN ANDALUZA (B-14591945)',
      `Proyecto: ${content.project?.name ?? p.name}`,
      `Empleado: ${content.profile?.full_name ?? ''}`,
      `Email: ${content.profile?.email ?? ''}`,
      `Fecha generación: ${content.generatedAt ? new Date(content.generatedAt).toLocaleDateString('es-ES') : ''}`,
      '',
      'GASTOS:',
      ...(content.expenses ?? []).map((e: any) =>
        `  ${e.date ? new Date(e.date).toLocaleDateString('es-ES') : ''} | ${e.concepto} | ${e.amount > 0 ? e.amount.toFixed(2) + ' €' : e.km + ' km'}`
      ),
      '',
      `TOTAL: ${content.total?.toFixed(2) ?? '0.00'} €`,
      '',
      `Observaciones: ${content.resumen ?? ''}`,
      '',
      content.signature ? [
        'FIRMA DIGITAL:',
        `  Firmado por: ${content.signature.signerName}`,
        content.signature.dni ? `  DNI/NIE: ${content.signature.dni}` : '',
        `  Fecha: ${content.signature.signingTime ? new Date(content.signature.signingTime).toLocaleString('es-ES') : ''}`,
        content.signature.issuer ? `  Emisor: ${content.signature.issuer}` : '',
      ].filter(Boolean).join('\n') : 'Pendiente de firma',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nota-gastos-${(content.profile?.full_name ?? p.name).replace(/\s+/g, '-').toLowerCase()}-${p.name.replace(/\s+/g, '-').toLowerCase()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleAction(projectId: string, action: 'approve' | 'reject', userId: string) {
    setActionLoading(projectId + action)
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const comment = rejectComment[projectId] ?? ''
    await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
    await supabase.from('notifications').insert({
      user_id: userId, project_id: projectId,
      type: action === 'approve' ? 'approved' : 'rejected',
      message: action === 'approve'
        ? 'Tu nota de gastos ha sido aprobada.'
        : `Tu nota de gastos ha sido denegada.${comment ? ' ' + comment : ''}`,
      read: false,
    })
    setActionLoading(null)
    setRejectOpen(null)
    load()
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Construir mapa de proyectos por usuario
  const projectsByUser: Record<string, any[]> = {}
  projects.forEach(p => {
    const uid = p.profiles?.id ?? 'unknown'
    if (!projectsByUser[uid]) projectsByUser[uid] = []
    projectsByUser[uid].push(p)
  })

  // Todos los usuarios (incluso sin tickets)
  const userEntries = users.map(u => ({ uid: u.id, profile: u, projects: projectsByUser[u.id] ?? [] }))
  const totalPending = projects.filter(p => p.status === 'submitted').length

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-indigo-100 rounded-xl">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets recibidos</h1>
          <p className="text-sm text-gray-500">
            {userEntries.length} usuario{userEntries.length !== 1 ? 's' : ''} ·{' '}
            {projects.length} documento{projects.length !== 1 ? 's' : ''}
            {totalPending > 0 && (
              <span className="text-amber-600 font-semibold"> · {totalPending} pendiente{totalPending !== 1 ? 's' : ''} de revisión</span>
            )}
          </p>
        </div>
      </div>

      {userEntries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center">
          <FolderOpen className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400">Aún no se han recibido notas de gastos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {userEntries.map(({ uid, profile: userProfile, projects: userProjects }) => {
            const isOpen = openUsers[uid] ?? false
            const pending = userProjects.filter(p => p.status === 'submitted').length
            const totalAmount = userProjects.reduce((s, p) =>
              s + (p.expenses ?? []).reduce((es: number, e: any) => es + (e.amount ?? 0), 0), 0)

            return (
              <div key={uid} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

                {/* ── Cabecera usuario / carpeta ── */}
                <button
                  onClick={() => setOpenUsers(prev => ({ ...prev, [uid]: !prev[uid] }))}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white flex-shrink-0 ${pending > 0 ? 'bg-amber-500' : 'bg-indigo-500'}`}>
                    {userProfile?.full_name?.[0]?.toUpperCase() ?? <User className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{userProfile?.full_name ?? 'Usuario'}</p>
                      {pending > 0 && (
                        <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {pending} pendiente{pending !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {userProfile?.email} · {userProjects.length} documento{userProjects.length !== 1 ? 's' : ''} · {totalAmount.toFixed(2)} €
                    </p>
                  </div>
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                </button>

                {/* ── Documentos del usuario ── */}
                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {userProjects.length === 0 && (
                      <div className="px-5 py-6 pl-20 flex items-center gap-2 text-xs text-gray-400">
                        <FolderOpen className="h-4 w-4" /> Sin documentos recibidos aún
                      </div>
                    )}
                    {userProjects.map(p => {
                      const expenses = p.expenses ?? []
                      const total = expenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
                      const st = STATUS_LABEL[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-500' }
                      const isPending = p.status === 'submitted'
                      const isRejectOpen = rejectOpen === p.id

                      return (
                        <div key={p.id} className={`px-5 py-4 pl-20 ${isPending ? 'bg-amber-50/40' : ''}`}>
                          <div className="flex items-start gap-3">
                            {/* Icono */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isPending ? 'bg-amber-100' : 'bg-gray-100'}`}>
                              <FileText className={`h-4 w-4 ${isPending ? 'text-amber-600' : 'text-gray-400'}`} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {expenses.length} gasto{expenses.length !== 1 ? 's' : ''} · {total.toFixed(2)} € ·{' '}
                                {format(new Date(p.created_at), "d MMM yyyy", { locale: es })}
                              </p>
                            </div>

                            {/* Acciones */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <a href={`/admin/projects/${p.id}`}
                                className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                                Ver detalle
                              </a>
                              {p.report_content && (
                                <button
                                  onClick={() => downloadDocument(p)}
                                  className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition-colors"
                                  title="Descargar nota de gastos"
                                >
                                  <Download className="h-3.5 w-3.5" /> Descargar
                                </button>
                              )}

                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleAction(p.id, 'approve', userProfile?.id)}
                                    disabled={!!actionLoading}
                                    className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === p.id + 'approve'
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <CheckCircle className="h-3.5 w-3.5" />}
                                    Aprobar
                                  </button>

                                  <button
                                    onClick={() => setRejectOpen(isRejectOpen ? null : p.id)}
                                    disabled={!!actionLoading}
                                    className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === p.id + 'reject'
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <XCircle className="h-3.5 w-3.5" />}
                                    Denegar
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Panel de motivo de denegación */}
                          {isPending && isRejectOpen && (
                            <div className="mt-3 ml-11 flex gap-2 items-start">
                              <input
                                type="text"
                                value={rejectComment[p.id] ?? ''}
                                onChange={e => setRejectComment(prev => ({ ...prev, [p.id]: e.target.value }))}
                                placeholder="Motivo de la denegación (opcional)"
                                className="flex-1 px-3 py-2 text-xs border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                              />
                              <button
                                onClick={() => handleAction(p.id, 'reject', userProfile?.id)}
                                disabled={!!actionLoading}
                                className="flex items-center gap-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                              >
                                {actionLoading === p.id + 'reject'
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <XCircle className="h-3 w-3" />}
                                Confirmar denegación
                              </button>
                              <button onClick={() => setRejectOpen(null)}
                                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-2">
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
