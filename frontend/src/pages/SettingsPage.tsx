import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GlassCard } from '../components/ui/GlassCard'
import { useAuthStore } from '../store/authStore'
import { useCreditsStore } from '../store/creditsStore'
import { useCredits } from '../hooks/useCredits'
import { useAuth } from '../hooks/useAuth'
import { staggerContainer, fadeUp } from '../lib/motion'
import type { CreditTransaction } from '../types'

type Tier = 'starter' | 'pro' | 'enterprise'

interface HealthData {
  services?: {
    supabase?: string
    openclaw?: string
    gemini?: string
    elevenlabs?: string
  }
}

const TIER_STYLES: Record<Tier, string> = {
  starter: 'text-white/70 border-white/20 bg-white/5',
  pro: 'text-accent-primary border-accent-primary/50 bg-accent-primary/10',
  enterprise: 'text-amber-400 border-amber-500/50 bg-amber-500/10',
}

const TIER_LABELS: Record<Tier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const TOPUP_PACKAGES: { id: Tier; credits: number; price: string; label: string }[] = [
  { id: 'starter', credits: 500, price: '$9', label: 'Starter Pack' },
  { id: 'pro', credits: 2000, price: '$29', label: 'Pro Pack' },
  { id: 'enterprise', credits: 10000, price: '$99', label: 'Enterprise Pack' },
]

