import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PortfolioGrid } from '../components/portfolio/PortfolioGrid'
import { useCreditsStore } from '../store/creditsStore'
import { usePortfolioStore } from '../store/portfolioStore'
import { useWakeLock } from '../hooks/useWakeLock'
import { getCurrentUser, getPortfolios } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { mockUser, mockPortfolios } from '../lib/mockData'
import type { Portfolio } from '../types'

export function DashboardPage() {
  const setBalance = useCreditsStore((s) => s.setBalance)
  const portfolios = usePortfolioStore((s) => s.portfolios)
  const setPortfolios = usePortfolioStore((s) => s.setPortfolios)
  const isDemo = useAuthStore((s) => s.isDemo)
  const [loading, setLoading] = useState(true)
  useWakeLock(true)

  useEffect(() => {
    async function fetchData() {
      if (isDemo) {
        setBalance(mockUser.credits)
        setPortfolios(mockPortfolios)
        setLoading(false)
        return
      }
      try {
        const [user, fetchedPortfolios] = await Promise.all([
          getCurrentUser(),
          getPortfolios(),
        ])
        if (user) setBalance(user.credits)
        setPortfolios(fetchedPortfolios)
      } catch {
        // Fall back to empty state
        setPortfolios([])
      } finally {
        setLoading(false)
      }
    }
    void fetchData()
  }, [setBalance, setPortfolios, isDemo])

  function handlePortfolioCreated(portfolio: Portfolio) {
    setPortfolios([portfolio, ...portfolios])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-accent-primary/30 border-t-accent-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8">
      <PortfolioGrid portfolios={portfolios} onCreated={handlePortfolioCreated} />
    </div>
  )
}
