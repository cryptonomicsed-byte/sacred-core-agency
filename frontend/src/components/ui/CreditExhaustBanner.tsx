import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'
import { useCreditsStore } from '../../store/creditsStore'
import { useAuthStore } from '../../store/authStore'

export function CreditExhaustBanner() {
  const balance = useCreditsStore((s) => s.balance)
  const session = useAuthStore((s) => s.session)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('credit-banner-dismissed') === '1',
  )

  const visible = !!session && balance === 0 && !dismissed

  function dismiss() {
    sessionStorage.setItem('credit-banner-dismissed', '1')
    setDismissed(true)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gradient-to-r from-red-600/90 to-amber-600/90 backdrop-blur-md border-t border-red-500/30">
            <div className="flex items-center gap-3">
              <Zap size={16} className="text-white flex-shrink-0" />
              <p className="text-white text-sm font-medium">
                You&apos;re out of credits — all AI features are paused.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <Link
                to="/settings#credits"
                className="text-white text-sm font-semibold underline hover:text-white/80 transition-colors whitespace-nowrap"
              >
                Top up credits →
              </Link>
              <button
                onClick={dismiss}
                aria-label="Dismiss banner"
                className="text-white/70 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
