import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Search, Settings, ChevronRight, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'
import { staggerContainer, fadeIn, springConfig } from '../../lib/motion'
import { cn } from '../../lib/utils'

const NAV_ITEMS = [
  { path: '/', icon: LayoutGrid, label: 'Portfolio' },
  { path: '/leads', icon: Search, label: 'Lead & Closer' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

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

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { user } = useAuthStore()

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sacred-core-sidebar') === 'true',
  )

  useEffect(() => {
    localStorage.setItem('sacred-core-sidebar', String(collapsed))
    window.dispatchEvent(
      new CustomEvent('sidebar:toggle', { detail: { collapsed } }),
    )
  }, [collapsed])

  function navTo(path: string) {
    if ('startViewTransition' in document) {
      ;(
        document as Document & { startViewTransition: (cb: () => void) => void }
      ).startViewTransition(() => navigate(path))
    } else {
      navigate(path)
    }
  }

  const initials = getInitials(user?.full_name, user?.email)

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={springConfig}
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col overflow-hidden"
      style={{ background: 'rgba(15,15,19,0.95)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute top-4 right-3 z-10 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <motion.div
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={springConfig}
        >
          <ChevronRight size={16} />
        </motion.div>
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-6 flex-shrink-0">
        <div className="w-8 h-8 rounded-glass bg-gradient-to-br from-accent-primary to-accent-secondary flex-shrink-0 flex items-center justify-center">
          <span className="text-white font-black text-xs">SC</span>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">
                SACRED CORE
              </p>
              <p className="text-white/40 text-xs whitespace-nowrap">Agency</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <motion.nav
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-1 px-2 flex-1"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          const Icon = item.icon

          return (
            <motion.div
              key={item.path}
              variants={fadeIn}
              className="relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-glass bg-accent-primary/20 border border-accent-primary/30"
                  transition={springConfig}
                />
              )}
              <button
                onClick={() => navTo(item.path)}
                className={cn(
                  'relative z-10 w-full flex items-center gap-3 px-3 py-2.5 rounded-glass transition-colors',
                  isActive
                    ? 'text-white shadow-glow'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/5',
                )}
              >
                <Icon size={18} className="flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      variants={fadeIn}
                      initial="initial"
                      animate="animate"
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          )
        })}
      </motion.nav>

      {/* Bottom user section */}
      <div className="flex flex-col gap-2 p-2 flex-shrink-0 border-t border-white/5 mt-auto">
        <div className="flex items-center gap-3 px-2 py-2">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                variants={fadeIn}
                initial="initial"
                animate="animate"
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <p className="text-white text-xs font-medium truncate">
                  {user?.full_name ?? user?.email ?? 'User'}
                </p>
                <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-accent-primary/20 text-accent-primary mt-0.5">
                  {user?.tier ?? 'starter'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-glass text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={16} className="flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                variants={fadeIn}
                initial="initial"
                animate="animate"
                exit={{ opacity: 0 }}
                className="text-xs whitespace-nowrap"
              >
                Sign out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
