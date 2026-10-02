import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassCard } from '../ui/GlassCard'
import { DNAProfileTab } from '../../tabs/DNAProfileTab'
import { PortfolioBuilderTab } from '../../tabs/PortfolioBuilderTab'
import { CampaignsTab } from '../../tabs/CampaignsTab'
import { AgentForgeTab } from '../../tabs/AgentForgeTab'
import { SonicLabTab } from '../../tabs/SonicLabTab'
import { WebsiteBuilderTab } from '../../tabs/WebsiteBuilderTab'
import { fadeIn, springConfig } from '../../lib/motion'
import { triggerHaptic } from '../../lib/webapis'
import type { Portfolio } from '../../types'

const TABS = [
  'DNA Profile',
  'Portfolio Builder',
  'Campaigns',
  'Agent Forge',
  'Sonic Lab',
  'Website Builder',
] as const

type Tab = (typeof TABS)[number]

interface PortfolioWorkspaceProps {
  portfolio: Portfolio | undefined
}

export function PortfolioWorkspace({ portfolio }: PortfolioWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('DNA Profile')

  // Listen for tab:switch events from child tabs
  useEffect(() => {
    function handleTabSwitch(e: Event) {
      const detail = (e as CustomEvent<{ tab: string }>).detail
      const tab = detail?.tab as Tab
      if (TABS.includes(tab)) setActiveTab(tab)
    }
    document.addEventListener('tab:switch', handleTabSwitch)
    return () => document.removeEventListener('tab:switch', handleTabSwitch)
  }, [])

  function handleTabClick(tab: Tab) {
    if (tab === activeTab) return
    triggerHaptic([20])
    setActiveTab(tab)
  }

  if (!portfolio) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-white/40 text-lg">Portfolio not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Portfolio header */}
      <div className="flex items-center gap-3">
        {portfolio.logo_url ? (
          <img
            src={portfolio.logo_url}
            alt={portfolio.company_name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {portfolio.company_name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">{portfolio.company_name}</h1>
          {portfolio.industry && (
            <p className="text-white/40 text-xs">{portfolio.industry}</p>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="relative flex items-center gap-1 overflow-x-auto pb-0.5">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className="relative px-4 py-2 rounded-glass text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0"
            style={{
              color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.35)',
            }}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="tabIndicator"
                className="absolute inset-0 rounded-glass bg-accent-primary/20 border border-accent-primary/30"
                transition={springConfig}
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={fadeIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'DNA Profile' && (
            <DNAProfileTab portfolio={portfolio} />
          )}

          {activeTab === 'Portfolio Builder' && (
            <PortfolioBuilderTab portfolio={portfolio} />
          )}

          {activeTab === 'Campaigns' && (
            <CampaignsTab portfolio={portfolio} />
          )}

          {activeTab === 'Agent Forge' && (
            <AgentForgeTab portfolio={portfolio} />
          )}

          {activeTab === 'Sonic Lab' && (
            <SonicLabTab portfolio={portfolio} />
          )}

          {activeTab === 'Website Builder' && (
            <WebsiteBuilderTab portfolio={portfolio} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
