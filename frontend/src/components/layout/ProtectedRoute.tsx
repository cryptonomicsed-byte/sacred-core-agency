import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { fadeIn, springConfig } from '../../lib/motion'

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('sacred-core-sidebar') === 'true',
  )

  useEffect(() => {
    const handler = (e: Event) => {
      const { collapsed } = (e as CustomEvent<{ collapsed: boolean }>).detail
      setSidebarCollapsed(collapsed)
    }
    window.addEventListener('sidebar:toggle', handler)
    return () => window.removeEventListener('sidebar:toggle', handler)
  }, [])

  if (loading) {
    return (
      <motion.div
        className="flex items-center justify-center min-h-screen bg-surface-1"
        variants={fadeIn}
        initial="initial"
        animate="animate"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
          <p className="text-white/40 text-sm">Loading...</p>
        </div>
      </motion.div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-surface-1">
      <Sidebar />
      <TopBar />
      <motion.main
        animate={{ marginLeft: sidebarCollapsed ? 64 : 240 }}
        transition={springConfig}
        className="min-h-screen pt-14"
      >
        <Outlet />
      </motion.main>
    </div>
  )
}
