import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAuthUser } from '../middleware/requireAuth.js'
import {
  generateWebsite,
  mapToneToStylePreset,
} from '../services/geminiService.js'
import {
  supabaseAdmin,
  getUserById,
  updateUserCredits,
  logCreditTransaction,
} from '../services/supabaseAdmin.js'
import type { DNAProfile } from '../types/index.js'

const WEBSITE_COST = 40

const generateSchema = z.object({
  portfolioId: z.string().uuid(),
  includePortfolioContent: z.boolean().default(true),
})

export async function websiteRoutes(server: FastifyInstance) {
  // GET /api/website/html/:websiteId — registered first (static prefix beats /:portfolioId)
  server.get('/html/:websiteId', async (request, reply) => {
    const { websiteId } = request.params as { websiteId: string }
    const { id: userId } = getAuthUser(request)

    // Fetch website + ownership via portfolio join
    const { data: website } = await supabaseAdmin
      .from('websites')
      .select('id, full_html, portfolio_id')
      .eq('id', websiteId)
      .single()

    if (!website) {
      return reply.code(404).send({ error: 'Website not found' })
    }

    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id')
      .eq('id', website.portfolio_id)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    return reply.code(200).send({ data: { fullHtml: website.full_html } })
  })

  // POST /api/website/generate
  server.post('/generate', async (request, reply) => {
    const parse = generateSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { portfolioId, includePortfolioContent } = parse.data
    const { id: userId } = getAuthUser(request)

    // Fetch portfolio + ownership
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
    if (user.credits < WEBSITE_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    // Map DNA tone to style preset
    const stylePreset = mapToneToStylePreset(
      (dnaProfile as DNAProfile).tone,
    )

    // Build portfolioContent from DNA if requested
    let portfolioContent:
      | { headline?: string; tagline?: string; about?: string; services?: string[]; callToAction?: string }
      | undefined

    if (includePortfolioContent && dnaProfile.raw_gemini_output) {
      try {
        const raw = JSON.parse(dnaProfile.raw_gemini_output as string) as {
          summary?: string
          values?: string[]
        }
        portfolioContent = {
          about: raw.summary,
          services: raw.values?.slice(0, 4),
        }
      } catch {
        // non-fatal — proceed without portfolio content
      }
    }

    // Generate website via Gemini
    let result: { fullHtml: string; pageName: string }
    try {
      result = await generateWebsite({
        dnaProfile: dnaProfile as DNAProfile,
        companyName: portfolio.company_name,
        portfolioContent,
        stylePreset,
      })
    } catch (err) {
      server.log.error(err)
      return reply.code(500).send({ error: 'Failed to generate website' })
    }

    // INSERT into websites table
    const { data: website, error: insertError } = await supabaseAdmin
      .from('websites')
      .insert({
        portfolio_id: portfolioId,
        user_id: userId,
        company_name: portfolio.company_name,
        full_html: result.fullHtml,
        style_preset: stylePreset,
      })
      .select('id, style_preset, created_at')
      .single()

    if (insertError || !website) {
      server.log.error(insertError)
      return reply.code(500).send({ error: 'Failed to save website' })
    }

    // Deduct credits
    const newBalance = user.credits - WEBSITE_COST
    await updateUserCredits(userId, newBalance)
    await logCreditTransaction(userId, 'website_generate', WEBSITE_COST, newBalance)

    return reply.code(200).send({
      data: {
        fullHtml: result.fullHtml,
        stylePreset,
        websiteId: website.id as string,
      },
      credits_remaining: newBalance,
    })
  })

  // GET /api/website/:portfolioId — returns list WITHOUT full_html
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
      .from('websites')
      .select('id, style_preset, created_at')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch websites' })
    }

    return reply.code(200).send({ data: data ?? [] })
  })
}
