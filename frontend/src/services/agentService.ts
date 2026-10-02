import { supabase } from './supabaseClient'
import type { Agent, AgentLog, ApiResponse } from '../types'

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

function getWsUrl(agentId: string, token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/agent/${agentId}?token=${encodeURIComponent(token)}`
}

export async function spawnAgent(params: {
  portfolioId: string
  agentName: string
  tools: string[]
}): Promise<ApiResponse<Agent>> {
  const token = await getToken()
  const res = await fetch('/api/agents/spawn', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = (await res.json()) as ApiResponse<Agent>
  if (!res.ok) throw new Error(json.error ?? 'Failed to spawn agent')
  return json
}

export async function sendMessage(params: {
  agentId: string
  message: string
}): Promise<ApiResponse<{ response: string }>> {
  const token = await getToken()
  const res = await fetch(`/api/agents/${params.agentId}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: params.message }),
  })
  const json = (await res.json()) as ApiResponse<{ response: string }>
  if (!res.ok) throw new Error(json.error ?? 'Failed to send message')
  return json
}

export async function getAgents(
  portfolioId: string,
): Promise<ApiResponse<Agent[]>> {
  const token = await getToken()
  const res = await fetch(`/api/agents/${portfolioId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<Agent[]>
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch agents')
  return json
}

export async function terminateAgent(
  agentId: string,
): Promise<ApiResponse<{ success: boolean }>> {
  const token = await getToken()
  const res = await fetch(`/api/agents/${agentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<{ success: boolean }>
  if (!res.ok) throw new Error(json.error ?? 'Failed to terminate agent')
  return json
}

export function connectAgentStream(params: {
  agentId: string
  token: string
  onLog: (log: AgentLog) => void
  onEnd: () => void
}): () => void {
  const url = getWsUrl(params.agentId, params.token)
  const ws = new WebSocket(url)

  ws.onmessage = (event: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(event.data) as AgentLog & { type?: string }
      if (msg.type === 'end') {
        params.onEnd()
      } else {
        params.onLog(msg as AgentLog)
      }
    } catch {
      // ignore malformed messages
    }
  }

  ws.onerror = () => {
    params.onEnd()
  }

  ws.onclose = () => {
    // already handled by onerror or end message
  }

  return () => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close()
    }
  }
}
