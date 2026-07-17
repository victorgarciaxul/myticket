'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { LayoutDashboard, FolderOpen, LogOut, Ticket, ChevronRight, UserCircle, ShieldCheck } from 'lucide-react'
import { redirectToAppCenterHome } from '@/lib/appcenter'

interface SidebarProps { profile: Profile }

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = profile.role === 'admin'

  const navItems = isAdmin
    ? [
        { href: '/admin', label: 'Tickets recibidos', icon: ShieldCheck },
        { href: '/account', label: 'Mi cuenta', icon: UserCircle },
      ]
    : [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/projects', label: 'Mis proyectos', icon: FolderOpen },
        { href: '/account', label: 'Mi cuenta', icon: UserCircle },
      ]

  async function handleSignOut() {
    await supabase.auth.signOut()
    redirectToAppCenterHome()
  }

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <Ticket className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">MyTicket</span>
            <p className="text-[10px] text-gray-400 leading-none mt-0.5">Gestión de gastos</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-4 pb-2 space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Menú</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all group',
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              )}>
              <Icon className={cn('h-4 w-4 flex-shrink-0 transition-colors', active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-1">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {profile.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{profile.full_name}</p>
            <p className="text-[10px] text-gray-400">{profile.role === 'admin' ? 'Administrador' : 'Usuario'}</p>
          </div>
        </div>
        <button onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors group">
          <LogOut className="h-4 w-4 text-gray-400 group-hover:text-red-500" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
