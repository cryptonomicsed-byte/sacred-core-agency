import { useEffect, useReducer } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

interface BentoGridProps {
  children: ReactNode
  columns?: number
  className?: string
}

export function BentoGrid({ children, className }: BentoGridProps) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    const handler = () => forceUpdate()
    window.addEventListener('sidebar:toggle', handler)
    return () => window.removeEventListener('sidebar:toggle', handler)
  }, [])

  return (
    <AnimatePresence mode="sync">
      <motion.div
        layout
        className={cn(
          'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 auto-rows-auto',
          className,
        )}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
