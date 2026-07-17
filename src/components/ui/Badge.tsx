import { cn } from '@/lib/utils'
import { ProjectStatus } from '@/types'

const STATUS_CONFIG: Record<ProjectStatus, { label: string; dot: string; className: string }> = {
  draft:     { label: 'Borrador',  dot: 'bg-gray-400',   className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  submitted: { label: 'Enviado',   dot: 'bg-amber-400',  className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  approved:  { label: 'Aprobado',  dot: 'bg-indigo-500', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  rejected:  { label: 'Rechazado', dot: 'bg-red-500',    className: 'bg-red-50 text-red-600 border border-red-200' },
  signed:    { label: 'Firmado',   dot: 'bg-violet-500', className: 'bg-violet-50 text-violet-700 border border-violet-200' },
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold', config.className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
      {config.label}
    </span>
  )
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 text-gray-600', className)}>
      {children}
    </span>
  )
}
