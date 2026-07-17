'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/Badge'
import { formatCO2 } from '@/lib/co2'
import { FolderOpen, Receipt, Leaf, ArrowRight, PlusCircle, ShieldCheck, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function DashboardPage() {
  const { profile } = useAuth()
  const supabase = createClient()
  const [projects, setProjects] = useState<any[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [totalCO2, setTotalCO2] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    async function load() {
      const { data: proj } = await supabase
        .from('projects')
        .select('*, expenses(id, amount, co2_kg)')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      setProjects(proj ?? [])

      const { data: allExp } = await supabase
        .from('expenses')
        .select('amount, co2_kg')
        .eq('user_id', profile!.id)
      setTotalAmount(allExp?.reduce((s, e) => s + (e.amount ?? 0), 0) ?? 0)
      setTotalCO2(allExp?.reduce((s, e) => s + (e.co2_kg ?? 0), 0) ?? 0)

      if (profile!.role === 'admin') {
        const { count } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'submitted')
        setPendingCount(count ?? 0)
      }
      setLoading(false)
    }
    load()
  }, [profile])

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  const firstName = profile.full_name.split(' ')[0]

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p>
          <h1 className="text-2xl font-bold text-gray-900">Hola, {firstName} 👋</h1>
          <p className="text-gray-500 mt-1 text-sm">Aquí tienes un resumen de tu actividad reciente</p>
        </div>
        <Link href="/projects/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-colors">
          <PlusCircle className="h-4 w-4" />
          Nuevo proyecto
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<FolderOpen className="h-5 w-5 text-indigo-600" />}
          label="Proyectos activos"
          value={String(projects.length)}
          iconBg="bg-indigo-50"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          label="Total gastos"
          value={`${totalAmount.toFixed(2)} €`}
          iconBg="bg-emerald-50"
        />
        <StatCard
          icon={<Leaf className="h-5 w-5 text-teal-600" />}
          label="Emisiones CO₂"
          value={formatCO2(totalCO2)}
          iconBg="bg-teal-50"
        />
      </div>

      {/* Admin alert */}
      {profile.role === 'admin' && pendingCount > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-900 text-sm">{pendingCount} proyecto{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''} de revisión</p>
              <p className="text-xs text-amber-600 mt-0.5">Revisa y aprueba los gastos del equipo</p>
            </div>
          </div>
          <Link href="/admin" className="flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors">
            Revisar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Recent projects */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Proyectos recientes</h2>
          <Link href="/projects" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            Ver todos →
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FolderOpen className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium mb-1">Sin proyectos aún</p>
            <p className="text-sm text-gray-400 mb-4">Crea tu primer proyecto para empezar a registrar gastos</p>
            <Link href="/projects/new"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-200 bg-indigo-50 px-4 py-2 rounded-lg">
              <PlusCircle className="h-4 w-4" /> Crear proyecto
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {projects.map((p: any) => {
              const total = p.expenses?.reduce((s: number, e: any) => s + (e.amount ?? 0), 0) ?? 0
              return (
                <Link key={p.id} href={`/projects/${p.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.expenses?.length ?? 0} gastos · {total.toFixed(2)} €</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={p.status} />
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, iconBg }: { icon: React.ReactNode; label: string; value: string; iconBg: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}
