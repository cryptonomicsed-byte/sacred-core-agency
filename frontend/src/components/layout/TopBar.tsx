import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { CreditBadge } from '../ui/CreditBadge'
import { useAuthStore } from '../../store/authStore'
import { springConfig } from '../../lib/motion'

const TITLE_MAP: Record<string, string> = {
  '/': 'Portfolio',
  '/leads': 'Lead & Closer',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/portfolio/')) return 'Portfolio Workspace'
  return TITLE_MAP[pathname] ?? 'Dashboard'
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email?.[0]?.toUpperCase() ?? '?'
}

export function TopBar() {
  const location = useLocation()
  const { user } = useAuthStore()
  const title = getPageTitle(location.pathname)
  const initials = getInitials(user?.full_name, user?.email)

  const [sidebarWidth, setSidebarWidth] = useState(
    () => (localStorage.getItem('sacred-core-sidebar') === 'true' ? 64 : 240),
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const { collapsed } = (e as CustomEvent<{ collapsed: boolean }>).detail
      setSidebarWidth(collapsed ? 64 : 240)
    }
    window.addEventListener('sidebar:toggle', handler)
    return () => window.removeEventListener('sidebar:toggle', handler)
  }, [])

  return (
    <motion.header
      animate={{ marginLeft: sidebarWidth }}
      transition={springConfig}
      className="fixed top-0 right-0 h-14 z-40 flex items-center justify-between px-6"
      style={{
        background: 'rgba(15,15,19,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Page title */}
      <h1 className="text-white font-semibold text-base">{title}</h1>

      {/* Right section */}
      <div className="flex items-center gap-3">
        <CreditBadge />

        {/* Notification bell (stub) */}
        <button
          className="p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white text-xs font-bold">
          {initials}
        </div>
      </div>
    </motion.header>
  )
}
