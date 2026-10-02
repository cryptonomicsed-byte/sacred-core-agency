import 'dotenv/config'
import Fastify from 'fastify'
import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import { registerCors } from './plugins/cors.js'
import { registerHelmet } from './plugins/helmet.js'
import { registerJwt } from './plugins/jwt.js'
import { registerRateLimit } from './plugins/rateLimit.js'
import { authRoutes } from './routes/auth.js'
import { portfolioRoutes } from './routes/portfolios.js'
import { dnaRoutes } from './routes/dna.js'
import { campaignRoutes } from './routes/campaigns.js'
import { leadRoutes } from './routes/leads.js'
import { agentRoutes } from './routes/agents.js'
import { sonicRoutes } from './routes/sonic.js'
import { websiteRoutes } from './routes/website.js'
import { creditRoutes } from './routes/credits.js'
import { requireAuth } from './middleware/requireAuth.js'
import { openClawClient } from './services/openClawClient.js'
import { supabaseAdmin } from './services/supabaseAdmin.js'
import type { AgentLog } from './types/index.js'

const REQUIRED_ENV = [
  'JWT_SECRET',
] as const

for (const name of REQUIRED_ENV) {
  if (!process.env[name]) {
    console.error(`Missing required env var: ${name}`)
    console.error('Sacred Core cannot start without it.')
    process.exit(1)
  }
}

const server = Fastify({ logger: true })

// WebSocket server for agent log streaming (noServer = we handle upgrade manually)
const wss = new WebSocketServer({ noServer: true })

async function start() {
  // Plugins (order matters)
  await registerHelmet(server)
  await registerCors(server)
  await registerRateLimit(server)
  await registerJwt(server)

  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: {
      supabase: 'connected',
      openclaw: openClawClient.isConnected() ? 'connected' : 'offline',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
      elevenlabs: process.env.ELEVENLABS_API_KEY ? 'configured' : 'missing',
    },
  }))

  // Public routes
  server.register(authRoutes, { prefix: '/api/auth' })

  // Protected routes (requireAuth runs on every route in scope)
  server.register(async (protectedScope) => {
    protectedScope.addHook('onRequest', requireAuth)
    protectedScope.register(portfolioRoutes, { prefix: '/api/portfolios' })
    protectedScope.register(dnaRoutes, { prefix: '/api/dna' })
    protectedScope.register(campaignRoutes, { prefix: '/api/campaigns' })
    protectedScope.register(leadRoutes, { prefix: '/api/leads' })
    protectedScope.register(agentRoutes, { prefix: '/api/agents' })
    protectedScope.register(sonicRoutes, { prefix: '/api/sonic' })
    protectedScope.register(websiteRoutes, { prefix: '/api/website' })
    protectedScope.register(creditRoutes, { prefix: '/api/credits' })
  })

  // ── WebSocket upgrade handler for /ws/agent/:agentId ────────────────────────
  server.server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const rawUrl = req.url ?? ''
    const url = new URL(rawUrl, `http://localhost`)

    if (!url.pathname.startsWith('/ws/agent/')) {
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket as never, head, async (ws) => {
      const agentId = url.pathname.replace('/ws/agent/', '')
      const token = url.searchParams.get('token')

      if (!token || !agentId) {
        ws.close(4001, 'Unauthorized')
        return
      }

      // Verify JWT via Supabase
      const {
        data: { user },
        error: authError,
      } = await supabaseAdmin.auth.getUser(token)

      if (authError || !user) {
        ws.close(4001, 'Unauthorized')
        return
      }

      // Fetch agent
      const { data: agent } = await supabaseAdmin
        .from('agents')
        .select('id, session_id, portfolio_id, status')
        .eq('id', agentId)
        .single()

      if (!agent) {
        ws.close(4004, 'Agent not found')
        return
      }

      // Verify ownership
      const { data: portfolio } = await supabaseAdmin
        .from('portfolios')
        .select('id')
        .eq('id', agent.portfolio_id)
        .eq('user_id', user.id)
        .single()

      if (!portfolio) {
        ws.close(4003, 'Forbidden')
        return
      }

      if (!agent.session_id) {
        ws.close(4004, 'No active session')
        return
      }

      // Subscribe to OpenClaw log stream for this session
      const unsubscribe = openClawClient.streamLogs({
        sessionId: agent.session_id,
        onLog: (log: AgentLog) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(log))
          }
        },
        onEnd: () => {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'end' }))
            ws.close()
          }
        },
      })

      ws.on('close', () => {
        unsubscribe()
      })

      ws.on('error', () => {
        unsubscribe()
      })
    })
  })

  // ── OpenClaw connection (non-blocking) ───────────────────────────────────────
  const clawConnected = await openClawClient.connect()
  if (clawConnected) {
    server.log.info('OpenClaw daemon connected at ' + (process.env.OPENCLAW_WS_URL ?? 'ws://localhost:18789'))
  } else {
    server.log.warn(
      'OpenClaw daemon unavailable — Agent Forge will return 503 until daemon starts',
    )
  }

  const port = Number(process.env.PORT) || 4000
  await server.listen({ port, host: '0.0.0.0' })
}

// Graceful shutdown
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
for (const signal of signals) {
  process.on(signal, async () => {
    server.log.info(`Received ${signal}, shutting down gracefully…`)
    wss.close()
    await server.close()
    process.exit(0)
  })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
