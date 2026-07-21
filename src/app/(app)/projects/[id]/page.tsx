'use client'
import { useEffect, useState } from 'react'
import { use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/Badge'
import { EXPENSE_TYPE_LABELS } from '@/types'
import { formatCO2 } from '@/lib/co2'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PlusCircle, Receipt, Leaf, Car, Paperclip, AlertCircle, Trash2, FileText, ChevronLeft, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ReportModal } from './ReportModal'
import { EditExpenseModal } from './EditExpenseModal'
import { ReceiptLink } from '@/components/ReceiptLink'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { profile } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [deletingProject, setDeletingProject] = useState(false)
  const [editingExpense, setEditingExpense] = useState<any>(null)

  async function load() {
    const { data } = await supabase
      .from('projects')
      .select('*, expenses(*)')
      .eq('id', id)
      .single()
    setProject(data)
    setLoading(false)
  }

  useEffect(() => { if (profile) load() }, [profile])

  async function handleSubmit() {
    if (!confirm('¿Enviar para revisión? No podrás modificar los gastos una vez enviado.')) return
    setSubmitting(true)
    await supabase.from('projects').update({ status: 'submitted' }).eq('id', id)
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (admins) {
      await supabase.from('notifications').insert(
        admins.map((a: any) => ({
          user_id: a.id, project_id: id, type: 'submitted',
          message: `Nuevo proyecto pendiente: ${project.name}`, read: false,
        }))
      )
    }
    setSubmitting(false)
    load()
  }

  async function handleDelete(expenseId: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    setDeletingId(expenseId)
    await supabase.from('expenses').delete().eq('id', expenseId)
    setDeletingId(null)
    load()
  }

  function startEditName() {
    setNameInput(project.name)
    setEditingName(true)
  }

  async function saveName() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === project.name) { setEditingName(false); return }
    setSavingName(true)
    await supabase.from('projects').update({ name: trimmed }).eq('id', id)
    setSavingName(false)
    setEditingName(false)
    load()
  }

  async function handleDeleteProject() {
    if (!confirm(`¿Eliminar el proyecto "${project.name}" y todos sus gastos? Esta acción no se puede deshacer.`)) return
    setDeletingProject(true)
    await supabase.from('projects').delete().eq('id', id)
    router.push('/projects')
  }

  if (loading || !project) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!profile) return null

  const expenses = project.expenses ?? []
  const totalAmount = expenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
  const totalCO2 = expenses.reduce((s: number, e: any) => s + (e.co2_kg ?? 0), 0)
  const isDraft = project.status === 'draft'
  const isOwner = profile?.id === project.user_id

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <button onClick={() => router.push('/projects')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Mis proyectos
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-2">
            {editingName ? (
              <div className="flex items-center gap-1.5 flex-1">
                <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                  className="text-2xl font-bold text-gray-900 border border-indigo-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0 flex-1" />
                <button onClick={saveName} disabled={savingName}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditingName(false)} disabled={savingName}
                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900 truncate">{project.name}</h1>
                <StatusBadge status={project.status} />
                {isDraft && isOwner && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={startEditName}
                      className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Editar nombre">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={handleDeleteProject} disabled={deletingProject}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Eliminar proyecto">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          {project.description && <p className="text-sm text-gray-500 mb-1">{project.description}</p>}
          <p className="text-xs text-gray-400">
            Creado el {format(new Date(project.created_at), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>

        {isDraft && isOwner && (
          <div className="flex flex-col gap-2 items-end flex-shrink-0">
            <Link href={`/expenses/new?project=${id}`}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap">
              <PlusCircle className="h-4 w-4" /> Añadir gasto
            </Link>
            {expenses.length > 0 && (
              <Button variant="secondary" onClick={() => setShowReport(true)} size="sm">
                <FileText className="h-4 w-4" /> Generar documento
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{totalAmount.toFixed(2)} €</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Gastos</p>
          <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
        </div>
        <div className="bg-teal-50 rounded-xl border border-teal-100 p-4">
          <p className="text-xs text-teal-600 font-medium uppercase tracking-wide mb-1 flex items-center gap-1">
            <Leaf className="h-3 w-3" /> CO₂
          </p>
          <p className="text-2xl font-bold text-teal-800">{formatCO2(totalCO2)}</p>
        </div>
      </div>

      {/* Status banners */}
      {project.status === 'submitted' && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse flex-shrink-0" />
          Enviado al administrador. Recibirás una notificación cuando sea revisado.
        </div>
      )}
      {project.status === 'approved' && (
        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700 flex items-center gap-2">
          <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />
          Aprobado. Pendiente de firma digital para contabilidad.
        </div>
      )}
      {project.status === 'rejected' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
          Rechazado. Revisa los comentarios del administrador y corrígelo.
        </div>
      )}

      {/* Expenses list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Gastos registrados</h2>
          {isDraft && isOwner && expenses.length > 0 && (
            <Link href={`/expenses/new?project=${id}`}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              <PlusCircle className="h-3.5 w-3.5" /> Añadir
            </Link>
          )}
        </div>

        {expenses.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Receipt className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium mb-1">Sin gastos aún</p>
            <p className="text-sm text-gray-400 mb-4">Añade el primer gasto a este proyecto</p>
            {isDraft && (
              <Link href={`/expenses/new?project=${id}`}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium border border-indigo-200 bg-indigo-50 px-4 py-2 rounded-lg">
                <PlusCircle className="h-4 w-4" /> Añadir gasto
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {expenses.map((e: any) => (
                <div key={e.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {EXPENSE_TYPE_LABELS[e.type as keyof typeof EXPENSE_TYPE_LABELS] ?? e.type}
                      </span>
                      {!e.receipt_url && e.type !== 'transport_car_own' && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          <AlertCircle className="h-3 w-3" /> Sin ticket
                        </span>
                      )}
                    </div>
                    {e.trip_reason && <p className="text-xs text-gray-500 mb-1">{e.trip_reason}</p>}
                    {e.description && <p className="text-xs text-gray-400">{e.description}</p>}
                    <div className="flex items-center flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                      <span>{format(new Date(e.date), 'd MMM yyyy', { locale: es })}</span>
                      {e.project_tag && (
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.project_tag}</span>
                      )}
                      {e.km && <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {e.km} km</span>}
                      {e.co2_kg > 0 && (
                        <span className="flex items-center gap-1 text-teal-600">
                          <Leaf className="h-3 w-3" /> {formatCO2(e.co2_kg)}
                        </span>
                      )}
                      {e.receipt_url && (
                        <ReceiptLink pathOrUrl={e.receipt_url}
                          className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 font-medium cursor-pointer">
                          <Paperclip className="h-3 w-3" /> Ver ticket
                        </ReceiptLink>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {e.amount ? `${Number(e.amount).toFixed(2)} €` : e.km ? `${e.km} km` : '—'}
                    </p>
                    {isDraft && isOwner && (
                      <>
                        <button onClick={() => setEditingExpense(e)}
                          className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Editar gasto">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(e.id)} disabled={deletingId === e.id}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-400">{expenses.length} gasto{expenses.length !== 1 ? 's' : ''}</span>
              <span className="font-bold text-gray-900 text-sm">Total: {totalAmount.toFixed(2)} €</span>
            </div>
          </>
        )}
      </div>

      {showReport && (
        <ReportModal
          project={project}
          expenses={expenses}
          profile={profile}
          onClose={() => setShowReport(false)}
        />
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={() => { setEditingExpense(null); load() }}
        />
      )}
    </div>
  )
}
