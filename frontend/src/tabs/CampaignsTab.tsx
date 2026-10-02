import { useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Music, Briefcase, Mail, Mic, Copy, Check, Share2 } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { StatusPill } from '../components/ui/StatusPill'
import { fadeUp, fadeIn, staggerContainer, springConfig } from '../lib/motion'
import { triggerHaptic, shareContent } from '../lib/webapis'
import { useSpeechSearch } from '../hooks/useSpeechSearch'
import { useCreditsStore } from '../store/creditsStore'
import * as campaignService from '../services/campaignService'
import type { Campaign, CampaignAsset, Portfolio } from '../types'

type Platform = 'instagram' | 'tiktok' | 'linkedin' | 'email'

const PLATFORMS: { id: Platform; label: string; Icon: ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'instagram', label: 'Instagram', Icon: Camera },
  { id: 'tiktok', label: 'TikTok', Icon: Music },
  { id: 'linkedin', label: 'LinkedIn', Icon: Briefcase },
  { id: 'email', label: 'Email', Icon: Mail },
]

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: 'bg-pink-500/20 text-pink-400 border-pink-500/20',
  tiktok: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20',
  linkedin: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  email: 'bg-amber-500/20 text-amber-400 border-amber-500/20',
}

const LOADING_PHRASES = [
  'Writing Instagram copy…',
  'Crafting TikTok hook…',
  'Building LinkedIn post…',
  'Composing email sequence…',
  'Packaging campaign assets…',
]

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function switchToDNATab() {
  document.dispatchEvent(new CustomEvent('tab:switch', { detail: { tab: 'DNA Profile' } }))
}

interface AssetCardProps {
  asset: CampaignAsset
  campaignTitle: string
}

