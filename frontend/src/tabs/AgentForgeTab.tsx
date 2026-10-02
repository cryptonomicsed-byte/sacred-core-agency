import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Send } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { StatusPill } from '../components/ui/StatusPill'
import { fadeUp, fadeIn, scaleIn, springConfig } from '../lib/motion'
import { triggerHaptic } from '../lib/webapis'
import { useWakeLock } from '../hooks/useWakeLock'
import { useCreditsStore } from '../store/creditsStore'
import { supabase } from '../services/supabaseClient'
import * as agentService from '../services/agentService'
import type { Agent, AgentLog, Portfolio } from '../types'

// ── Tool definitions ───────────────────────────────────────────────────────────

const TOOLS = [
  { id: 'research', label: 'Research', icon: '🔍' },
  { id: 'email', label: 'Email', icon: '📧' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'post', label: 'Post', icon: '📤' },
  { id: 'scrape', label: 'Scrape', icon: '🌐' },
  { id: 'sonic_gen', label: 'Sonic Gen', icon: '🎵' },
  { id: 'website_gen', label: 'Website Gen', icon: '🏗️' },
  { id: 'analyze', label: 'Analyze', icon: '📊' },
] as const

const SPAWNING_PHRASES = [
  'Initializing agent…',
  'Loading DNA context…',
  'Connecting to OpenClaw…',
  'Agent online.',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function messageType(msg: AgentLog): 'user' | 'agent' | 'system' {
  if (msg.message.startsWith('User: ')) return 'user'
  if (msg.message.startsWith('Agent: ')) return 'agent'
  return 'system'
}

function messageContent(msg: AgentLog): string {
  if (msg.message.startsWith('User: ')) return msg.message.slice(6)
  if (msg.message.startsWith('Agent: ')) return msg.message.slice(7)
  return msg.message
}

function statusDot(status: Agent['status']): string {
  if (status === 'running') return 'bg-green-400'
  if (status === 'error') return 'bg-red-400'
  return 'bg-white/30'
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function switchToDNATab() {
  document.dispatchEvent(
    new CustomEvent('tab:switch', { detail: { tab: 'DNA Profile' } }),
  )
}

// ── AgentForgeTab ──────────────────────────────────────────────────────────────

interface AgentForgeTabProps {
  portfolio: Portfolio
}

export function AgentForgeTab({ portfolio }: AgentForgeTabProps) {
  const hasDNA = !!portfolio.dna_profile_id

  // Agents list
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)

  // Active agent + chat
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null)
  const [chatMessages, setChatMessages] = useState<AgentLog[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const [clawOffline, setClawOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [messageInput, setMessageInput] = useState('')

  // Spawn form
  const [isSpawning, setIsSpawning] = useState(false)
  const [spawningPhraseIdx, setSpawningPhraseIdx] = useState(0)
  const [agentName, setAgentName] = useState('Brand Strategist')
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(['research', 'analyze']),
  )
  const [spawnError, setSpawnError] = useState<string | null>(null)

  // Terminate confirm
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false)
  const [terminating, setTerminating] = useState(false)

  // Refs
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const disconnectRef = useRef<(() => void) | null>(null)
  const phraseRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Credits
  const setBalance = useCreditsStore((s) => s.setBalance)
  const deductOptimistic = useCreditsStore((s) => s.deductOptimistic)

  // Wake Lock — active while spawning or agent is running
  useWakeLock(isSpawning || activeAgent?.status === 'running' ? true : false)

  // Load agents on mount
  useEffect(() => {
    void loadAgents()
  }, [portfolio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAgents() {
    setLoadingAgents(true)
    try {
      const result = await agentService.getAgents(portfolio.id)
      setAgents(result.data ?? [])
    } catch {
      // silent
    } finally {
      setLoadingAgents(false)
    }
  }

  // Spawning phrase cycling
  useEffect(() => {
    if (isSpawning) {
      phraseRef.current = setInterval(() => {
        setSpawningPhraseIdx((i) => Math.min(i + 1, SPAWNING_PHRASES.length - 1))
      }, 900)
    } else {
      setSpawningPhraseIdx(0)
    }
    return () => {
      if (phraseRef.current) clearInterval(phraseRef.current)
    }
  }, [isSpawning])

  // Auto-scroll chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Connect/disconnect WS when active agent changes
  useEffect(() => {
    // Cleanup previous
    if (disconnectRef.current) {
      disconnectRef.current()
      disconnectRef.current = null
      setWsConnected(false)
    }

    if (!activeAgent || activeAgent.status !== 'running' || !activeAgent.session_id) return

    async function connectStream() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const disconnect = agentService.connectAgentStream({
        agentId: activeAgent!.id,
        token: session.access_token,
        onLog: (log) => {
          // Only show system logs from WS — user/agent conversation managed manually
          if (messageType(log) === 'system') {
            setChatMessages((prev) => [...prev, log])
          }
        },
        onEnd: () => {
          setWsConnected(false)
        },
      })

      disconnectRef.current = disconnect
      setWsConnected(true)
    }

    void connectStream()

    return () => {
      if (disconnectRef.current) {
        disconnectRef.current()
        disconnectRef.current = null
      }
    }
  }, [activeAgent?.id, activeAgent?.status, activeAgent?.session_id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectAgent(agent: Agent) {
    setActiveAgent(agent)
    setChatMessages(agent.logs as AgentLog[])
    setClawOffline(false)
    setShowTerminateConfirm(false)
  }

  function toggleTool(toolId: string) {
    setSelectedTools((prev) => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        if (next.size > 1) next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }

  async function handleSpawn() {
    if (!agentName.trim() || selectedTools.size === 0) return
    setSpawnError(null)
    setIsSpawning(true)
    setSpawningPhraseIdx(0)
    triggerHaptic([40])
    deductOptimistic(20)

    try {
      const result = await agentService.spawnAgent({
        portfolioId: portfolio.id,
        agentName: agentName.trim(),
        tools: Array.from(selectedTools),
      })

      if (!result.data) throw new Error('No agent returned')
      if (result.credits_remaining !== undefined) setBalance(result.credits_remaining)

      const newAgent = result.data
      setAgents((prev) => [newAgent, ...prev])
      handleSelectAgent(newAgent)
      setClawOffline(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to spawn agent'
      if (msg.includes('daemon unavailable') || msg.includes('503')) {
        setClawOffline(true)
      }
      setSpawnError(msg)
    } finally {
      setIsSpawning(false)
    }
  }

  async function handleSendMessage() {
    if (!messageInput.trim() || !activeAgent || sending) return

    const userMessage = messageInput.trim()
    setMessageInput('')
    setSending(true)
    deductOptimistic(10)

    // Add user message to chat
    const userLog: AgentLog = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `User: ${userMessage}`,
    }
    setChatMessages((prev) => [...prev, userLog])

    try {
      const result = await agentService.sendMessage({
        agentId: activeAgent.id,
        message: userMessage,
      })

      if (result.credits_remaining !== undefined) setBalance(result.credits_remaining)

      const agentLog: AgentLog = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Agent: ${result.data?.response ?? ''}`,
      }
      setChatMessages((prev) => [...prev, agentLog])

      // Update agent's logs in roster
      setAgents((prev) =>
        prev.map((a) =>
          a.id === activeAgent.id
            ? { ...a, logs: [...(a.logs as AgentLog[]), userLog, agentLog] }
            : a,
        ),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed'
      const errLog: AgentLog = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: msg,
      }
      setChatMessages((prev) => [...prev, errLog])
    } finally {
      setSending(false)
    }
  }

  async function handleTerminate() {
    if (!activeAgent) return
    setTerminating(true)
    try {
      await agentService.terminateAgent(activeAgent.id)
      triggerHaptic([50, 30, 50])
      const updated = { ...activeAgent, status: 'idle' as const, session_id: undefined }
      setActiveAgent(updated)
      setAgents((prev) =>
        prev.map((a) => (a.id === activeAgent.id ? updated : a)),
      )
      setWsConnected(false)
      setShowTerminateConfirm(false)
    } catch {
      // silent
    } finally {
      setTerminating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendMessage()
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_240px] gap-4 min-h-[600px]">
      {/* ── LEFT: Agent Roster ─────────────────────────────────────────────── */}
      <GlassCard className="flex flex-col gap-3 p-4" hoverable={false}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">Agents</h3>
          {!activeAgent && (
            <motion.button
              onClick={() => setActiveAgent(null)}
              whileTap={{ scale: 0.92 }}
              transition={springConfig}
              className="w-6 h-6 rounded-glass bg-accent-primary/20 text-accent-primary flex items-center justify-center hover:bg-accent-primary/30 transition-colors"
            >
              <Plus size={12} />
            </motion.button>
          )}
        </div>

        {loadingAgents ? (
          <div className="flex items-center justify-center py-8">
            <motion.div
              className="w-5 h-5 rounded-full border-2 border-accent-primary/30 border-t-accent-primary"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : agents.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-6">No agents spawned yet</p>
        ) : (
          <motion.div
            variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-1.5"
          >
            {agents.map((agent) => (
              <motion.button
                key={agent.id}
                variants={fadeUp}
                onClick={() => handleSelectAgent(agent)}
                className={`flex items-center gap-2.5 p-2.5 rounded-glass text-left transition-colors w-full ${
                  activeAgent?.id === agent.id
                    ? 'bg-accent-primary/20 border border-accent-primary/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(agent.status)} ${
                    agent.status === 'running' ? 'animate-pulse' : ''
                  }`}
                />
                <span className="text-white text-xs font-medium truncate flex-1">
                  {agent.name}
                </span>
                <span className="text-white/30 text-xs flex-shrink-0">
                  {agent.tools.length}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Spawn new agent button — shown when agent is active */}
        {activeAgent && (
          <motion.button
            onClick={() => {
              setActiveAgent(null)
              setChatMessages([])
              setWsConnected(false)
            }}
            whileTap={{ scale: 0.97 }}
            transition={springConfig}
            className="mt-auto flex items-center gap-1.5 px-2.5 py-2 rounded-glass text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <Plus size={10} /> Forge New
          </motion.button>
        )}
      </GlassCard>

      {/* ── MIDDLE: Spawn Form OR Live Chat ────────────────────────────────── */}
      <GlassCard className="flex flex-col gap-0 overflow-hidden" hoverable={false}>
        <AnimatePresence mode="wait">
          {/* ── SPAWN FORM ── */}
          {!activeAgent && (
            <motion.div
              key="spawn"
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col gap-5 p-6 h-full"
            >
              <div>
                <h2 className="text-lg font-bold text-white">Forge New Agent</h2>
                <p className="text-white/40 text-xs mt-0.5">20 credits to spawn</p>
              </div>

              {/* Offline banner */}
              {clawOffline && (
                <motion.div
                  variants={scaleIn}
                  initial="initial"
                  animate="animate"
                  className="flex flex-col gap-1.5 px-4 py-3 rounded-glass bg-amber-500/10 border border-amber-500/20"
                >
                  <p className="text-amber-400 text-xs font-semibold">
                    OpenClaw daemon offline — chat disabled
                  </p>
                  <p className="text-amber-400/60 text-xs font-mono">
                    openclaw gateway --port 18789
                  </p>
                </motion.div>
              )}

              {!hasDNA ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl">
                    🧬
                  </div>
                  <p className="text-white/50 text-sm text-center">
                    Extract DNA before forging agents.
                  </p>
                  <motion.button
                    onClick={switchToDNATab}
                    whileTap={{ scale: 0.97 }}
                    transition={springConfig}
                    className="px-4 py-2 rounded-glass text-sm font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow"
                  >
                    Extract DNA First →
                  </motion.button>
                </div>
              ) : isSpawning ? (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
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
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={spawningPhraseIdx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                      className="text-white/60 text-sm font-medium"
                    >
                      {SPAWNING_PHRASES[spawningPhraseIdx]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              ) : (
                <>
                  {spawnError && (
                    <div className="px-4 py-3 rounded-glass bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      {spawnError}
                    </div>
                  )}

                  {/* Agent name */}
                  <div className="flex flex-col gap-2">
                    <label className="text-white/60 text-sm font-medium">Agent Name</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Brand Strategist"
                      className="w-full bg-white/5 border border-white/10 rounded-glass px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 transition-colors text-sm"
                    />
                  </div>

                  {/* Tool selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-white/60 text-sm font-medium">Tools</label>
                    <div className="grid grid-cols-2 gap-2">
                      {TOOLS.map((tool) => {
                        const selected = selectedTools.has(tool.id)
                        return (
                          <motion.button
                            key={tool.id}
                            onClick={() => toggleTool(tool.id)}
                            whileTap={{ scale: 0.97 }}
                            transition={springConfig}
                            className={`flex items-center gap-2 px-3 py-2 rounded-glass text-xs font-medium border transition-colors ${
                              selected
                                ? 'bg-accent-primary/20 text-accent-glow border-accent-primary/30'
                                : 'text-white/40 border-white/10 hover:border-white/20 hover:text-white/60'
                            }`}
                          >
                            <span>{tool.icon}</span>
                            {tool.label}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>

                  <motion.button
                    onClick={handleSpawn}
                    disabled={!agentName.trim() || selectedTools.size === 0}
                    whileTap={{ scale: 0.97 }}
                    transition={springConfig}
                    className="mt-auto w-full py-3 rounded-glass font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    ⚡ Spawn Agent
                    <span className="text-white/60 text-xs font-normal ml-1">−20 credits</span>
                  </motion.button>
                </>
              )}
            </motion.div>
          )}

          {/* ── LIVE CHAT ── */}
          {activeAgent && (
            <motion.div
              key={`chat-${activeAgent.id}`}
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="flex flex-col h-full"
            >
              {/* Chat header */}
              <div className="flex items-center gap-3 p-4 border-b border-white/8">
                <span
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(activeAgent.status)} ${
                    activeAgent.status === 'running' ? 'animate-pulse' : ''
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{activeAgent.name}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {activeAgent.tools.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 rounded text-xs bg-accent-primary/15 text-accent-glow/70"
                      >
                        {t}
                      </span>
                    ))}
                    {activeAgent.tools.length > 3 && (
                      <span className="text-white/30 text-xs">+{activeAgent.tools.length - 3}</span>
                    )}
                  </div>
                </div>
                {activeAgent.status === 'running' && (
                  <motion.button
                    onClick={() => setShowTerminateConfirm(true)}
                    whileTap={{ scale: 0.95 }}
                    transition={springConfig}
                    className="px-3 py-1.5 rounded-glass text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors"
                  >
                    Terminate
                  </motion.button>
                )}
              </div>

              {/* Offline banner */}
              {clawOffline && (
                <div className="mx-4 mt-3 px-4 py-2.5 rounded-glass bg-amber-500/10 border border-amber-500/20">
                  <p className="text-amber-400 text-xs font-semibold">
                    OpenClaw daemon offline — chat disabled
                  </p>
                  <p className="text-amber-400/50 text-xs font-mono mt-0.5">
                    openclaw gateway --port 18789
                  </p>
                </div>
              )}

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
                {chatMessages.length === 0 && (
                  <p className="text-white/20 text-xs text-center py-8">
                    No messages yet. Say something to your agent.
                  </p>
                )}

                {chatMessages.map((msg, i) => {
                  const type = messageType(msg)
                  const content = messageContent(msg)

                  if (type === 'user') {
                    return (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[80%] px-4 py-2.5 rounded-glass bg-accent-primary/30 border border-accent-primary/20">
                          <p className="text-white text-sm leading-relaxed">{content}</p>
                        </div>
                      </div>
                    )
                  }

                  if (type === 'agent') {
                    return (
                      <div key={i} className="flex justify-start">
                        <div className="max-w-[80%] glass px-4 py-2.5 rounded-glass">
                          <p className="text-white/90 text-sm leading-relaxed">{content}</p>
                        </div>
                      </div>
                    )
                  }

                  // System log
                  const levelColor =
                    msg.level === 'error'
                      ? 'text-red-400'
                      : msg.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-white/30'

                  return (
                    <div key={i} className="flex justify-center">
                      <p className={`text-xs font-mono ${levelColor}`}>
                        <span className="opacity-50">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>{' '}
                        {content}
                      </p>
                    </div>
                  )
                })}

                <div ref={chatEndRef} />
              </div>

              {/* Message input */}
              <div className="p-4 border-t border-white/8">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={
                      sending ||
                      activeAgent.status !== 'running' ||
                      clawOffline
                    }
                    placeholder={
                      activeAgent.status !== 'running'
                        ? 'Agent not running'
                        : clawOffline
                          ? 'OpenClaw offline'
                          : 'Send a message…'
                    }
                    className="flex-1 bg-white/5 border border-white/10 rounded-glass px-4 py-2.5 text-white placeholder-white/20 focus:outline-none focus:border-accent-primary/60 transition-colors text-sm disabled:opacity-40"
                  />
                  <motion.button
                    onClick={() => void handleSendMessage()}
                    disabled={
                      !messageInput.trim() ||
                      sending ||
                      activeAgent.status !== 'running' ||
                      clawOffline
                    }
                    whileTap={{ scale: 0.93 }}
                    transition={springConfig}
                    className="px-4 py-2.5 rounded-glass bg-accent-primary/30 border border-accent-primary/30 text-white hover:bg-accent-primary/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <motion.div
                        className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    ) : (
                      <Send size={16} />
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* ── RIGHT: Agent Details ────────────────────────────────────────────── */}
      <GlassCard className="flex flex-col gap-4 p-4" hoverable={false}>
        <h3 className="text-white font-bold text-sm">Agent Intel</h3>

        {!activeAgent ? (
          <p className="text-white/30 text-xs">Select an agent to view details</p>
        ) : (
          <motion.div
            key={activeAgent.id}
            variants={fadeIn}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-4"
          >
            <StatusPill status={activeAgent.status} />

            {activeAgent.session_id && (
              <div>
                <p className="text-white/30 text-xs uppercase tracking-wider mb-1">Session</p>
                <p className="text-white/60 text-xs font-mono truncate">
                  {activeAgent.session_id}
                </p>
              </div>
            )}

            <div>
              <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Tools</p>
              <div className="flex flex-wrap gap-1.5">
                {activeAgent.tools.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full text-xs bg-accent-primary/15 text-accent-glow/80 border border-accent-primary/20"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-white/30 text-xs uppercase tracking-wider mb-1">Created</p>
              <p className="text-white/60 text-xs">{relativeTime(activeAgent.created_at)}</p>
            </div>

            {/* Log history */}
            <div className="flex flex-col gap-2 flex-1">
              <p className="text-white/30 text-xs uppercase tracking-wider">Log History</p>
              <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
                {(activeAgent.logs as AgentLog[]).slice(-20).map((log, i) => {
                  const levelColor =
                    log.level === 'error'
                      ? 'text-red-400'
                      : log.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-white/40'
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <span className="text-white/20 text-xs font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <p className={`text-xs font-mono leading-tight ${levelColor}`}>
                        {log.message}
                      </p>
                    </div>
                  )
                })}
                {(activeAgent.logs as AgentLog[]).length === 0 && (
                  <p className="text-white/20 text-xs">No logs yet</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </GlassCard>

      {/* ── Terminate Confirm Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showTerminateConfirm && (
          <>
            <motion.div
              key="overlay"
              variants={fadeIn}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={() => setShowTerminateConfirm(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="modal"
              variants={scaleIn}
              initial="initial"
              animate="animate"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <GlassCard className="flex flex-col gap-5 p-6 max-w-sm w-full" hoverable={false}>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-xl mx-auto mb-3">
                    ⚡
                  </div>
                  <p className="text-white font-semibold">Terminate Agent?</p>
                  <p className="text-white/40 text-sm mt-1">
                    {activeAgent?.name} will be stopped. This cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    onClick={() => setShowTerminateConfirm(false)}
                    whileTap={{ scale: 0.97 }}
                    transition={springConfig}
                    className="flex-1 py-2.5 rounded-glass text-sm font-medium text-white/50 border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={() => void handleTerminate()}
                    disabled={terminating}
                    whileTap={{ scale: 0.97 }}
                    transition={springConfig}
                    className="flex-1 py-2.5 rounded-glass text-sm font-semibold text-white bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-40"
                  >
                    {terminating ? 'Stopping…' : 'Terminate'}
                  </motion.button>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
