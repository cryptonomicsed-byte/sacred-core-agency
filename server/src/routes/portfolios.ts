import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAuthUser } from '../middleware/requireAuth.js'
import { generatePortfolioContent } from '../services/geminiService.js'
import {
  supabaseAdmin,
  getUserById,
  updateUserCredits,
  logCreditTransaction,
} from '../services/supabaseAdmin.js'

const REPORT_COST = 30

const createPortfolioSchema = z.object({
  company_name: z.string().min(1).max(200),
  company_url: z.string().url().optional(),
  industry: z.string().optional(),
})

const generateReportSchema = z.object({
  portfolioId: z.string().uuid(),
  includeSwot: z.boolean().default(true),
  includePersonas: z.boolean().default(true),
})

export async function portfolioRoutes(server: FastifyInstance) {
  // GET /api/portfolios
  server.get('/', async (request, reply) => {
    const { id: userId } = getAuthUser(request)

    const { data, error } = await supabaseAdmin
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch portfolios' })
    }

    return reply.code(200).send({ data: data ?? [] })
  })

  // POST /api/portfolios
  server.post('/', async (request, reply) => {
    const parse = createPortfolioSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { id: userId } = getAuthUser(request)
    const { company_name, company_url, industry } = parse.data

    const { data, error } = await supabaseAdmin
      .from('portfolios')
      .insert({ user_id: userId, company_name, company_url, industry })
      .select()
      .single()

    if (error || !data) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to create portfolio' })
    }

    return reply.code(201).send({ data })
  })

  // GET /api/portfolios/:id
  server.get('/:id', async (request, reply) => {
    const { id: portfolioId } = request.params as { id: string }
    const { id: userId } = getAuthUser(request)

    const { data, error } = await supabaseAdmin
      .from('portfolios')
      .select('*')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return reply.code(404).send({ error: 'Portfolio not found' })
    }

    return reply.code(200).send({ data })
  })

  // DELETE /api/portfolios/:id
  server.delete('/:id', async (request, reply) => {
    const { id: portfolioId } = request.params as { id: string }
    const { id: userId } = getAuthUser(request)

    const { error } = await supabaseAdmin
      .from('portfolios')
      .delete()
      .eq('id', portfolioId)
      .eq('user_id', userId)

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to delete portfolio' })
    }

    return reply.code(204).send()
  })

  // POST /api/portfolios/generate-report
  server.post('/generate-report', async (request, reply) => {
    const parse = generateReportSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { portfolioId, includeSwot, includePersonas } = parse.data
    const { id: userId } = getAuthUser(request)

    // Fetch portfolio (ownership check)
    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id, company_name, dna_profile_id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(404).send({ error: 'Portfolio not found' })
    }

    // Require DNA profile
    if (!portfolio.dna_profile_id) {
      return reply.code(400).send({ error: 'Extract DNA first' })
    }

    // Fetch DNA profile
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
    if (user.credits < REPORT_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    // Deduct credits optimistically
    const newBalance = user.credits - REPORT_COST
    await updateUserCredits(userId, newBalance)

    // Call Gemini
    let content: Awaited<ReturnType<typeof generatePortfolioContent>>
    try {
      content = await generatePortfolioContent(
        dnaProfile as Parameters<typeof generatePortfolioContent>[0],
        portfolio.company_name,
      )
    } catch (err) {
      await updateUserCredits(userId, user.credits)
      server.log.error(err)
      return reply.code(500).send({ error: 'Report generation failed. Credits refunded.' })
    }

    await logCreditTransaction(userId, 'portfolio_report', REPORT_COST, newBalance)

    return reply.code(200).send({
      data: {
        ...content,
        includeSwot,
        includePersonas,
        dnaProfile,
      },
      credits_remaining: newBalance,
    })
  })
}
