import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAuthUser } from '../middleware/requireAuth.js'
import { extractDNA } from '../services/geminiService.js'
import {
  supabaseAdmin,
  getUserById,
  updateUserCredits,
  logCreditTransaction,
} from '../services/supabaseAdmin.js'

const DNA_COST = 50

const extractBodySchema = z.object({
  portfolioId: z.string().uuid(),
  companyName: z.string().min(1).max(200),
  companyUrl: z.string().url().optional(),
})

export async function dnaRoutes(server: FastifyInstance) {
  // POST /api/dna/extract
  server.post('/extract', async (request, reply) => {
    const parse = extractBodySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { portfolioId, companyName, companyUrl } = parse.data
    const { id: userId } = getAuthUser(request)

    // Verify portfolio belongs to this user
    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(404).send({ error: 'Portfolio not found' })
    }

    // Credit check
    const user = await getUserById(userId)
    if (!user) return reply.code(401).send({ error: 'User not found' })
    if (user.credits < DNA_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    // Optimistically deduct credits before Gemini call
    const newBalance = user.credits - DNA_COST
    await updateUserCredits(userId, newBalance)

    // Call Gemini
    let dnaData: Awaited<ReturnType<typeof extractDNA>>
    try {
      dnaData = await extractDNA({ companyName, companyUrl })
    } catch (err) {
      // Refund on failure
      await updateUserCredits(userId, user.credits)
      server.log.error(err)
      return reply.code(500).send({ error: 'DNA extraction failed. Credits refunded.' })
    }

    // Insert into dna_profiles
    const { data: dnaProfile, error: insertError } = await supabaseAdmin
      .from('dna_profiles')
      .insert({
        portfolio_id: portfolioId,
        tone: dnaData.tone,
        colors: dnaData.colors,
        values: dnaData.values,
        personas: dnaData.personas,
        swot: dnaData.swot,
        raw_gemini_output: JSON.stringify(dnaData),
      })
      .select()
      .single()

    if (insertError || !dnaProfile) {
      // Refund on DB failure
      await updateUserCredits(userId, user.credits)
      server.log.error(insertError)
      return reply.code(500).send({ error: 'Failed to save DNA profile. Credits refunded.' })
    }

    // Link profile to portfolio
    await supabaseAdmin
      .from('portfolios')
      .update({ dna_profile_id: dnaProfile.id })
      .eq('id', portfolioId)

    // Log credit transaction
    await logCreditTransaction(userId, 'dna_extraction', DNA_COST, newBalance)

    return reply.code(200).send({
      data: dnaProfile,
      credits_remaining: newBalance,
    })
  })

  // GET /api/dna/:portfolioId
  server.get('/:portfolioId', async (request, reply) => {
    const { portfolioId } = request.params as { portfolioId: string }
    const { id: userId } = getAuthUser(request)

    // Verify ownership and get dna_profile_id
    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id, dna_profile_id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(404).send({ error: 'Portfolio not found' })
    }

    if (!portfolio.dna_profile_id) {
      return reply.code(200).send({ data: null })
    }

    const { data: dnaProfile, error } = await supabaseAdmin
      .from('dna_profiles')
      .select('*')
      .eq('id', portfolio.dna_profile_id)
      .single()

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch DNA profile' })
    }

    return reply.code(200).send({ data: dnaProfile ?? null })
  })
}
