import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useCreditsStore } from '../../store/creditsStore'

interface CreditGateProps {
  cost: number
  action: string
  children: ReactNode
  disabled?: boolean
  title?: string
}

export function CreditGate({ cost, action, children, disabled, title }: CreditGateProps) {
  const balance = useCreditsStore((s) => s.balance)
  const canAfford = balance >= cost

  // Affordable and not otherwise disabled — render normally
  if (canAfford && !disabled) {
    return <>{children}</>
  }

  // Cannot afford — show overlay with lock badge
  if (!canAfford) {
    return (
      <div className="relative" aria-label={`${action} requires ${cost} credits`}>
        <div style={{ pointerEvents: 'none', userSelect: 'none', opacity: 0.45 }}>
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center rounded-glass bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1.5 px-3 py-2.5 text-center">
            <Lock size={15} className="text-red-400" />
            <p className="text-white text-xs font-semibold leading-tight">
              ⚡ {cost} credits required
            </p>
            <p className="text-white/40 text-xs">
              Balance: {balance} cr
            </p>
            <Link
              to="/settings#credits"
              className="text-accent-primary text-xs font-medium hover:text-accent-secondary hover:underline transition-colors"
            >
              Top Up Credits →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Disabled for another reason — muted, no interaction, optional tooltip
  return (
    <div
      title={title}
      style={{ pointerEvents: 'none', opacity: 0.4, userSelect: 'none' }}
    >
      {children}
    </div>
  )
}
