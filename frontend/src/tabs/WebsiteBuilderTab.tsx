import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, ExternalLink, Download } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { fadeUp, fadeIn, staggerContainer, springConfig } from '../lib/motion'
import { triggerHaptic, updateAppBadge } from '../lib/webapis'
import { useWakeLock } from '../hooks/useWakeLock'
import { useCreditsStore } from '../store/creditsStore'
import { getDNAProfile } from '../services/dnaService'
import * as websiteService from '../services/websiteService'
import type { Portfolio, DNAProfile, WebsiteVersion } from '../types'

const GENERATE_PHRASES = [
  'Analysing brand DNA...',
  'Selecting design system...',
  'Composing hero section...',
  'Building service cards...',
  'Writing interaction scripts...',
  'Assembling final website...',
]

type StylePreset = 'glassmorphism' | 'neubrutalism' | 'claymorphism' | 'minimal' | 'bold'

const STYLE_LABELS: Record<StylePreset, string> = {
  glassmorphism: '🪟 Glassmorphism',
  neubrutalism: '🔲 Neubrutalism',
  claymorphism: '🫧 Claymorphism',
  minimal: '◻️ Minimal',
  bold: '⚡ Bold',
}

const STYLE_PILL_COLORS: Record<StylePreset, string> = {
  glassmorphism: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
  neubrutalism: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  claymorphism: 'bg-pink-500/20 border-pink-500/40 text-pink-300',
  minimal: 'bg-gray-500/20 border-gray-500/40 text-gray-300',
  bold: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
}

