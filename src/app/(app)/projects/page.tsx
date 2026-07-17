'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCO2 } from '@/lib/co2'
import { ArrowRight, PlusCircle, FolderOpen, Leaf, Receipt, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function ProjectsPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('projects')
      .select('*, expenses(id, amount, co2_kg)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setProjects(data ?? []); setLoading(false) })
  }, [profile])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis proyectos</h1>
          <p className="text-sm text-gray-400 mt-1">{projects.length} proyecto{projects.length !== 1 ? 's' : ''} registrado{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/projects/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
          <PlusCircle className="h-4 w-4" /> Nuevo proyecto
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="h-7 w-7 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Sin proyectos todavía</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">Crea un proyecto para agrupar los gastos de un viaje o evento</p>
          <Link href="/projects/new"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm">
            <PlusCircle className="h-4 w-4" /> Crear primer proyecto
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p: any) => {
            const expenses = p.expenses ?? []
            const total = expenses.reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
            const co2 = expenses.reduce((s: number, e: any) => s + (e.co2_kg ?? 0), 0)
            return (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-md transition-all flex items-center justify-between group block">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                      <StatusBadge status={p.status} />
                    </div>
                    {p.description && <p className="text-xs text-gray-400 mb-1.5 line-clamp-1">{p.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(p.created_at), "d MMM yyyy", { locale: es })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        {expenses.length} gasto{expenses.length !== 1 ? 's' : ''}
                      </span>
                      <span className="font-semibold text-gray-600">{total.toFixed(2)} €</span>
                      {co2 > 0 && (
                        <span className="flex items-center gap-1 text-teal-600">
                          <Leaf className="h-3 w-3" /> {formatCO2(co2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors ml-4 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
