import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, LayoutGrid, X } from 'lucide-react'
import { BentoGrid } from '../ui/BentoGrid'
import { GlassCard } from '../ui/GlassCard'
import { PortfolioCard } from './PortfolioCard'
import { staggerContainer, fadeIn, scaleIn, springConfig } from '../../lib/motion'
import { triggerHaptic } from '../../lib/webapis'
import { createPortfolio } from '../../services/supabaseClient'
import type { Portfolio } from '../../types'

interface PortfolioGridProps {
  portfolios: Portfolio[]
  onCreated?: (portfolio: Portfolio) => void
}

export function PortfolioGrid({ portfolios, onCreated }: PortfolioGridProps) {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [industry, setIndustry] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function openModal() {
    setCompanyName('')
    setCompanyUrl('')
    setIndustry('')
    setCreateError(null)
    setModalOpen(true)
  }

  function closeModal() {
    if (creating) return
    setModalOpen(false)
  }

  async function handleCreate() {
    if (!companyName.trim()) return
    setCreateError(null)
    setCreating(true)
    try {
      const portfolio = await createPortfolio({
        company_name: companyName.trim(),
        company_url: companyUrl.trim() || undefined,
        industry: industry.trim() || undefined,
      })
      triggerHaptic([50, 30, 50])
      setModalOpen(false)
      onCreated?.(portfolio)
      navigate(`/portfolio/${portfolio.id}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create portfolio')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div />
        <motion.button
          onClick={openModal}
          whileTap={{ scale: 0.96 }}
          transition={springConfig}
          className="flex items-center gap-2 px-4 py-2 rounded-glass text-sm font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow"
        >
          <Plus size={16} />
          New Portfolio
        </motion.button>
      </div>

      {portfolios.length === 0 ? (
        <GlassCard
          className="flex flex-col items-center justify-center py-20 gap-4"
          hoverable={false}
        >
          <LayoutGrid size={40} className="text-white/20" />
          <p className="text-white/40 text-sm">No portfolios yet</p>
          <motion.button
            onClick={openModal}
            whileTap={{ scale: 0.96 }}
            transition={springConfig}
            className="flex items-center gap-2 px-5 py-2.5 rounded-glass text-sm font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow"
          >
            <Plus size={16} />
            Create Your First Portfolio
          </motion.button>
        </GlassCard>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          <BentoGrid>
            {portfolios.map((portfolio, index) => (
              <PortfolioCard key={portfolio.id} portfolio={portfolio} index={index} />
            ))}
          </BentoGrid>
        </motion.div>
      )}

      {/* Create Portfolio Modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={closeModal}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              key="modal"
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md">
                <GlassCard className="p-6 flex flex-col gap-5" hoverable={false}>
                  {/* Modal header */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">New Portfolio</h2>
                    <motion.button
                      onClick={closeModal}
                      whileTap={{ scale: 0.92 }}
                      transition={springConfig}
                      className="p-1.5 rounded-glass text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                    >
                      <X size={18} />
                    </motion.button>
                  </div>

                  {createError && (
                    <div className="px-4 py-3 rounded-glass bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {createError}
                    </div>
                  )}

                  {/* Company name */}
                  <div className="flex flex-col gap-2">
                    <label className="text-white/60 text-sm font-medium">
                      Company Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
                      placeholder="e.g. Acme Corp"
                      autoFocus
                      className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 transition-colors text-sm"
                    />
                  </div>

                  {/* Company URL */}
                  <div className="flex flex-col gap-2">
                    <label className="text-white/60 text-sm font-medium">
                      Company URL{' '}
                      <span className="text-white/30 font-normal">(optional)</span>
                    </label>
                    <input
                      type="url"
                      value={companyUrl}
                      onChange={(e) => setCompanyUrl(e.target.value)}
                      placeholder="https://acme.com"
                      className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 transition-colors text-sm"
                    />
                  </div>

                  {/* Industry */}
                  <div className="flex flex-col gap-2">
                    <label className="text-white/60 text-sm font-medium">
                      Industry{' '}
                      <span className="text-white/30 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="e.g. SaaS, Healthcare, Fintech"
                      className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 transition-colors text-sm"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <motion.button
                      onClick={closeModal}
                      whileTap={{ scale: 0.97 }}
                      transition={springConfig}
                      disabled={creating}
                      className="flex-1 py-2.5 rounded-glass text-sm font-medium text-white/50 hover:text-white/70 border border-white/10 hover:bg-white/5 transition-colors disabled:opacity-40"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      onClick={handleCreate}
                      whileTap={{ scale: 0.97 }}
                      transition={springConfig}
                      disabled={!companyName.trim() || creating}
                      className="flex-1 py-2.5 rounded-glass text-sm font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {creating ? 'Creating…' : 'Create Portfolio'}
                    </motion.button>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
