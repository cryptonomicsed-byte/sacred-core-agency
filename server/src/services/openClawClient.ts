import WebSocket from 'ws'
import type { AgentLog, DNAProfile } from '../types/index.js'

interface PendingResolver {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface SpawnParams {
  sessionId: string
  systemPrompt: string
  tools: string[]
  agentName: string
}

interface MessageParams {
  sessionId: string
  message: string
}

interface StreamLogsParams {
  sessionId: string
  onLog: (log: AgentLog) => void
  onEnd: () => void
}

class OpenClawClient {
  private ws: WebSocket | null = null
  private url: string
  private pending = new Map<string, PendingResolver>()
  private logHandlers = new Map<
    string,
    { onLog: (log: AgentLog) => void; onEnd: () => void }
  >()

  constructor() {
    this.url = process.env.OPENCLAW_WS_URL ?? 'ws://localhost:18789'
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        ws.terminate()
        resolve(false)
      }, 3000)

      const ws = new WebSocket(this.url)

      ws.once('open', () => {
        clearTimeout(timer)
        this.ws = ws
        this.attachMessageHandler()
        resolve(true)
      })

      ws.once('error', () => {
        clearTimeout(timer)
        resolve(false)
      })
    })
  }

  private attachMessageHandler() {
    if (!this.ws) return

    this.ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>
      } catch {
        return
      }

      const sessionId = msg.session_id as string | undefined
      const type = msg.type as string | undefined

      if (!type || !sessionId) return

      if (type === 'ack') {
        const key = `${sessionId}:spawn`
        const pending = this.pending.get(key)
        if (pending) {
          clearTimeout(pending.timer)
          this.pending.delete(key)
          pending.resolve({ success: msg.success === true, sessionId })
        }
      } else if (type === 'response') {
        const key = `${sessionId}:message`
        const pending = this.pending.get(key)
        if (pending) {
          clearTimeout(pending.timer)
          this.pending.delete(key)
          pending.resolve(msg.content as string ?? '')
        }
      } else if (type === 'log') {
        const handler = this.logHandlers.get(sessionId)
        if (handler) {
          handler.onLog({
            timestamp: (msg.timestamp as string) ?? new Date().toISOString(),
            level: (msg.level as AgentLog['level']) ?? 'info',
            message: (msg.message as string) ?? '',
          })
        }
      } else if (type === 'end') {
        const handler = this.logHandlers.get(sessionId)
        if (handler) {
          handler.onEnd()
          this.logHandlers.delete(sessionId)
        }
      }
    })

    this.ws.on('close', () => {
      // Reject all pending requests
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer)
        pending.reject(new Error('OpenClaw connection closed'))
      }
      this.pending.clear()
    })
  }

  async spawnAgent(
    params: SpawnParams,
  ): Promise<{ success: boolean; sessionId: string }> {
    if (!this.ws || this.ws.readyState !== 1 /* OPEN */) {
      throw new Error('OpenClaw not connected')
    }

    return new Promise((resolve, reject) => {
      const key = `${params.sessionId}:spawn`
      const timer = setTimeout(() => {
        this.pending.delete(key)
        reject(new Error('Spawn timeout after 5s'))
      }, 5000)

      this.pending.set(key, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      })

      this.ws!.send(
        JSON.stringify({
          type: 'spawn',
          session_id: params.sessionId,
          system_prompt: params.systemPrompt,
          tools: params.tools,
          name: params.agentName,
        }),
      )
    })
  }

  async sendMessage(params: MessageParams): Promise<string> {
    if (!this.ws || this.ws.readyState !== 1 /* OPEN */) {
      throw new Error('OpenClaw not connected')
    }

    return new Promise((resolve, reject) => {
      const key = `${params.sessionId}:message`
      const timer = setTimeout(() => {
        this.pending.delete(key)
        reject(new Error('Message timeout after 30s'))
      }, 30000)

      this.pending.set(key, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
      })

      this.ws!.send(
        JSON.stringify({
          type: 'message',
          session_id: params.sessionId,
          content: params.message,
        }),
      )
    })
  }

  streamLogs(params: StreamLogsParams): () => void {
    this.logHandlers.set(params.sessionId, {
      onLog: params.onLog,
      onEnd: params.onEnd,
    })
    return () => {
      this.logHandlers.delete(params.sessionId)
    }
  }

  async terminateAgent(sessionId: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1 /* OPEN */) return
    this.ws.send(JSON.stringify({ type: 'terminate', session_id: sessionId }))
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1 /* OPEN */
  }
}

export const openClawClient = new OpenClawClient()

// ─── System Prompt Builder ─────────────────────────────────────────────────────

export function buildAgentSystemPrompt(params: {
  companyName: string
  dnaProfile: DNAProfile
  agentName: string
  tools: string[]
}): string {
  const { companyName, dnaProfile, agentName, tools } = params

  let summary = dnaProfile.raw_gemini_output
  try {
    const parsed = JSON.parse(dnaProfile.raw_gemini_output) as { summary?: string }
    if (parsed.summary) summary = parsed.summary
  } catch {
    // use raw_gemini_output as-is
  }

  return `You are ${agentName}, an autonomous AI agent for ${companyName}.

Brand DNA:
- Tone: ${dnaProfile.tone}
- Core Values: ${dnaProfile.values.join(', ')}
- Target Personas: ${dnaProfile.personas.join('; ')}
- Brand Summary: ${summary}

Available Tools: ${tools.join(', ')}

Always act in alignment with the brand's tone and values. Be concise, strategic, and precise.`
}
