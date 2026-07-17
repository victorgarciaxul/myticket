'use client'
import { useEffect, useState } from 'react'
import { use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { EXPENSE_TYPE_LABELS } from '@/types'
import { formatCO2 } from '@/lib/co2'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Paperclip, Leaf, Car, AlertCircle, CheckCircle, XCircle, Download, FileText } from 'lucide-react'
import { ReceiptLink } from '@/components/ReceiptLink'

export default function AdminProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)

  useEffect(() => {
    if (!profile) return
    if (profile.role !== 'admin') { router.replace('/dashboard'); return }
    supabase
      .from('projects')
      .select('*, profiles(full_name, email), expenses(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => { setProject(data); setLoading(false) })
  }, [profile])

  async function handleAction(action: 'approve' | 'reject') {
    setActionLoading(action)
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    await supabase.from('projects').update({ status: newStatus }).eq('id', id)
    await supabase.from('notifications').insert({
      user_id: project.user_id, project_id: id,
      type: action === 'approve' ? 'approved' : 'rejected',
      message: action === 'approve'
        ? 'Tu proyecto ha sido aprobado. Pendiente de firma digital.'
        : `Tu proyecto ha sido rechazado. ${comment}`,
      read: false,
    })
    setActionLoading(null)
    router.push('/admin')
  }

  if (loading || !project) return <div className="p-8 text-gray-400">Cargando...</div>

  const expenses = project.expenses ?? []
  const totalAmount = expenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
  const totalCO2 = expenses.reduce((s: number, e: any) => s + (e.co2_kg ?? 0), 0)
  const reportContent = project.report_content ? JSON.parse(project.report_content) : null

  function downloadDocument() {
    if (!reportContent) return
    const blob = new Blob([JSON.stringify(reportContent, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nota-gastos-${project.name.replace(/\s+/g, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-gray-500">{project.profiles?.full_name} · {project.profiles?.email}</p>
          {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
          {reportContent && (
            <button onClick={downloadDocument}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
              <Download className="h-3.5 w-3.5" /> Descargar nota de gastos
            </button>
          )}
        </div>

        {project.status === 'submitted' && (
          <div className="space-y-3 min-w-[240px]">
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Comentario (opcional, visible en caso de rechazo)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex gap-2 justify-end">
              <Button variant="danger" size="sm" loading={actionLoading === 'reject'} onClick={() => handleAction('reject')}>
                <XCircle className="h-4 w-4" /> Rechazar
              </Button>
              <Button variant="primary" size="sm" loading={actionLoading === 'approve'} onClick={() => handleAction('approve')}>
                <CheckCircle className="h-4 w-4" /> Aprobar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold">{totalAmount.toFixed(2)} €</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Tickets</p>
          <p className="text-2xl font-bold">{expenses.length}</p>
        </div>
        <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4">
          <p className="text-sm text-indigo-700 flex items-center gap-1"><Leaf className="h-3.5 w-3.5" /> CO₂</p>
          <p className="text-2xl font-bold text-indigo-800">{formatCO2(totalCO2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-100 font-semibold text-gray-900">Desglose de gastos</div>
        <div className="divide-y divide-gray-100">
          {expenses.map((e: any) => (
            <div key={e.id} className="p-4 flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-900">
                    {EXPENSE_TYPE_LABELS[e.type as keyof typeof EXPENSE_TYPE_LABELS] ?? e.type}
                  </span>
                  {!e.receipt_url && e.type !== 'transport_car_own' && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      <AlertCircle className="h-3 w-3" /> Sin ticket
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{e.trip_reason}</p>
                {e.description && <p className="text-xs text-gray-400">{e.description}</p>}
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{format(new Date(e.date), 'd MMM yyyy', { locale: es })}</span>
                  {e.project_tag && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{e.project_tag}</span>}
                  {e.km && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {e.km} km</span>}
                  {e.co2_kg > 0 && <span className="flex items-center gap-1 text-green-600"><Leaf className="h-3 w-3" /> {formatCO2(e.co2_kg)}</span>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{e.amount ? `${Number(e.amount).toFixed(2)} €` : e.km ? `${e.km} km` : '—'}</p>
                </div>
                {e.receipt_url && (
                  <ReceiptLink pathOrUrl={e.receipt_url}
                    className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-0.5 cursor-pointer">
                    <Paperclip className="h-3.5 w-3.5" /> Ticket
                  </ReceiptLink>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <span className="font-bold text-gray-900">Total: {totalAmount.toFixed(2)} €</span>
        </div>
      </div>
    </div>
  )
}