function toneToStylePreset(tone: DNAProfile['tone']): StylePreset {
  const map: Record<DNAProfile['tone'], StylePreset> = {
    'bold/edgy': 'neubrutalism',
    'luxury/clean': 'minimal',
    'playful/warm': 'claymorphism',
    professional: 'glassmorphism',
    experimental: 'bold',
  }
  return map[tone] ?? 'glassmorphism'
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

interface WebsiteBuilderTabProps {
  portfolio: Portfolio
}

export function WebsiteBuilderTab({ portfolio }: WebsiteBuilderTabProps) {
  const [dnaProfile, setDnaProfile] = useState<DNAProfile | null>(null)
  const [dnaLoading, setDnaLoading] = useState(true)
  const [includePortfolioContent, setIncludePortfolioContent] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [progressPct, setProgressPct] = useState(0)
  const [genError, setGenError] = useState<string | null>(null)
  const [fullHtml, setFullHtml] = useState<string | null>(null)
  const [currentStylePreset, setCurrentStylePreset] = useState<StylePreset | null>(null)
  const [versions, setVersions] = useState<WebsiteVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [loadingHtmlId, setLoadingHtmlId] = useState<string | null>(null)

  const phraseRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewSectionRef = useRef<HTMLDivElement | null>(null)

  useWakeLock(isGenerating)
  const setBalance = useCreditsStore((s) => s.setBalance)
  const deductOptimistic = useCreditsStore((s) => s.deductOptimistic)

  const stylePreset = dnaProfile ? toneToStylePreset(dnaProfile.tone) : null

  // Load DNA profile
  useEffect(() => {
    if (!portfolio.dna_profile_id) {
      setDnaLoading(false)
      return
    }
    getDNAProfile(portfolio.id).then((profile) => {
      setDnaProfile(profile)
    }).catch(() => {
      // silent — show no-DNA state
    }).finally(() => {
      setDnaLoading(false)
    })
  }, [portfolio.id, portfolio.dna_profile_id])

  // Load version history
  useEffect(() => {
    void loadVersions()
  }, [portfolio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadVersions() {
    try {
      const result = await websiteService.getWebsites(portfolio.id)
      setVersions((result.data ?? []) as WebsiteVersion[])
    } catch {
      // silent
    } finally {
      setLoadingVersions(false)
    }
  }

  // Phrase cycling during generation
  useEffect(() => {
    if (isGenerating) {
      setPhraseIndex(0)
      phraseRef.current = setInterval(() => {
        setPhraseIndex((i) => Math.min(i + 1, GENERATE_PHRASES.length - 1))
      }, 2000)
    }
    return () => {
      if (phraseRef.current) clearInterval(phraseRef.current)
    }
  }, [isGenerating])

  // Progress bar 0→95% over 12s during generation
  useEffect(() => {
    if (isGenerating) {
      setProgressPct(0)
      const increment = 95 / (12000 / 150)
      progressRef.current = setInterval(() => {
        setProgressPct((p) => Math.min(p + increment, 95))
      }, 150)
    } else {
      if (progressRef.current) clearInterval(progressRef.current)
    }
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
    }
  }, [isGenerating])

  async function handleGenerate() {
    setGenError(null)
    setIsGenerating(true)
    deductOptimistic(40)

    try {
      const result = await websiteService.generateWebsite({
        portfolioId: portfolio.id,
        includePortfolioContent,
      })

      if (!result.data) throw new Error('No website returned')

      triggerHaptic([50, 30, 50])
      if (result.credits_remaining !== undefined) setBalance(result.credits_remaining)

      setProgressPct(100)
      setFullHtml(result.data.fullHtml)
      setCurrentStylePreset(result.data.stylePreset as StylePreset)

      // Prepend new version to history
      const newVersion: WebsiteVersion = {
        id: result.data.websiteId,
        portfolio_id: portfolio.id,
        style_preset: result.data.stylePreset,
        created_at: new Date().toISOString(),
      }
      setVersions((prev) => [newVersion, ...prev])
      updateAppBadge(versions.length + 1)

      // Scroll to preview
      setTimeout(() => {
        previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
      setProgressPct(0)
    } finally {
      setIsGenerating(false)
    }
  }

  function openInNewTab() {
    if (!fullHtml) return
    const blob = new Blob([fullHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  function handleDownload() {
    if (!fullHtml) return
    websiteService.downloadWebsiteZip({ fullHtml, companyName: portfolio.company_name })
  }

  async function handleVersionLoad(versionId: string) {
    setLoadingHtmlId(versionId)
    try {
      const result = await websiteService.getWebsiteHtml(versionId)
      if (result.data) {
        setFullHtml(result.data.fullHtml)
        setCurrentStylePreset(null) // cleared — let version row show preset
        setTimeout(() => {
          previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 150)
      }
    } catch {
      // silent
    } finally {
      setLoadingHtmlId(null)
    }
  }

  async function handleVersionDownload(versionId: string) {
    setLoadingHtmlId(versionId)
    try {
      const result = await websiteService.getWebsiteHtml(versionId)
      if (result.data) {
        websiteService.downloadWebsiteZip({
          fullHtml: result.data.fullHtml,
          companyName: portfolio.company_name,
        })
      }
    } catch {
      // silent
    } finally {
      setLoadingHtmlId(null)
    }
  }

  const hasDna = !!portfolio.dna_profile_id && !dnaLoading

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="flex flex-col gap-6"
    >
      {/* ── TOP: Controls ── */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6" hoverable={false}>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-white">Website Builder</h2>
            <p className="text-white/40 text-xs mt-0.5">
              Generate a complete branded website from your portfolio DNA
            </p>
          </div>

          {/* No DNA warning */}
          {!dnaLoading && !hasDna && (
            <div className="flex items-center justify-between p-4 rounded-glass border border-amber-500/20 bg-amber-500/5 mb-4">
              <p className="text-amber-400 text-sm font-medium">
                DNA profile required — extract it first
              </p>
              <motion.button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('tab:switch', { detail: { tab: 'DNA Profile' } }),
                  )
                }
                whileTap={{ scale: 0.97 }}
                transition={springConfig}
                className="text-xs text-accent-primary font-semibold hover:text-accent-secondary transition-colors"
              >
                Extract DNA →
              </motion.button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            {/* Style preset pill */}
            <div className="flex flex-col gap-2">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
                Style Preset
              </p>
              {stylePreset ? (
                <div
                  className={`inline-flex items-center px-4 py-2 rounded-full border text-sm font-semibold ${STYLE_PILL_COLORS[stylePreset]}`}
                >
                  {STYLE_LABELS[stylePreset]}
                </div>
              ) : (
                <div className="inline-flex items-center px-4 py-2 rounded-full border border-white/10 text-sm text-white/25">
                  Awaiting DNA...
                </div>
              )}
              <p className="text-white/25 text-xs">Style auto-selected from DNA tone</p>
            </div>

            {/* Options + Generate */}
            <div className="flex flex-col gap-4 items-start sm:items-end">
              {/* Toggle */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  onClick={() => setIncludePortfolioContent((v) => !v)}
                  className={`relative w-10 h-5 rounded-full border transition-colors cursor-pointer ${
                    includePortfolioContent
                      ? 'bg-accent-primary/30 border-accent-primary/50'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <motion.div
                    animate={{ x: includePortfolioContent ? 20 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`absolute top-0.5 w-4 h-4 rounded-full transition-colors ${
                      includePortfolioContent ? 'bg-accent-primary' : 'bg-white/30'
                    }`}
                  />
                </div>
                <span className="text-white/60 text-sm group-hover:text-white/80 transition-colors select-none">
                  Include portfolio content
                </span>
              </label>

              {isGenerating ? (
                <div className="flex flex-col items-end gap-3 w-full sm:w-64">
                  {/* Phrase */}
                  <div className="h-5 flex items-center">
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={phraseIndex}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.25 }}
                        className="text-white/50 text-sm"
                      >
                        {GENERATE_PHRASES[phraseIndex]}
                      </motion.p>
                    </AnimatePresence>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full"
                      style={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <AnimatePresence>
                    {genError && (
                      <motion.p
                        key="err"
                        variants={fadeIn}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="text-red-400 text-xs text-right max-w-xs"
                      >
                        {genError}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <motion.button
                    onClick={() => {
                      triggerHaptic([40])
                      void handleGenerate()
                    }}
                    disabled={!hasDna}
                    whileTap={{ scale: 0.97 }}
                    transition={springConfig}
                    className="px-6 py-2.5 rounded-glass font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <Globe size={15} />
                    Generate Website
                  </motion.button>
                  <p className="text-white/25 text-xs">⚡ 40 credits</p>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── MIDDLE: Preview ── */}
      <motion.div variants={fadeUp} ref={previewSectionRef}>
        <GlassCard className="p-6 flex flex-col gap-4" hoverable={false}>
          {/* Preview header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-white/60 text-sm font-semibold">Preview</span>
              {currentStylePreset && (
                <span
                  className={`px-2.5 py-0.5 rounded-full border text-xs font-medium ${STYLE_PILL_COLORS[currentStylePreset]}`}
                >
                  {STYLE_LABELS[currentStylePreset]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={openInNewTab}
                disabled={!fullHtml}
                whileTap={{ scale: 0.95 }}
                transition={springConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-glass text-xs text-white/40 hover:text-white/70 border border-white/10 hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ExternalLink size={12} />
                Open in new tab
              </motion.button>
              <motion.button
                onClick={handleDownload}
                disabled={!fullHtml}
                whileTap={{ scale: 0.95 }}
                transition={springConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-glass text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Download size={12} />
                Download ZIP
              </motion.button>
            </div>
          </div>

          {/* iframe / placeholder */}
          <div className="rounded-xl overflow-hidden border border-white/8 min-h-[600px] bg-surface-2">
            {fullHtml ? (
              <iframe
                srcDoc={fullHtml}
                sandbox="allow-scripts allow-same-origin"
                className="w-full min-h-[600px] border-0"
                title="Website preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[600px] gap-4">
                <Globe size={48} className="text-white/10" />
                <p className="text-white/25 text-sm">
                  Your website preview will appear here
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* ── BOTTOM: Version History ── */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-6 flex flex-col gap-4" hoverable={false}>
          <h3 className="text-base font-semibold text-white">Generated Versions</h3>

          {loadingVersions ? (
            <div className="flex items-center justify-center py-8">
              <motion.div
                className="w-5 h-5 rounded-full border-2 border-accent-primary/50 border-t-accent-primary"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : versions.length === 0 ? (
            <motion.p
              variants={fadeIn}
              initial="initial"
              animate="animate"
              className="text-white/25 text-sm py-6 text-center"
            >
              No versions yet
            </motion.p>
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map((version) => {
                const preset = version.style_preset as StylePreset
                const isLoading = loadingHtmlId === version.id
                return (
                  <motion.div
                    key={version.id}
                    variants={fadeIn}
                    initial="initial"
                    animate="animate"
                    className="flex items-center justify-between gap-4 p-3 rounded-glass border border-white/8 hover:border-white/12 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex-shrink-0 px-2.5 py-0.5 rounded-full border text-xs font-medium ${STYLE_PILL_COLORS[preset] ?? 'bg-white/10 border-white/20 text-white/50'}`}
                      >
                        {STYLE_LABELS[preset] ?? preset}
                      </span>
                      <span className="text-white/30 text-xs">
                        {relativeDate(version.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <motion.button
                        onClick={() => void handleVersionLoad(version.id)}
                        disabled={isLoading}
                        whileTap={{ scale: 0.95 }}
                        transition={springConfig}
                        className="px-3 py-1.5 rounded-glass text-xs text-white/50 border border-white/10 hover:text-white/80 hover:border-white/20 transition-colors disabled:opacity-40"
                      >
                        {isLoading ? '...' : 'Load'}
                      </motion.button>
                      <motion.button
                        onClick={() => void handleVersionDownload(version.id)}
                        disabled={isLoading}
                        whileTap={{ scale: 0.95 }}
                        transition={springConfig}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-glass text-xs text-white/50 border border-white/10 hover:text-white/80 hover:border-white/20 transition-colors disabled:opacity-40"
                      >
                        <Download size={11} />
                        ZIP
                      </motion.button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
