import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAuthUser } from '../middleware/requireAuth.js'
import { generateCampaignAssets } from '../services/geminiService.js'
import {
  supabaseAdmin,
  getUserById,
  updateUserCredits,
  logCreditTransaction,
} from '../services/supabaseAdmin.js'

const CAMPAIGN_COST = 30

const platformEnum = z.enum(['instagram', 'tiktok', 'linkedin', 'email'])

const generateCampaignSchema = z.object({
  portfolioId: z.string().uuid(),
  campaignTitle: z.string().min(1).max(200),
  platforms: z.array(platformEnum).min(1).max(4),
})

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'published']),
  scheduled_for: z.string().datetime().optional(),
})

export async function campaignRoutes(server: FastifyInstance) {
  // POST /api/campaigns/generate
  server.post('/generate', async (request, reply) => {
    const parse = generateCampaignSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { portfolioId, campaignTitle, platforms } = parse.data
    const { id: userId } = getAuthUser(request)

    // Ownership check
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
    if (user.credits < CAMPAIGN_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    // Deduct optimistically
    const newBalance = user.credits - CAMPAIGN_COST
    await updateUserCredits(userId, newBalance)

    // Call Gemini
    let assets: Awaited<ReturnType<typeof generateCampaignAssets>>
    try {
      assets = await generateCampaignAssets({
        dnaProfile: dnaProfile as Parameters<typeof generateCampaignAssets>[0]['dnaProfile'],
        companyName: portfolio.company_name,
        campaignTitle,
        platforms,
      })
    } catch (err) {
      await updateUserCredits(userId, user.credits)
      server.log.error(err)
      return reply.code(500).send({ error: 'Campaign generation failed. Credits refunded.' })
    }

    // Insert campaign
    const { data: campaign, error: insertError } = await supabaseAdmin
      .from('campaigns')
      .insert({
        portfolio_id: portfolioId,
        user_id: userId,
        title: campaignTitle,
        platforms,
        assets,
        status: 'draft',
      })
      .select()
      .single()

    if (insertError || !campaign) {
      await updateUserCredits(userId, user.credits)
      server.log.error(insertError)
      return reply.code(500).send({ error: 'Failed to save campaign. Credits refunded.' })
    }

    await logCreditTransaction(userId, 'campaign_generation', CAMPAIGN_COST, newBalance)

    return reply.code(200).send({
      data: campaign,
      credits_remaining: newBalance,
    })
  })

  // GET /api/campaigns/:portfolioId
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
      .from('campaigns')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch campaigns' })
    }

    return reply.code(200).send({ data: data ?? [] })
  })

  // PATCH /api/campaigns/:campaignId/status
  server.patch('/:campaignId/status', async (request, reply) => {
    const { campaignId } = request.params as { campaignId: string }
    const { id: userId } = getAuthUser(request)

    const parse = updateStatusSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { status, scheduled_for } = parse.data

    // Verify campaign belongs to user (via portfolio)
    const { data: campaign } = await supabaseAdmin
      .from('campaigns')
      .select('id, portfolio_id')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return reply.code(404).send({ error: 'Campaign not found' })
    }

    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id')
      .eq('id', campaign.portfolio_id)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    const updatePayload: Record<string, unknown> = { status }
    if (scheduled_for) updatePayload.scheduled_for = scheduled_for

    const { data: updated, error } = await supabaseAdmin
      .from('campaigns')
      .update(updatePayload)
      .eq('id', campaignId)
      .select()
      .single()

    if (error || !updated) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to update campaign status' })
    }

    return reply.code(200).send({ data: updated })
  })
}
