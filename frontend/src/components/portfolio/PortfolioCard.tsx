import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../ui/GlassCard'
import { StatusPill } from '../ui/StatusPill'
import { fadeUp, springConfig } from '../../lib/motion'
import { triggerHaptic } from '../../lib/webapis'
import type { Portfolio } from '../../types'

interface PortfolioCardProps {
  portfolio: Portfolio
  index: number
}

export function PortfolioCard({ portfolio, index }: PortfolioCardProps) {
  const navigate = useNavigate()
  const initial = portfolio.company_name.charAt(0).toUpperCase()

  function openWorkspace() {
    triggerHaptic([40])
    if ('startViewTransition' in document) {
      ;(document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(
        () => navigate(`/portfolio/${portfolio.id}`),
      )
    } else {
      navigate(`/portfolio/${portfolio.id}`)
    }
  }

  return (
    <motion.div
      layout
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={{ ...springConfig, delay: index * 0.08 }}
    >
      <GlassCard
        className="p-6 flex flex-col gap-4"
        hoverable
        glowOnHover
        onClick={openWorkspace}
      >
        {/* Top row */}
        <div className="flex items-center gap-3">
          {portfolio.logo_url ? (
            <img
              src={portfolio.logo_url}
              alt={portfolio.company_name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-bold truncate">{portfolio.company_name}</p>
            <p className="text-white/40 text-xs truncate">
              {portfolio.industry ?? 'No industry set'}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-0.5 rounded-glass bg-white/5 py-2 px-1">
            <span className="text-white font-semibold text-sm">0</span>
            <span className="text-white/40 text-xs">Campaigns</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-glass bg-white/5 py-2 px-1">
            <span className="text-white font-semibold text-sm">0</span>
            <span className="text-white/40 text-xs">Agents</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 rounded-glass bg-white/5 py-2 px-1">
            <span className="text-sm">{portfolio.dna_profile_id ? '✅' : '⚪'}</span>
            <span className="text-white/40 text-xs">DNA</span>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between gap-3 mt-auto">
          <StatusPill status="draft" />
          <motion.button
            onClick={(e) => {
              e.stopPropagation()
              openWorkspace()
            }}
            whileTap={{ scale: 0.96 }}
            transition={springConfig}
            className="flex-1 py-2 px-3 rounded-glass text-sm font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow"
          >
            Open Workspace →
          </motion.button>
        </div>
      </GlassCard>
    </motion.div>
  )
}
