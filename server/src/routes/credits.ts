import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  supabaseAdmin,
  getUserById,
  updateUserCredits,
  logCreditTransaction,
} from '../services/supabaseAdmin.js'
import { getAuthUser } from '../middleware/requireAuth.js'

const deductSchema = z.object({
  amount: z.number().int().positive().max(500),
  action: z.string().min(1),
})

const topupSchema = z.object({
  package: z.enum(['starter', 'pro', 'enterprise']),
})

const TOPUP_CREDITS: Record<'starter' | 'pro' | 'enterprise', number> = {
  starter: 500,
  pro: 2000,
  enterprise: 10000,
}

export async function creditRoutes(server: FastifyInstance) {
  // GET /api/credits/balance
  server.get('/balance', async (request, reply) => {
    const { id: userId } = getAuthUser(request)

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('credits, tier')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    return reply.code(200).send({
      data: { balance: user.credits, tier: user.tier },
    })
  })

  // GET /api/credits/history
  server.get('/history', async (request, reply) => {
    const { id: userId } = getAuthUser(request)
    const query = request.query as { limit?: string }
    const limit = Math.min(Number(query.limit) || 20, 100)

    const { data: transactions, error } = await supabaseAdmin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch credit history' })
    }

    return reply.code(200).send({ data: transactions ?? [] })
  })

  // POST /api/credits/topup (stub — Stripe post-launch)
  server.post('/topup', async (request, reply) => {
    const parse = topupSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { package: pkg } = parse.data
    const credits = TOPUP_CREDITS[pkg]

    server.log.info(
      `[stub] top-up intent: package=${pkg} credits=${credits} userId=${getAuthUser(request).id}`,
    )

    return reply.code(202).send({
      message: 'Payment integration coming soon — your top-up has been logged.',
      package: pkg,
      credits,
    })
  })

  // POST /api/credits/deduct (internal — used by useCredits hook)
  server.post('/deduct', async (request, reply) => {
    const authUser = getAuthUser(request)
    const parsed = deductSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Invalid request',
        details: parsed.error.flatten(),
      })
    }

    const { amount, action } = parsed.data
    const user = await getUserById(authUser.id)

    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    if (user.credits < amount) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    const newBalance = user.credits - amount

    await updateUserCredits(authUser.id, newBalance)
    await logCreditTransaction(authUser.id, action, amount, newBalance)

    return reply.code(200).send({ credits_remaining: newBalance })
  })
}
