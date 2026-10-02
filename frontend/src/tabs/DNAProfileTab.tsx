import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePortfolio } from '../hooks/usePortfolio'
import { GlassCard } from '../components/ui/GlassCard'
import { CreditGate } from '../components/ui/CreditGate'
import { fadeUp, fadeIn, scaleIn, staggerContainer, springConfig } from '../lib/motion.tsx'
import { triggerHaptic } from '../lib/webapis'
import type { DNAProfile, Portfolio } from '../types'

const LOADING_PHRASES = [
  'Analyzing brand positioning…',
  'Extracting tone signature…',
  'Mapping target personas…',
  'Synthesizing brand values…',
  'Performing SWOT analysis…',
  'Compiling DNA profile…',
]

const TONE_LABELS: Record<DNAProfile['tone'], string> = {
  'bold/edgy': 'Bold / Edgy',
  'luxury/clean': 'Luxury / Clean',
  'playful/warm': 'Playful / Warm',
  'professional': 'Professional',
  'experimental': 'Experimental',
}

const TONE_COLORS: Record<DNAProfile['tone'], string> = {
  'bold/edgy': 'from-red-500 to-orange-500',
  'luxury/clean': 'from-yellow-400 to-amber-300',
  'playful/warm': 'from-pink-400 to-rose-400',
  'professional': 'from-accent-primary to-accent-secondary',
  'experimental': 'from-cyan-400 to-violet-500',
}

type TabState = 'empty' | 'loading' | 'error' | 'populated'

interface ParsedGemini {
  summary?: string
}

function parseSummary(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as ParsedGemini
    return parsed.summary ?? ''
  } catch {
    return ''
  }
}

interface DNAProfileTabProps {
  portfolio: Portfolio
}

