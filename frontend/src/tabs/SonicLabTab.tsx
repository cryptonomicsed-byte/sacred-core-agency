import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Music, Share2, Trash2, Play } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { fadeUp, fadeIn, staggerContainer, springConfig } from '../lib/motion'
import { triggerHaptic, updateAppBadge, shareContent } from '../lib/webapis'
import { useWakeLock } from '../hooks/useWakeLock'
import { useCreditsStore } from '../store/creditsStore'
import * as sonicService from '../services/sonicService'
import type { Portfolio, SonicIdentity } from '../types'

const VOICE_PHRASES = [
  'Warming up the voice model...',
  'Synthesising audio...',
  'Processing vocal tone...',
  'Finalising audio track...',
]

const JINGLE_PHRASES = [
  'Composing musical elements...',
  'Building sonic identity...',
  'Layering brand frequencies...',
  'Rendering final audio...',
]

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

interface SonicLibraryItemProps {
  identity: SonicIdentity
  onShare: () => void
  onDelete: () => void
}

function SonicLibraryItem({ identity, onShare, onDelete }: SonicLibraryItemProps) {
  const [expanded, setExpanded] = useState(false)
  const isJingle = identity.duration_seconds > 10
  const icon = isJingle ? '🎵' : '🎙️'

  return (
    <div className="flex flex-col rounded-glass border border-white/8 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <span className="text-lg flex-shrink-0" aria-hidden>{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{identity.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40 font-mono">
              {identity.duration_seconds}s
            </span>
            <span className="text-white/25 text-xs">{relativeDate(identity.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <motion.button
            onClick={() => setExpanded((v) => !v)}
            whileTap={{ scale: 0.9 }}
            transition={springConfig}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-glass text-xs text-white/40 hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
            aria-label="Play"
          >
            <Play size={12} />
            <span>{expanded ? 'Hide' : 'Play'}</span>
          </motion.button>
          <motion.button
            onClick={onShare}
            whileTap={{ scale: 0.9 }}
            transition={springConfig}
            className="p-1.5 rounded-glass text-white/30 hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
            aria-label="Share"
          >
            <Share2 size={14} />
          </motion.button>
          <motion.button
            onClick={onDelete}
            whileTap={{ scale: 0.9 }}
            transition={springConfig}
            className="p-1.5 rounded-glass text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-white/8"
          >
            <div className="p-3">
              <audio
                src={identity.audio_url}
                controls
                className="w-full h-9 [&::-webkit-media-controls-panel]:bg-white/5"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface SonicLabTabProps {
  portfolio: Portfolio
}

export function SonicLabTab({ portfolio }: SonicLabTabProps) {
  const [type, setType] = useState<'voice' | 'jingle'>('voice')
  const [name, setName] = useState('')
  const [voicePrompt, setVoicePrompt] = useState('')
  const [jinglePrompt, setJinglePrompt] = useState('')
  const [selectedVoiceId, setSelectedVoiceId] = useState(DEFAULT_VOICE_ID)
  const [duration, setDuration] = useState(30)
  const [voices, setVoices] = useState<{ voice_id: string; name: string }[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [genError, setGenError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sonicIdentities, setSonicIdentities] = useState<SonicIdentity[]>([])
  const [loadingIdentities, setLoadingIdentities] = useState(true)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)

  const phraseRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const libraryTopRef = useRef<HTMLDivElement | null>(null)

  useWakeLock(isGenerating)
  const setBalance = useCreditsStore((s) => s.setBalance)
  const deductOptimistic = useCreditsStore((s) => s.deductOptimistic)

  const phrases = type === 'voice' ? VOICE_PHRASES : JINGLE_PHRASES
  const currentPrompt = type === 'voice' ? voicePrompt : jinglePrompt
  const cost = type === 'voice' ? 15 : 25

  // Load voices on mount
  useEffect(() => {
    sonicService.getVoices().then((result) => {
      const voiceList = result.data?.voices ?? []
      if (voiceList.length > 0) setVoices(voiceList)
    }).catch(() => {
      // silent — use default voice
    })
  }, [])

  // Load sonic identities on mount
  useEffect(() => {
    void loadIdentities()
  }, [portfolio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadIdentities() {
    try {
      const result = await sonicService.getSonicIdentities(portfolio.id)
      setSonicIdentities(result.data ?? [])
    } catch {
      // silent — empty state
    } finally {
      setLoadingIdentities(false)
    }
  }

  // Phrase cycling during generation
  useEffect(() => {
    if (isGenerating) {
      phraseRef.current = setInterval(() => {
        setPhraseIndex((i) => (i + 1) % phrases.length)
      }, 1400)
    }
    return () => {
      if (phraseRef.current) clearInterval(phraseRef.current)
    }
  }, [isGenerating, phrases.length])

  // Autoplay preview when URL changes
  useEffect(() => {
    if (previewUrl && previewAudioRef.current) {
      previewAudioRef.current.play().catch(() => { /* autoplay blocked — user can press play */ })
    }
  }, [previewUrl])

  async function handleGenerate() {
    if (!name.trim() || !currentPrompt.trim()) return
    setGenError(null)
    setIsGenerating(true)
    setPhraseIndex(0)
    setPreviewUrl(null)
    deductOptimistic(cost)

    try {
      const result = await sonicService.generateSonic({
        portfolioId: portfolio.id,
        name: name.trim(),
        type,
        prompt: currentPrompt.trim(),
        voiceId: type === 'voice' ? selectedVoiceId : undefined,
        // Voice uses min duration (5) so library icon detection works: 5 ≤ 10 → 🎙️
        durationSeconds: type === 'voice' ? 5 : duration,
      })

      if (!result.data) throw new Error('No sonic identity returned')

      triggerHaptic([50, 30, 50])
      if (result.credits_remaining !== undefined) setBalance(result.credits_remaining)

      setPreviewUrl(result.data.audio_url)
      setSonicIdentities((prev) => [result.data!, ...prev])
      updateAppBadge(sonicIdentities.length + 1)

      // Scroll to library top
      setTimeout(() => {
        libraryTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleDelete(id: string) {
    setIsDeletingId(id)
    setDeleteConfirmId(null)
    try {
      await sonicService.deleteSonic(id)
      setSonicIdentities((prev) => {
        const updated = prev.filter((s) => s.id !== id)
        updateAppBadge(updated.length)
        return updated
      })
      if (previewUrl) {
        const deleted = sonicIdentities.find((s) => s.id === id)
        if (deleted?.audio_url === previewUrl) setPreviewUrl(null)
      }
    } catch {
      // silent
    } finally {
      setIsDeletingId(null)
    }
  }

  async function handleShare(identity: SonicIdentity) {
    await shareContent({
      title: identity.name,
      text: 'Brand audio from Sacred Core',
      url: identity.audio_url,
    })
    triggerHaptic([30])
  }

  const canGenerate = name.trim().length > 0 && currentPrompt.trim().length >= 10

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── LEFT: Generator ── */}
      <div className="flex flex-col gap-5">
        <GlassCard className="flex flex-col gap-5 p-6 h-full" hoverable={false}>
          <div>
            <h2 className="text-lg font-bold text-white">Sonic Lab</h2>
            <p className="text-white/40 text-xs mt-0.5">Generate brand voice &amp; jingles</p>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2">
            {(['voice', 'jingle'] as const).map((t) => (
              <motion.button
                key={t}
                onClick={() => setType(t)}
                whileTap={{ scale: 0.97 }}
                transition={springConfig}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-glass text-sm font-semibold border transition-colors ${
                  type === t
                    ? 'bg-accent-primary/20 border-accent-primary/50 text-white'
                    : 'border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
                }`}
              >
                {t === 'voice' ? <Mic size={15} /> : <Music size={15} />}
                {t === 'voice' ? '🎙️ Voice' : '🎵 Jingle'}
              </motion.button>
            ))}
          </div>

          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-10 gap-6">
              {/* Dual-ring spinner */}
              <div className="relative w-14 h-14">
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
              <div className="h-6 flex items-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={phraseIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="text-white/60 text-sm font-medium"
                  >
                    {phrases[phraseIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-col gap-4"
            >
              {genError && (
                <motion.div
                  variants={fadeIn}
                  initial="initial"
                  animate="animate"
                  className="px-4 py-3 rounded-glass bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  {genError}
                </motion.div>
              )}

              {/* Name input */}
              <motion.div variants={fadeUp} className="flex flex-col gap-1.5">
                <label className="text-white/60 text-sm font-medium">
                  {type === 'voice' ? 'Voice Name' : 'Jingle Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={type === 'voice' ? 'Brand Voice, Narrator...' : 'Brand Sting, Intro Jingle...'}
                  maxLength={100}
                  className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 transition-colors text-sm"
                />
              </motion.div>

              {/* Voice-specific: voice selector */}
              {type === 'voice' && voices.length > 0 && (
                <motion.div variants={fadeUp} className="flex flex-col gap-1.5">
                  <label className="text-white/60 text-sm font-medium">Voice</label>
                  <select
                    value={selectedVoiceId}
                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white focus:outline-none focus:border-accent-primary/60 transition-colors text-sm appearance-none"
                  >
                    {voices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id} className="bg-surface-2">
                        {v.name}
                      </option>
                    ))}
                  </select>
                </motion.div>
              )}

              {/* Jingle-specific: duration slider */}
              {type === 'jingle' && (
                <motion.div variants={fadeUp} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-white/60 text-sm font-medium">Duration</label>
                    <span className="text-white/60 text-sm font-mono">{duration}s</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full accent-accent-primary h-1.5 rounded-full"
                  />
                  <div className="flex justify-between text-white/25 text-xs">
                    <span>5s</span>
                    <span>60s</span>
                  </div>
                </motion.div>
              )}

              {/* Prompt textarea */}
              <motion.div variants={fadeUp} className="flex flex-col gap-1.5">
                <label className="text-white/60 text-sm font-medium">Prompt</label>
                <textarea
                  value={currentPrompt}
                  onChange={(e) =>
                    type === 'voice'
                      ? setVoicePrompt(e.target.value.slice(0, 500))
                      : setJinglePrompt(e.target.value.slice(0, 500))
                  }
                  placeholder={
                    type === 'voice'
                      ? `A warm, confident brand introduction for ${portfolio.company_name}...`
                      : `An upbeat, energetic ${duration}-second jingle that captures the essence of...`
                  }
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 transition-colors text-sm resize-none"
                />
                <div className="flex justify-end">
                  <span
                    className={`text-xs font-mono ${
                      currentPrompt.length >= 480 ? 'text-amber-400' : 'text-white/25'
                    }`}
                  >
                    {currentPrompt.length}/500
                  </span>
                </div>
              </motion.div>

              {/* Preview (shown after generation) */}
              <AnimatePresence>
                {previewUrl && (
                  <motion.div
                    key="preview"
                    variants={fadeIn}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="flex flex-col gap-2"
                  >
                    <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
                      Latest Generation
                    </p>
                    <div className="p-3 rounded-glass bg-white/5 border border-white/8">
                      <audio
                        ref={previewAudioRef}
                        src={previewUrl}
                        controls
                        className="w-full h-9"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Generate button */}
              <motion.div variants={fadeUp}>
                <motion.button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  whileTap={{ scale: 0.97 }}
                  transition={springConfig}
                  className="w-full py-3 rounded-glass font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>⚡</span>
                  {type === 'voice' ? 'Generate Voice' : 'Generate Jingle'}
                </motion.button>
                <p className="text-center text-white/25 text-xs mt-1.5">⚡ {cost} credits</p>
              </motion.div>
            </motion.div>
          )}
        </GlassCard>
      </div>

      {/* ── RIGHT: Sonic Library ── */}
      <div className="flex flex-col gap-5">
        <GlassCard className="flex flex-col gap-4 p-6 h-full" hoverable={false}>
          <h2 className="text-lg font-bold text-white" ref={libraryTopRef}>
            Sonic Library
          </h2>

          {loadingIdentities ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                className="w-6 h-6 rounded-full border-2 border-accent-primary/50 border-t-accent-primary"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : sonicIdentities.length === 0 ? (
            <motion.div
              variants={fadeIn}
              initial="initial"
              animate="animate"
              className="flex flex-col items-center justify-center py-12 gap-3"
            >
              <p className="text-white/30 text-sm">No sonic identities yet</p>
              <p className="text-white/20 text-xs">Generate your first voice or jingle →</p>
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-col gap-3 overflow-y-auto max-h-[560px] pr-1"
            >
              {sonicIdentities.map((identity) => (
                <motion.div key={identity.id} variants={fadeUp}>
                  {isDeletingId === identity.id ? (
                    <div className="flex items-center justify-center p-4 rounded-glass border border-white/8 text-white/30 text-sm">
                      Deleting...
                    </div>
                  ) : deleteConfirmId === identity.id ? (
                    <div className="flex items-center justify-between p-4 rounded-glass border border-red-500/20 bg-red-500/5">
                      <p className="text-white/60 text-sm">Delete &quot;{identity.name}&quot;?</p>
                      <div className="flex gap-2">
                        <motion.button
                          onClick={() => void handleDelete(identity.id)}
                          whileTap={{ scale: 0.95 }}
                          transition={springConfig}
                          className="px-3 py-1 rounded-glass text-xs font-semibold text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                        >
                          Delete
                        </motion.button>
                        <motion.button
                          onClick={() => setDeleteConfirmId(null)}
                          whileTap={{ scale: 0.95 }}
                          transition={springConfig}
                          className="px-3 py-1 rounded-glass text-xs font-semibold text-white/50 border border-white/10 hover:text-white/70 transition-colors"
                        >
                          Cancel
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <SonicLibraryItem
                      identity={identity}
                      onShare={() => void handleShare(identity)}
                      onDelete={() => setDeleteConfirmId(identity.id)}
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
