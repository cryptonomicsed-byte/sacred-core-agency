import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAuthUser } from '../middleware/requireAuth.js'
import {
  openClawClient,
  buildAgentSystemPrompt,
} from '../services/openClawClient.js'
import {
  supabaseAdmin,
  getUserById,
  updateUserCredits,
  logCreditTransaction,
} from '../services/supabaseAdmin.js'
import type { AgentLog, DNAProfile } from '../types/index.js'

const SPAWN_COST = 20
const MESSAGE_COST = 10

const VALID_TOOLS = [
  'scrape',
  'email',
  'calendar',
  'post',
  'sonic_gen',
  'website_gen',
  'research',
  'analyze',
] as const

const spawnSchema = z.object({
  portfolioId: z.string().uuid(),
  agentName: z.string().min(1).max(100),
  tools: z
    .array(z.enum(VALID_TOOLS))
    .min(1)
    .max(10),
})

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
})

const statusSchema = z.object({
  status: z.enum(['idle', 'running', 'error']),
})

export async function agentRoutes(server: FastifyInstance) {
  // POST /api/agents/spawn
  server.post('/spawn', async (request, reply) => {
    // Check OpenClaw availability first
    if (!openClawClient.isConnected()) {
      return reply.code(503).send({
        error: 'Agent daemon unavailable',
        detail: 'OpenClaw is not running. Start it with: openclaw gateway --port 18789',
      })
    }

    const parse = spawnSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { portfolioId, agentName, tools } = parse.data
    const { id: userId } = getAuthUser(request)

    // Fetch portfolio + DNA
    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id, company_name, dna_profile_id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(404).send({ error: 'Portfolio not found' })
    }

    if (!portfolio.dna_profile_id) {
      return reply.code(400).send({ error: 'Extract DNA first' })
    }

    const { data: dnaProfile } = await supabaseAdmin
      .from('dna_profiles')
      .select('*')
      .eq('id', portfolio.dna_profile_id)
      .single()

    if (!dnaProfile) {
      return reply.code(400).send({ error: 'Extract DNA first' })
    }

    // Credit check
    const user = await getUserById(userId)
    if (!user) return reply.code(401).send({ error: 'User not found' })
    if (user.credits < SPAWN_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    // Generate session ID and system prompt
    const sessionId = crypto.randomUUID()
    const systemPrompt = buildAgentSystemPrompt({
      companyName: portfolio.company_name,
      dnaProfile: dnaProfile as DNAProfile,
      agentName,
      tools: tools as string[],
    })

    // Spawn agent in OpenClaw
    let spawnResult: { success: boolean; sessionId: string }
    try {
      spawnResult = await openClawClient.spawnAgent({
        sessionId,
        systemPrompt,
        tools: tools as string[],
        agentName,
      })
    } catch (err) {
      server.log.error(err)
      return reply.code(500).send({ error: 'Failed to spawn agent' })
    }

    if (!spawnResult.success) {
      return reply.code(500).send({ error: 'OpenClaw rejected spawn request' })
    }

    // Insert into agents table
    const { data: agent, error: insertError } = await supabaseAdmin
      .from('agents')
      .insert({
        portfolio_id: portfolioId,
        user_id: userId,
        name: agentName,
        tools,
        status: 'running',
        session_id: sessionId,
        logs: [],
      })
      .select()
      .single()

    if (insertError || !agent) {
      server.log.error(insertError)
      return reply.code(500).send({ error: 'Failed to save agent' })
    }

    // Deduct credits
    const newBalance = user.credits - SPAWN_COST
    await updateUserCredits(userId, newBalance)
    await logCreditTransaction(userId, 'agent_spawn', SPAWN_COST, newBalance)

    return reply.code(201).send({
      data: agent,
      credits_remaining: newBalance,
    })
  })

  // POST /api/agents/:agentId/message
  server.post('/:agentId/message', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    const { id: userId } = getAuthUser(request)

    const parse = messageSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { message } = parse.data

    // Fetch agent + ownership check via portfolio
    const { data: agent } = await supabaseAdmin
      .from('agents')
      .select('id, session_id, status, portfolio_id, logs')
      .eq('id', agentId)
      .single()

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' })
    }

    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id')
      .eq('id', agent.portfolio_id)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    if (agent.status !== 'running') {
      return reply.code(400).send({ error: 'Agent is not running' })
    }

    if (!agent.session_id) {
      return reply.code(400).send({ error: 'Agent has no active session' })
    }

    // Credit check
    const user = await getUserById(userId)
    if (!user) return reply.code(401).send({ error: 'User not found' })
    if (user.credits < MESSAGE_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    // Send message to OpenClaw
    let response: string
    try {
      response = await openClawClient.sendMessage({
        sessionId: agent.session_id,
        message,
      })
    } catch (err) {
      server.log.error(err)
      return reply.code(500).send({ error: 'Failed to send message to agent' })
    }

    // Append logs to DB
    const now = new Date().toISOString()
    const newLogs: AgentLog[] = [
      ...(agent.logs as AgentLog[]),
      { timestamp: now, level: 'info', message: `User: ${message}` },
      { timestamp: now, level: 'info', message: `Agent: ${response}` },
    ]

    await supabaseAdmin
      .from('agents')
      .update({ logs: newLogs })
      .eq('id', agentId)

    // Deduct credits
    const newBalance = user.credits - MESSAGE_COST
    await updateUserCredits(userId, newBalance)
    await logCreditTransaction(userId, 'agent_message', MESSAGE_COST, newBalance)

    return reply.code(200).send({
      data: { response },
      credits_remaining: newBalance,
    })
  })

  // GET /api/agents/:portfolioId
  server.get('/:portfolioId', async (request, reply) => {
    const { portfolioId } = request.params as { portfolioId: string }
    const { id: userId } = getAuthUser(request)

    // Ownership check
    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(404).send({ error: 'Portfolio not found' })
    }

    const { data, error } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch agents' })
    }

    return reply.code(200).send({ data: data ?? [] })
  })

  // DELETE /api/agents/:agentId
  server.delete('/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string }
    const { id: userId } = getAuthUser(request)

    // Fetch agent + ownership
    const { data: agent } = await supabaseAdmin
      .from('agents')
      .select('id, session_id, portfolio_id, status')
      .eq('id', agentId)
      .single()

    if (!agent) {
      return reply.code(404).send({ error: 'Agent not found' })
    }

    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id')
      .eq('id', agent.portfolio_id)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    // Terminate in OpenClaw if session exists
    if (agent.session_id && openClawClient.isConnected()) {
      await openClawClient.terminateAgent(agent.session_id).catch(() => {
        // non-fatal — still update DB
      })
    }

    // Mark as idle with no session
    await supabaseAdmin
      .from('agents')
      .update({ status: 'idle', session_id: null })
      .eq('id', agentId)

    return reply.code(200).send({ data: { success: true } })
  })
}