function AssetCard({ asset, campaignTitle }: AssetCardProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard.writeText(asset.content)
    triggerHaptic([30])
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleShare() {
    void shareContent({
      title: `${campaignTitle} — ${asset.platform}`,
      text: asset.content,
    })
    triggerHaptic([30])
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-glass bg-white/5 border border-white/5">
      <div className="flex items-center justify-between">
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PLATFORM_COLORS[asset.platform as Platform] ?? 'bg-white/10 text-white/50'}`}
        >
          {asset.platform}
        </span>
        <div className="flex items-center gap-1">
          <motion.button
            onClick={handleShare}
            whileTap={{ scale: 0.92 }}
            transition={springConfig}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-glass text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <Share2 size={12} />
            Share
          </motion.button>
          <motion.button
            onClick={handleCopy}
            whileTap={{ scale: 0.92 }}
            transition={springConfig}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-glass text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </motion.button>
        </div>
      </div>

      <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{asset.content}</p>

      {asset.hashtags && asset.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {asset.hashtags.map((tag) => (
            <span key={tag} className="text-accent-glow text-xs">
              #{tag.replace(/^#/, '')}
            </span>
          ))}
        </div>
      )}

      {asset.mediaDescription && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-1">Visual Brief</p>
          <p className="text-white/50 text-xs leading-relaxed italic">{asset.mediaDescription}</p>
        </div>
      )}
    </div>
  )
}

interface CampaignRowProps {
  campaign: Campaign
  expanded: boolean
  onToggle: () => void
  onStatusChange: (status: Campaign['status'], scheduledFor?: string) => void
}

function CampaignRow({ campaign, expanded, onToggle, onStatusChange }: CampaignRowProps) {
  const [activeAssetPlatform, setActiveAssetPlatform] = useState<string>(
    campaign.assets[0]?.platform ?? '',
  )
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')

  const activeAsset = campaign.assets.find((a) => a.platform === activeAssetPlatform)

  return (
    <div className="flex flex-col rounded-glass border border-white/8 overflow-hidden">
      {/* Row header */}
      <button
        onClick={onToggle}
        className="flex items-center gap-3 p-4 hover:bg-white/3 transition-colors text-left w-full"
      >
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{campaign.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {campaign.platforms.map((p) => (
              <span
                key={p}
                className={`px-1.5 py-0.5 rounded text-xs font-medium border ${PLATFORM_COLORS[p as Platform] ?? ''}`}
              >
                {p}
              </span>
            ))}
            <span className="text-white/30 text-xs">{relativeDate(campaign.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusPill status={campaign.status} />
          <span className="text-white/30 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded asset view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/8"
          >
            <div className="p-4 flex flex-col gap-4">
              {/* Platform tabs */}
              {campaign.assets.length > 1 && (
                <div className="flex gap-1 overflow-x-auto">
                  {campaign.assets.map((asset) => (
                    <button
                      key={asset.platform}
                      onClick={() => setActiveAssetPlatform(asset.platform)}
                      className={`px-3 py-1.5 rounded-glass text-xs font-medium whitespace-nowrap transition-colors ${
                        activeAssetPlatform === asset.platform
                          ? 'bg-accent-primary/20 text-accent-primary'
                          : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {asset.platform}
                    </button>
                  ))}
                </div>
              )}

              {/* Asset content */}
              {activeAsset && (
                <AssetCard asset={activeAsset} campaignTitle={campaign.title} />
              )}

              {/* Status actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {campaign.status !== 'published' && (
                  <motion.button
                    onClick={() => onStatusChange('published')}
                    whileTap={{ scale: 0.97 }}
                    transition={springConfig}
                    className="px-3 py-1.5 rounded-glass text-xs font-semibold text-white bg-green-500/20 border border-green-500/20 hover:bg-green-500/30 transition-colors"
                  >
                    Mark Published
                  </motion.button>
                )}
                {campaign.status !== 'scheduled' && (
                  <motion.button
                    onClick={() => setShowScheduler((v) => !v)}
                    whileTap={{ scale: 0.97 }}
                    transition={springConfig}
                    className="px-3 py-1.5 rounded-glass text-xs font-semibold text-white bg-amber-500/20 border border-amber-500/20 hover:bg-amber-500/30 transition-colors"
                  >
                    Schedule
                  </motion.button>
                )}
              </div>

              {/* Scheduler */}
              <AnimatePresence>
                {showScheduler && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-glass px-3 py-1.5 text-white text-xs focus:outline-none focus:border-accent-primary/60 transition-colors"
                    />
                    <motion.button
                      onClick={() => {
                        if (scheduledFor) {
                          onStatusChange('scheduled', new Date(scheduledFor).toISOString())
                          setShowScheduler(false)
                        }
                      }}
                      whileTap={{ scale: 0.97 }}
                      transition={springConfig}
                      disabled={!scheduledFor}
                      className="px-3 py-1.5 rounded-glass text-xs font-semibold text-white bg-accent-primary/20 border border-accent-primary/20 hover:bg-accent-primary/30 transition-colors disabled:opacity-40"
                    >
                      Confirm
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface CampaignsTabProps {
  portfolio: Portfolio
}

export function CampaignsTab({ portfolio }: CampaignsTabProps) {
  const hasDNA = !!portfolio.dna_profile_id
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [campaignTitle, setCampaignTitle] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set(['instagram']))
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const phraseRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const newCampaignRef = useRef<HTMLDivElement | null>(null)

  const setBalance = useCreditsStore((s) => s.setBalance)
  const deductOptimistic = useCreditsStore((s) => s.deductOptimistic)
  const { listening, transcript, startListening, stopListening } = useSpeechSearch()

  // Apply speech transcript to campaign title
  useEffect(() => {
    if (transcript) setCampaignTitle(transcript)
  }, [transcript])

  // Phrase cycling during generation
  useEffect(() => {
    if (generating) {
      phraseRef.current = setInterval(() => {
        setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length)
      }, 1400)
    }
    return () => {
      if (phraseRef.current) clearInterval(phraseRef.current)
    }
  }, [generating])

  // Load campaigns on mount
  useEffect(() => {
    if (!hasDNA) {
      setLoadingCampaigns(false)
      return
    }
    void loadCampaigns()
  }, [portfolio.id, hasDNA]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCampaigns() {
    try {
      const result = await campaignService.getCampaigns(portfolio.id)
      setCampaigns(result.data ?? [])
    } catch {
      // silent — show empty state
    } finally {
      setLoadingCampaigns(false)
    }
  }

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) {
        if (next.size > 1) next.delete(platform)
      } else {
        next.add(platform)
      }
      return next
    })
  }

  async function handleGenerate() {
    if (!campaignTitle.trim() || selectedPlatforms.size === 0) return
    setGenError(null)
    setGenerating(true)
    setPhraseIndex(0)
    deductOptimistic(30)

    try {
      const result = await campaignService.generateCampaign({
        portfolioId: portfolio.id,
        campaignTitle: campaignTitle.trim(),
        platforms: Array.from(selectedPlatforms),
      })
      if (!result.data) throw new Error('No campaign returned')
      triggerHaptic([50, 30, 50])
      if (result.credits_remaining !== undefined) setBalance(result.credits_remaining)
      setCampaigns((prev) => [result.data!, ...prev])
      setExpandedId(result.data.id)
      setCampaignTitle('')
      // Scroll to new campaign
      setTimeout(() => {
        newCampaignRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleStatusChange(
    campaignId: string,
    status: Campaign['status'],
    scheduledFor?: string,
  ) {
    try {
      const result = await campaignService.updateCampaignStatus({
        campaignId,
        status,
        scheduledFor,
      })
      if (result.data) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === campaignId ? result.data! : c)),
        )
      }
    } catch {
      // silent
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── LEFT: Campaign Generator ── */}
      <div className="flex flex-col gap-5">
        <GlassCard className="flex flex-col gap-5 p-6 h-full" hoverable={false}>
          <div>
            <h2 className="text-lg font-bold text-white">Campaign Generator</h2>
            <p className="text-white/40 text-xs mt-0.5">30 credits per campaign</p>
          </div>

          {!hasDNA ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl">
                🧬
              </div>
              <p className="text-white/50 text-sm text-center">Extract DNA before generating campaigns.</p>
              <motion.button
                onClick={switchToDNATab}
                whileTap={{ scale: 0.97 }}
                transition={springConfig}
                className="px-4 py-2 rounded-glass text-sm font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow"
              >
                Extract DNA First →
              </motion.button>
            </div>
          ) : generating ? (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
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
                    {LOADING_PHRASES[phraseIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <>
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

              {/* Campaign title with speech */}
              <div className="flex flex-col gap-2">
                <label className="text-white/60 text-sm font-medium">Campaign Title</label>
                <div className="relative">
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="e.g. Summer Launch 2025"
                    className="w-full pr-10 bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 transition-colors text-sm"
                  />
                  <button
                    onClick={listening ? stopListening : startListening}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                      listening
                        ? 'text-accent-primary animate-pulse'
                        : 'text-white/30 hover:text-accent-primary'
                    }`}
                    aria-label="Voice input"
                  >
                    <Mic size={16} />
                  </button>
                </div>
              </div>

              {/* Platform selection */}
              <div className="flex flex-col gap-2">
                <label className="text-white/60 text-sm font-medium">Platforms</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map(({ id, label, Icon }) => {
                    const selected = selectedPlatforms.has(id)
                    return (
                      <motion.button
                        key={id}
                        onClick={() => togglePlatform(id)}
                        whileTap={{ scale: 0.97 }}
                        transition={springConfig}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-glass text-sm font-medium border transition-colors ${
                          selected
                            ? `${PLATFORM_COLORS[id]} border-opacity-100`
                            : 'text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              <motion.button
                onClick={handleGenerate}
                disabled={!campaignTitle.trim() || selectedPlatforms.size === 0}
                whileTap={{ scale: 0.97 }}
                transition={springConfig}
                className="w-full py-3 rounded-glass font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>⚡</span> Generate Campaign
                <span className="text-white/60 text-xs font-normal ml-1">−30 credits</span>
              </motion.button>
            </>
          )}
        </GlassCard>
      </div>

      {/* ── RIGHT: Campaign History ── */}
      <div className="flex flex-col gap-5">
        <GlassCard className="flex flex-col gap-4 p-6 h-full" hoverable={false}>
          <h2 className="text-lg font-bold text-white">Campaign History</h2>

          {loadingCampaigns ? (
            <div className="flex items-center justify-center py-12">
              <motion.div
                className="w-6 h-6 rounded-full border-2 border-accent-primary/50 border-t-accent-primary"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : campaigns.length === 0 ? (
            <motion.div
              variants={fadeIn}
              initial="initial"
              animate="animate"
              className="flex flex-col items-center justify-center py-12 gap-3"
            >
              <p className="text-white/30 text-sm">No campaigns yet</p>
              <p className="text-white/20 text-xs">Generate your first campaign →</p>
            </motion.div>
          ) : (
            <motion.div
              ref={newCampaignRef}
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="flex flex-col gap-3 overflow-y-auto max-h-[600px] pr-1"
            >
              {campaigns.map((campaign) => (
                <motion.div key={campaign.id} variants={fadeUp}>
                  <CampaignRow
                    campaign={campaign}
                    expanded={expandedId === campaign.id}
                    onToggle={() =>
                      setExpandedId((prev) => (prev === campaign.id ? null : campaign.id))
                    }
                    onStatusChange={(status, scheduledFor) =>
                      handleStatusChange(campaign.id, status, scheduledFor)
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </GlassCard>
      </div>
    </div>
  )
}
