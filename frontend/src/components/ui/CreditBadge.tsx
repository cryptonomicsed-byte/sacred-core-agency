import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useCreditsStore } from '../../store/creditsStore'
import { triggerHaptic } from '../../lib/webapis'
import { cn } from '../../lib/utils'

export function CreditBadge() {
  const balance = useCreditsStore((s) => s.balance)
  const prevRef = useRef(balance)
  const [bouncing, setBouncing] = useState(false)

  useEffect(() => {
    if (balance < prevRef.current) {
      triggerHaptic([30])
      setBouncing(true)
      const t = setTimeout(() => setBouncing(false), 400)
      prevRef.current = balance
      return () => clearTimeout(t)
    }
    prevRef.current = balance
  }, [balance])

  const isWarning = balance <= 500 && balance > 100
  const isCritical = balance <= 100

  const formatted = balance.toLocaleString()

  return (
    <motion.div
      animate={bouncing ? { scale: [1, 1.18, 0.95, 1] } : { scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'glass flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold select-none',
        isCritical && 'animate-pulse',
        isWarning && 'animate-pulse',
      )}
    >
      <span className={isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-accent-glow'}>
        ⚡
      </span>
      <span
        className={
          isCritical
            ? 'text-red-400'
            : isWarning
              ? 'text-amber-400'
              : 'bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent'
        }
      >
        {formatted}
      </span>
    </motion.div>
  )
}
