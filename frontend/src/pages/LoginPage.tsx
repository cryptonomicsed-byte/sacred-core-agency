import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { scaleIn, staggerContainer, fadeUp, fadeIn, springConfig } from '../lib/motion'
import { triggerHaptic, registerWebAuthn } from '../lib/webapis'

export function LoginPage() {
  const { signIn, signInAsGuest } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [biometricState, setBiometricState] = useState<'idle' | 'success' | 'error'>('idle')
  const webAuthnSupported = !!window.PublicKeyCredential

  async function handleBiometric() {
    setBiometricState('idle')
    const ok = await registerWebAuthn()
    if (ok) {
      triggerHaptic([50, 30, 50])
      setBiometricState('success')
    } else {
      setBiometricState('error')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)
      try { triggerHaptic([50]) } catch { /* stub — Session 3 */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-surface-1 px-4">
      <motion.div
        className="glass p-8 w-full max-w-md"
        variants={scaleIn}
        initial="initial"
        animate="animate"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
            SACRED CORE
          </h1>
          <p className="text-white/40 text-sm mt-2">
            AI Marketing Agency Platform
          </p>
        </div>

        <motion.form
          onSubmit={handleSubmit}
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          <motion.div variants={fadeUp}>
            <label htmlFor="email" className="block text-sm text-white/60 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-surface-2 border border-glass-border rounded-glass text-white placeholder-white/20 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors"
              placeholder="you@agency.com"
            />
          </motion.div>

          <motion.div variants={fadeUp}>
            <label htmlFor="password" className="block text-sm text-white/60 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-surface-2 border border-glass-border rounded-glass text-white placeholder-white/20 focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors"
              placeholder="••••••••"
            />
          </motion.div>

          {error && (
            <motion.p
              variants={fadeIn}
              initial="initial"
              animate="animate"
              className="text-red-400 text-sm text-center"
            >
              {error}
            </motion.p>
          )}

          <motion.div variants={fadeUp}>
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              transition={springConfig}
              className="w-full py-3 rounded-glass font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </motion.div>
        </motion.form>

        <motion.button
          type="button"
          onClick={() => signInAsGuest()}
          whileTap={{ scale: 0.97 }}
          transition={springConfig}
          className="w-full mt-4 py-3 rounded-glass font-semibold text-white/70 border border-white/10 hover:border-accent-primary/40 hover:text-white transition-colors text-sm"
        >
          Continue as Guest (Demo)
        </motion.button>

        {webAuthnSupported && (
          <motion.div
            variants={fadeUp}
            initial="initial"
            animate="animate"
            className="mt-6 flex flex-col items-center gap-3"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/25 text-xs">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <motion.button
              type="button"
              onClick={handleBiometric}
              whileTap={{ scale: 0.97 }}
              transition={springConfig}
              className="w-full py-3 rounded-glass font-semibold text-white/60 border border-white/10 hover:border-accent-primary/40 hover:text-white/80 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <span className="text-lg" aria-hidden>☝️</span>
              Use Biometric Login
            </motion.button>

            <AnimatePresence mode="wait">
              {biometricState === 'success' && (
                <motion.p
                  key="success"
                  variants={fadeIn}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="text-green-400 text-xs text-center"
                >
                  Biometric registered — available on next login
                </motion.p>
              )}
              {biometricState === 'error' && (
                <motion.p
                  key="error"
                  variants={fadeIn}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="text-white/30 text-xs text-center"
                >
                  Biometric unavailable or cancelled
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </main>
  )
}
