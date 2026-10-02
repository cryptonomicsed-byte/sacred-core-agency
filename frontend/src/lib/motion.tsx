import { type Variants, type Transition, motion } from 'framer-motion'
import { forwardRef, type ComponentProps } from 'react'

export const springConfig: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
}

export const fadeUp: Variants = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: springConfig },
  exit: { y: 20, opacity: 0 },
}

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: springConfig },
  exit: { opacity: 0 },
}

export const scaleIn: Variants = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: springConfig },
  exit: { scale: 0.95, opacity: 0 },
}

export const slideInLeft: Variants = {
  initial: { x: -20, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: springConfig },
  exit: { x: -20, opacity: 0 },
}

export const slideInRight: Variants = {
  initial: { x: 20, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: springConfig },
  exit: { x: 20, opacity: 0 },
}

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

export const glassHover: Variants = {
  initial: {},
  hover: {
    scale: 1.01,
    boxShadow: '0 0 20px rgba(99,102,241,0.4)',
    transition: springConfig,
  },
}

export const glassGlow: Variants = {
  initial: {},
  hover: {
    scale: 1.02,
    boxShadow: '0 0 30px rgba(99,102,241,0.5), 0 0 60px rgba(99,102,241,0.2)',
    transition: springConfig,
  },
}

export const MotionDiv = forwardRef<
  HTMLDivElement,
  ComponentProps<typeof motion.div>
>(function MotionDiv(props, ref) {
  return <motion.div ref={ref} transition={springConfig} {...props} />
})
