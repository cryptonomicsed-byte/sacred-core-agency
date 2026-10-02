import { motion } from 'framer-motion'
import { glassHover, glassGlow } from '../../lib/motion'
import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
  glowOnHover?: boolean
}

export function GlassCard({
  children,
  className,
  onClick,
  hoverable = true,
  glowOnHover = false,
}: GlassCardProps) {
  const hoverVariant = glowOnHover ? glassGlow : glassHover

  return (
    <motion.div
      className={cn('glass', hoverable && 'cursor-pointer', className)}
      variants={hoverable ? hoverVariant : undefined}
      initial={hoverable ? 'initial' : undefined}
      whileHover={hoverable ? 'hover' : undefined}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}