const FEATURE_ROWS = [
  { feature: 'DNA Extractions', starter: '5/mo', pro: '∞', enterprise: '∞' },
  { feature: 'Campaigns', starter: '3/mo', pro: '∞', enterprise: '∞' },
  { feature: 'Agent Forge', starter: '1 agent', pro: '5', enterprise: '∞' },
  { feature: 'Sonic Lab', starter: '3/mo', pro: '∞', enterprise: '∞' },
  { feature: 'Website Builder', starter: '1/mo', pro: '∞', enterprise: '∞' },
  { feature: 'Lead Search', starter: '10/mo', pro: '∞', enterprise: '∞' },
]

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function serviceStatusPill(status?: string) {
  if (!status) return <span className="text-white/30 text-xs">Unknown</span>
  const isOk = status === 'connected' || status === 'configured'
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
        isOk
          ? 'text-green-400 bg-green-500/10 border-green-500/20'
          : 'text-red-400 bg-red-500/10 border-red-500/20'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isOk ? 'bg-green-400' : 'bg-red-400'}`} />
      {status}
    </span>
  )
}

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)
  const balance = useCreditsStore((s) => s.balance)
  const tier = (useCreditsStore((s) => s.tier) as Tier) || 'starter'
  const { history, fetchHistory, topUp, topUpMessage } = useCredits()
  const { signOut } = useAuth()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)

  useEffect(() => {
    fetchHistory()
    fetch('/health')
      .then((r) => r.json())
      .then((data: HealthData) => setHealth(data))
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTopUp(pkg: Tier) {
    setPurchasingId(pkg)
    await topUp(pkg)
    setPurchasingId(null)
  }

  function handleDeleteAccount() {
    alert('Contact support at support@sacredcore.agency to delete your account.')
  }

  const displayTier = (user?.tier as Tier) ?? tier

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="p-6 md:p-8 max-w-3xl mx-auto flex flex-col gap-6"
    >
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-1">Manage your account and subscription</p>
      </motion.div>

      {/* ── 1. PROFILE ── */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6 flex flex-col gap-4" hoverable={false}>
          <h2 className="text-white font-bold text-sm uppercase tracking-wider">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {user?.full_name
                ? user.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-white font-semibold">{user?.full_name || '—'}</p>
              <p className="text-white/50 text-sm">{user?.email}</p>
              {user?.created_at && (
                <p className="text-white/30 text-xs mt-0.5">
                  Member since{' '}
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── 2. SUBSCRIPTION & CREDITS ── */}
      <motion.div variants={fadeUp} id="credits">
        <GlassCard className="p-6 flex flex-col gap-5" hoverable={false}>
          <h2 className="text-white font-bold text-sm uppercase tracking-wider">
            Subscription &amp; Credits
          </h2>

          {/* Tier badge + balance */}
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={`inline-flex items-center px-4 py-1.5 rounded-full border text-sm font-bold tracking-wide uppercase ${TIER_STYLES[displayTier]}`}
            >
              {TIER_LABELS[displayTier]}
            </span>
            <div>
              <span className="text-4xl font-bold text-white">{balance}</span>
              <span className="text-white/40 text-sm ml-1">credits remaining</span>
            </div>
          </div>

          {/* Credit History */}
          {history.length > 0 && (
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                Recent Activity
              </p>
              <div className="rounded-glass border border-white/8 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="px-3 py-2 text-left text-white/30 font-medium">Action</th>
                      <th className="px-3 py-2 text-right text-white/30 font-medium">Credits</th>
                      <th className="px-3 py-2 text-right text-white/30 font-medium">Balance</th>
                      <th className="px-3 py-2 text-right text-white/30 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 10).map((tx: CreditTransaction) => (
                      <tr key={tx.id} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 text-white/70 font-mono">{tx.action}</td>
                        <td className="px-3 py-2 text-right text-red-400 font-semibold">
                          −{tx.credits_used}
                        </td>
                        <td className="px-3 py-2 text-right text-white/50">{tx.balance_after}</td>
                        <td className="px-3 py-2 text-right text-white/30">
                          {relativeDate(tx.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top-up packages */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
              Top-Up Packages
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TOPUP_PACKAGES.map((pkg) => (
                <GlassCard
                  key={pkg.id}
                  className={`p-4 flex flex-col gap-3 ${
                    displayTier === pkg.id ? 'border-accent-primary/40' : ''
                  }`}
                  hoverable
                >
                  <div>
                    <p className="text-white font-semibold text-sm">{pkg.label}</p>
                    <p className="text-white/50 text-xs mt-0.5">
                      {pkg.credits.toLocaleString()} credits
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-accent-glow font-bold text-lg">{pkg.price}</span>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTopUp(pkg.id)}
                      disabled={purchasingId === pkg.id}
                      className="px-3 py-1.5 rounded-glass text-xs font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {purchasingId === pkg.id ? 'Processing…' : 'Purchase'}
                    </motion.button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>

          {/* Top-up message */}
          {topUpMessage && (
            <p className="text-amber-400 text-sm px-4 py-3 rounded-glass bg-amber-500/10 border border-amber-500/20">
              {topUpMessage}
            </p>
          )}
        </GlassCard>
      </motion.div>

      {/* ── 3. API CONFIGURATION ── */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6 flex flex-col gap-4" hoverable={false}>
          <h2 className="text-white font-bold text-sm uppercase tracking-wider">
            API Configuration
          </h2>
          <p className="text-white/40 text-xs">
            API keys are configured server-side for security. Contact admin to update.
          </p>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Gemini (AI)', key: 'gemini' },
              { label: 'ElevenLabs (Audio)', key: 'elevenlabs' },
              { label: 'OpenClaw (Agents)', key: 'openclaw' },
              { label: 'Supabase (Database)', key: 'supabase' },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-white/70 text-sm">{label}</span>
                {serviceStatusPill(health?.services?.[key as keyof typeof health.services])}
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* ── 4. TIER FEATURES ── */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6 flex flex-col gap-4" hoverable={false}>
          <h2 className="text-white font-bold text-sm uppercase tracking-wider">Tier Features</h2>
          <div className="rounded-glass border border-white/8 overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[400px]">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-3 py-2.5 text-left text-white/40 font-medium">Feature</th>
                  {(['starter', 'pro', 'enterprise'] as Tier[]).map((t) => (
                    <th
                      key={t}
                      className={`px-3 py-2.5 text-center font-semibold capitalize ${
                        displayTier === t
                          ? 'text-accent-primary bg-accent-primary/5'
                          : 'text-white/40'
                      }`}
                    >
                      {t}
                      {displayTier === t && (
                        <span className="ml-1 text-xs text-accent-primary/60">●</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row) => (
                  <tr key={row.feature} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 text-white/70">{row.feature}</td>
                    {(['starter', 'pro', 'enterprise'] as Tier[]).map((t) => (
                      <td
                        key={t}
                        className={`px-3 py-2 text-center font-mono ${
                          displayTier === t
                            ? 'text-accent-primary bg-accent-primary/5 font-semibold'
                            : 'text-white/40'
                        }`}
                      >
                        {row[t]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── 5. DANGER ZONE ── */}
      <motion.div variants={fadeUp}>
        <GlassCard
          className="p-6 flex flex-col gap-4 border-red-500/20"
          hoverable={false}
        >
          <h2 className="text-red-400 font-bold text-sm uppercase tracking-wider">Danger Zone</h2>
          <div className="flex flex-wrap gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={signOut}
              className="px-4 py-2 rounded-glass text-sm font-semibold text-white bg-white/10 border border-white/20 hover:bg-white/15 transition-colors"
            >
              Sign Out
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleDeleteAccount}
              className="px-4 py-2 rounded-glass text-sm font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors"
            >
              Delete Account
            </motion.button>
          </div>
          <p className="text-white/25 text-xs">
            Account deletion requires contacting support. This action is irreversible.
          </p>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
