import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Mic,
  ChevronDown,
  ChevronUp,
  Zap,
  Mail,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { GlassCard } from '../ui/GlassCard'
import { StatusPill } from '../ui/StatusPill'
import { useSpeechSearch } from '../../hooks/useSpeechSearch'
import { useCreditsStore } from '../../store/creditsStore'
import { staggerContainer, fadeUp } from '../../lib/motion'
import {
  searchLeads,
  analyzeLead,
  generatePitch,
  getLeads,
  updateLeadStatus,
} from '../../services/leadService'
import type { LeadSearchResult } from '../../services/leadService'
import type { Lead } from '../../types'

type StatusFilter = 'all' | 'new' | 'pitched' | 'converted'

function painScoreColor(score: number): string {
  if (score >= 80) return 'bg-red-500/20 text-red-400 border border-red-500/30'
  if (score >= 60) return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  return 'bg-green-500/20 text-green-400 border border-green-500/30'
}

function painScoreLabel(score: number): string {
  if (score >= 80) return 'High Pain'
  if (score >= 60) return 'Medium Pain'
  return 'Low Pain'
}

export function LeadsPanel() {
  // Search form state
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [industry, setIndustry] = useState('')
  const [limit, setLimit] = useState<3 | 5 | 10>(5)

  // Results state
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<LeadSearchResult[]>([])
  const [analyzingUrl, setAnalyzingUrl] = useState<string | null>(null)

  // Pipeline state
  const [leads, setLeads] = useState<Lead[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pitchingId, setPitchingId] = useState<string | null>(null)
  const [pitchError, setPitchError] = useState<string | null>(null)

  const setBalance = useCreditsStore((s) => s.setBalance)
  const deductOptimistic = useCreditsStore((s) => s.deductOptimistic)

  const { startListening, listening, transcript } = useSpeechSearch()

  // Apply speech transcript to query
  useEffect(() => {
    if (transcript) setQuery(transcript)
  }, [transcript])

  // Load pipeline on mount
  useEffect(() => {
    getLeads()
      .then((res) => setLeads(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingLeads(false))
  }, [])

  async function handleSearch() {
    if (!query.trim()) return
    setIsSearching(true)
    setSearchError(null)
    setSearchResults([])
    deductOptimistic(10)
    try {
      const res = await searchLeads({
        query: query.trim(),
        location: location.trim() || undefined,
        industry: industry.trim() || undefined,
        limit,
      })
      setSearchResults(res.data ?? [])
      if (res.credits_remaining !== undefined) setBalance(res.credits_remaining)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  async function handleAnalyze(result: LeadSearchResult) {
    setAnalyzingUrl(result.company_url)
    deductOptimistic(15)
    try {
      const res = await analyzeLead({
        companyName: result.company_name,
        companyUrl: result.company_url,
        description: result.description,
      })
      if (res.data) {
        setLeads((prev) => [res.data!, ...prev])
        setSearchResults((prev) => prev.filter((r) => r.company_url !== result.company_url))
      }
      if (res.credits_remaining !== undefined) setBalance(res.credits_remaining)
    } catch (err) {
      // restore credit display on failure
      setSearchError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzingUrl(null)
    }
  }

  async function handlePitch(lead: Lead) {
    setPitchingId(lead.id)
    setPitchError(null)
    deductOptimistic(20)
    try {
      const res = await generatePitch({ leadId: lead.id })
      if (res.data) {
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, status: 'pitched' } : l)),
        )
      }
      if (res.credits_remaining !== undefined) setBalance(res.credits_remaining)
    } catch (err) {
      setPitchError(err instanceof Error ? err.message : 'Pitch failed')
    } finally {
      setPitchingId(null)
    }
  }

  async function handleMarkConverted(lead: Lead) {
    try {
      const res = await updateLeadStatus(lead.id, 'converted')
      if (res.data) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? res.data! : l)))
      }
    } catch {}
  }

  const filteredLeads =
    statusFilter === 'all' ? leads : leads.filter((l) => l.status === statusFilter)

  const stats = {
    new: leads.filter((l) => l.status === 'new').length,
    pitched: leads.filter((l) => l.status === 'pitched').length,
    converted: leads.filter((l) => l.status === 'converted').length,
  }

  const STATUS_TABS: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'New', value: 'new' },
    { label: 'Pitched', value: 'pitched' },
    { label: 'Converted', value: 'converted' },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* ── Discover Section ── */}
      <div className="flex flex-col gap-4">
        <h2 className="text-white/70 text-xs font-semibold uppercase tracking-widest">
          Discover Leads
        </h2>

        {/* Search form */}
        <GlassCard className="p-4 flex flex-col gap-3" hoverable={false}>
          {/* Query + mic */}
          <div className="relative flex items-center">
            <Search size={15} className="absolute left-3 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. small marketing agencies in NYC…"
              className="w-full pl-9 pr-10 py-2.5 glass rounded-glass text-white placeholder-white/20 bg-transparent focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors text-sm"
            />
            <button
              onClick={startListening}
              className={`absolute right-2 p-1.5 rounded-glass transition-colors ${
                listening
                  ? 'text-accent-primary bg-accent-primary/20 animate-pulse'
                  : 'text-white/40 hover:text-accent-primary hover:bg-accent-primary/10'
              }`}
              aria-label="Voice search"
            >
              <Mic size={14} />
            </button>
          </div>

          {/* Location + industry + limit */}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (optional)"
              className="flex-1 min-w-[140px] px-3 py-2 glass rounded-glass text-white placeholder-white/20 bg-transparent focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors text-sm"
            />
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Industry (optional)"
              className="flex-1 min-w-[140px] px-3 py-2 glass rounded-glass text-white placeholder-white/20 bg-transparent focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-colors text-sm"
            />
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) as 3 | 5 | 10)}
              className="px-3 py-2 glass rounded-glass text-white bg-surface-2 border border-glass-border focus:outline-none focus:border-accent-primary text-sm"
            >
              <option value={3}>3 results</option>
              <option value={5}>5 results</option>
              <option value={10}>10 results</option>
            </select>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-glass bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-glow transition-shadow"
          >
            {isSearching ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Search size={14} />
                Search Leads · 10 cr
              </>
            )}
          </motion.button>

          {searchError && (
            <p className="text-red-400 text-xs text-center">{searchError}</p>
          )}
        </GlassCard>

        {/* Search Results */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2"
            >
              {searchResults.map((result) => (
                <motion.div key={result.company_url} variants={fadeUp}>
                  <GlassCard className="p-4 flex flex-col sm:flex-row sm:items-start gap-3" hoverable>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-white font-semibold text-sm">{result.company_name}</p>
                        <span className="text-white/30 text-xs">{result.company_url}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                          {result.industry}
                        </span>
                        <span className="text-white/30 text-xs">{result.location}</span>
                      </div>
                      <p className="text-white/50 text-xs leading-relaxed line-clamp-2">
                        {result.description}
                      </p>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAnalyze(result)}
                      disabled={analyzingUrl === result.company_url}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-glass text-xs font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {analyzingUrl === result.company_url ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Zap size={12} />
                      )}
                      Analyze · 15 cr
                    </motion.button>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Pipeline Section ── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-white/70 text-xs font-semibold uppercase tracking-widest">
            Pipeline
          </h2>

          {/* Stats */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">
              New <span className="text-white font-semibold">{stats.new}</span>
            </span>
            <span className="text-xs text-white/40">
              Pitched <span className="text-amber-400 font-semibold">{stats.pitched}</span>
            </span>
            <span className="text-xs text-white/40">
              Converted <span className="text-green-400 font-semibold">{stats.converted}</span>
            </span>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-glass text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-accent-primary/20 text-white border border-accent-primary/30'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadingLeads ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-white/30" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <GlassCard className="flex items-center justify-center py-16" hoverable={false}>
            <p className="text-white/30 text-sm text-center">
              {statusFilter === 'all'
                ? 'No leads yet — search and analyze above to populate your pipeline'
                : `No ${statusFilter} leads`}
            </p>
          </GlassCard>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-2"
          >
            {filteredLeads.map((lead) => (
              <motion.div key={lead.id} variants={fadeUp}>
                <GlassCard className="overflow-hidden" hoverable>
                  {/* Lead row */}
                  <button
                    onClick={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                  >
                    {/* Pain score badge */}
                    <span
                      className={`flex-shrink-0 inline-flex flex-col items-center justify-center w-10 h-10 rounded-glass text-xs font-bold ${painScoreColor(lead.pain_score)}`}
                    >
                      <span className="text-sm leading-none">{lead.pain_score}</span>
                    </span>

                    {/* Company info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">
                        {lead.company_name}
                      </p>
                      {lead.company_url && (
                        <p className="text-white/30 text-xs truncate">{lead.company_url}</p>
                      )}
                    </div>

                    {/* Status + expand */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusPill status={lead.status} />
                      <span className="text-white/30">
                        {expandedId === lead.id ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expandedId === lead.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 flex flex-col gap-4 border-t border-glass-border pt-4">
                          {/* Pain summary */}
                          <div>
                            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1">
                              Pain Analysis
                            </p>
                            <p className="text-white/70 text-sm leading-relaxed">
                              {lead.pain_summary}
                            </p>
                          </div>

                          {/* Weaknesses + Opportunities */}
                          {(lead.weaknesses?.length || lead.opportunities?.length) ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {lead.weaknesses && lead.weaknesses.length > 0 && (
                                <div>
                                  <p className="text-red-400/70 text-xs font-semibold uppercase tracking-wider mb-1.5">
                                    Weaknesses
                                  </p>
                                  <ul className="flex flex-col gap-1">
                                    {lead.weaknesses.map((w, i) => (
                                      <li key={i} className="text-white/60 text-xs flex items-start gap-1.5">
                                        <span className="text-red-400/50 mt-0.5">•</span>
                                        {w}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {lead.opportunities && lead.opportunities.length > 0 && (
                                <div>
                                  <p className="text-green-400/70 text-xs font-semibold uppercase tracking-wider mb-1.5">
                                    Opportunities
                                  </p>
                                  <ul className="flex flex-col gap-1">
                                    {lead.opportunities.map((o, i) => (
                                      <li key={i} className="text-white/60 text-xs flex items-start gap-1.5">
                                        <span className="text-green-400/50 mt-0.5">•</span>
                                        {o}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ) : null}

                          {/* Pain score label */}
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${painScoreColor(lead.pain_score)}`}
                            >
                              {painScoreLabel(lead.pain_score)} · {lead.pain_score}/100
                            </span>
                          </div>

                          {/* Actions */}
                          {pitchError && pitchingId === null && (
                            <p className="text-red-400 text-xs">{pitchError}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {lead.status !== 'pitched' && lead.status !== 'converted' && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handlePitch(lead)}
                                disabled={pitchingId === lead.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-glass text-xs font-semibold text-white bg-gradient-to-r from-accent-secondary to-accent-glow hover:shadow-glow transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {pitchingId === lead.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Mail size={12} />
                                )}
                                {pitchingId === lead.id ? 'Generating…' : 'Send Pitch · 20 cr'}
                              </motion.button>
                            )}

                            {lead.status !== 'converted' && (
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleMarkConverted(lead)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-glass text-xs font-semibold text-green-400 border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                              >
                                <CheckCircle size={12} />
                                Mark Converted
                              </motion.button>
                            )}

                            {lead.status === 'converted' && (
                              <span className="flex items-center gap-1.5 text-green-400 text-xs font-semibold">
                                <CheckCircle size={12} />
                                Converted
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