export function DNAProfileTab({ portfolio }: DNAProfileTabProps) {
  const { activeDNAProfile, setActiveDNAProfile, extractPortfolioDNA, loadDNAProfile } =
    usePortfolio()

  const [state, setState] = useState<TabState>('empty')
  const [error, setError] = useState<string | null>(null)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [companyName, setCompanyName] = useState(portfolio.company_name)
  const [companyUrl, setCompanyUrl] = useState(portfolio.company_url ?? '')

  const phraseRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load existing DNA profile on mount
  useEffect(() => {
    if (portfolio.dna_profile_id && !activeDNAProfile) {
      setState('loading')
      loadDNAProfile(portfolio.id)
        .then((profile) => {
          if (profile) {
            setState('populated')
          } else {
            setState('empty')
          }
        })
        .catch(() => setState('empty'))
    } else if (activeDNAProfile && activeDNAProfile.portfolio_id === portfolio.id) {
      setState('populated')
    }
  }, [portfolio.id, portfolio.dna_profile_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phrase cycling during loading
  useEffect(() => {
    if (state === 'loading') {
      phraseRef.current = setInterval(() => {
        setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length)
      }, 1400)
    }
    return () => {
      if (phraseRef.current) clearInterval(phraseRef.current)
    }
  }, [state])

  async function handleExtract() {
    if (!companyName.trim()) return
    triggerHaptic([40, 20, 40])
    setState('loading')
    setError(null)
    setPhraseIndex(0)
    try {
      await extractPortfolioDNA({
        portfolioId: portfolio.id,
        companyName: companyName.trim(),
        companyUrl: companyUrl.trim() || undefined,
      })
      triggerHaptic([50, 30, 50])
      setState('populated')
    } catch (err) {
      triggerHaptic([100, 50, 100])
      setError(err instanceof Error ? err.message : 'DNA extraction failed')
      setState('error')
    }
  }

  function handleReset() {
    setActiveDNAProfile(null)
    setState('empty')
    setError(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence mode="wait">
        {state === 'empty' && (
          <motion.div
            key="empty"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col gap-6"
          >
            {/* Header */}
            <div>
              <h2 className="text-xl font-bold text-white">Brand DNA Extraction</h2>
              <p className="text-white/40 text-sm mt-1">
                Powered by Gemini 2.0 Flash · 50 credits
              </p>
            </div>

            {/* Form */}
            <GlassCard className="flex flex-col gap-5 p-6" hoverable={false}>
              <div className="flex flex-col gap-2">
                <label className="text-white/60 text-sm font-medium">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Stripe"
                  className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 focus:bg-white/8 transition-colors text-sm"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-white/60 text-sm font-medium">
                  Company URL{' '}
                  <span className="text-white/30 font-normal">(optional, improves accuracy)</span>
                </label>
                <input
                  type="url"
                  value={companyUrl}
                  onChange={(e) => setCompanyUrl(e.target.value)}
                  placeholder="https://stripe.com"
                  className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 focus:bg-white/8 transition-colors text-sm"
                />
              </div>

              <CreditGate cost={50} action="DNA Extraction">
                <motion.button
                  onClick={handleExtract}
                  disabled={!companyName.trim()}
                  whileTap={{ scale: 0.97 }}
                  transition={springConfig}
                  className="w-full py-3 px-4 rounded-glass font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>⚡</span>
                  <span>Extract DNA</span>
                  <span className="text-white/60 text-xs font-normal ml-1">−50 credits</span>
                </motion.button>
              </CreditGate>
            </GlassCard>

            {/* What you'll get */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            >
              {['Tone signature', 'Brand colors', 'Core values', 'Target personas', 'SWOT analysis', 'Positioning'].map(
                (item) => (
                  <motion.div
                    key={item}
                    variants={fadeUp}
                    className="glass flex items-center gap-2 px-3 py-2.5 rounded-glass text-sm text-white/50"
                  >
                    <span className="text-accent-glow">→</span>
                    {item}
                  </motion.div>
                ),
              )}
            </motion.div>
          </motion.div>
        )}

        {state === 'loading' && (
          <motion.div
            key="loading"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center py-24 gap-8"
          >
            {/* DNA helix spinner */}
            <div className="relative w-16 h-16">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-accent-primary/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-2 rounded-full border-2 border-accent-secondary/50"
                animate={{ rotate: -360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-4 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {/* Cycling phrase */}
            <div className="h-7 flex items-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="text-white/60 text-base font-medium"
                >
                  {LOADING_PHRASES[phraseIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            <p className="text-white/25 text-xs">Gemini 2.0 Flash is analyzing {companyName}</p>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center py-20 gap-6"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl">
              ⚠
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">Extraction Failed</p>
              <p className="text-white/40 text-sm max-w-xs">{error}</p>
            </div>
            <motion.button
              onClick={() => setState('empty')}
              whileTap={{ scale: 0.97 }}
              transition={springConfig}
              className="px-6 py-2.5 rounded-glass text-sm font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors"
            >
              Try Again
            </motion.button>
          </motion.div>
        )}

        {state === 'populated' && activeDNAProfile && (
          <motion.div
            key="populated"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col gap-5"
          >
            {/* Header with actions */}
            <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Brand DNA</h2>
                <p className="text-white/40 text-xs mt-0.5">
                  Extracted{' '}
                  {new Date(activeDNAProfile.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <motion.button
                onClick={handleReset}
                whileTap={{ scale: 0.97 }}
                transition={springConfig}
                className="px-3 py-1.5 rounded-glass text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              >
                Re-extract
              </motion.button>
            </motion.div>

            {/* Tone */}
            <motion.div variants={fadeUp}>
              <GlassCard className="p-5 flex items-center gap-4" hoverable={false}>
                <div
                  className={`w-12 h-12 rounded-glass bg-gradient-to-br ${TONE_COLORS[activeDNAProfile.tone]} flex-shrink-0`}
                />
                <div>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-0.5">
                    Tone Signature
                  </p>
                  <p className="text-white font-bold text-lg">
                    {TONE_LABELS[activeDNAProfile.tone]}
                  </p>
                </div>
              </GlassCard>
            </motion.div>

            {/* Summary */}
            {parseSummary(activeDNAProfile.raw_gemini_output) && (
              <motion.div variants={fadeUp}>
                <GlassCard className="p-5" hoverable={false}>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">
                    Brand Positioning
                  </p>
                  <p className="text-white/80 text-sm leading-relaxed">
                    {parseSummary(activeDNAProfile.raw_gemini_output)}
                  </p>
                </GlassCard>
              </motion.div>
            )}

            {/* Colors */}
            <motion.div variants={fadeUp}>
              <GlassCard className="p-5" hoverable={false}>
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3">
                  Brand Colors
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {activeDNAProfile.colors.map((color) => (
                    <div key={color} className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full border border-white/10 shadow-lg"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-white/50 text-xs font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>

            {/* Values + Personas side by side */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassCard className="p-5" hoverable={false}>
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3">
                  Core Values
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeDNAProfile.values.map((v) => (
                    <span
                      key={v}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-accent-primary/15 text-accent-glow border border-accent-primary/20"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-5" hoverable={false}>
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3">
                  Target Personas
                </p>
                <div className="flex flex-col gap-2">
                  {activeDNAProfile.personas.map((p, i) => (
                    <div key={p} className="flex items-start gap-2">
                      <span className="text-accent-glow text-xs mt-0.5 flex-shrink-0">
                        {i + 1}.
                      </span>
                      <span className="text-white/70 text-xs leading-relaxed">{p}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>

            {/* SWOT */}
            <motion.div variants={fadeUp}>
              <GlassCard className="p-5" hoverable={false}>
                <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-4">
                  SWOT Analysis
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-green-400 text-xs font-semibold mb-2">Strengths</p>
                    <ul className="flex flex-col gap-1.5">
                      {activeDNAProfile.swot.strengths.map((s) => (
                        <li key={s} className="flex items-start gap-1.5">
                          <span className="text-green-400/60 text-xs mt-0.5">+</span>
                          <span className="text-white/60 text-xs leading-relaxed">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-red-400 text-xs font-semibold mb-2">Weaknesses</p>
                    <ul className="flex flex-col gap-1.5">
                      {activeDNAProfile.swot.weaknesses.map((w) => (
                        <li key={w} className="flex items-start gap-1.5">
                          <span className="text-red-400/60 text-xs mt-0.5">−</span>
                          <span className="text-white/60 text-xs leading-relaxed">{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-amber-400 text-xs font-semibold mb-2">Opportunities</p>
                    <ul className="flex flex-col gap-1.5">
                      {activeDNAProfile.swot.opportunities.map((o) => (
                        <li key={o} className="flex items-start gap-1.5">
                          <span className="text-amber-400/60 text-xs mt-0.5">→</span>
                          <span className="text-white/60 text-xs leading-relaxed">{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-violet-400 text-xs font-semibold mb-2">Threats</p>
                    <ul className="flex flex-col gap-1.5">
                      {activeDNAProfile.swot.threats.map((t) => (
                        <li key={t} className="flex items-start gap-1.5">
                          <span className="text-violet-400/60 text-xs mt-0.5">⚡</span>
                          <span className="text-white/60 text-xs leading-relaxed">{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
