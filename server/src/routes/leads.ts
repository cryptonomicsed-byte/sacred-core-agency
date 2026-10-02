import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAuthUser } from '../middleware/requireAuth.js'
import {
  searchLeads,
  analyzeLead,
  generatePitch,
} from '../services/geminiService.js'
import {
  supabaseAdmin,
  getUserById,
  updateUserCredits,
  logCreditTransaction,
} from '../services/supabaseAdmin.js'

const SEARCH_COST = 10
const ANALYZE_COST = 15
const PITCH_COST = 20

const searchBodySchema = z.object({
  query: z.string().min(1).max(500),
  location: z.string().optional(),
  industry: z.string().optional(),
  limit: z.number().int().min(1).max(10).optional(),
})

const analyzeBodySchema = z.object({
  companyName: z.string().min(1).max(200),
  companyUrl: z.string().min(1).max(500),
  description: z.string().min(1).max(1000),
})

const pitchBodySchema = z.object({
  leadId: z.string().uuid(),
  agencyName: z.string().optional(),
})

const closeBodySchema = z.object({
  closingId: z.string().uuid(),
})

const statusBodySchema = z.object({
  status: z.enum(['new', 'pitched', 'converted']),
})

export async function leadRoutes(server: FastifyInstance) {
  // POST /api/leads/search — ephemeral, 10 credits
  server.post('/search', async (request, reply) => {
    const parse = searchBodySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { id: userId } = getAuthUser(request)
    const user = await getUserById(userId)
    if (!user) return reply.code(401).send({ error: 'User not found' })
    if (user.credits < SEARCH_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    const newBalance = user.credits - SEARCH_COST
    await updateUserCredits(userId, newBalance)

    let results: Awaited<ReturnType<typeof searchLeads>>
    try {
      results = await searchLeads(parse.data)
    } catch (err) {
      await updateUserCredits(userId, user.credits)
      server.log.error(err)
      return reply.code(500).send({ error: 'Lead search failed. Credits refunded.' })
    }

    await logCreditTransaction(userId, 'lead_search', SEARCH_COST, newBalance)

    return reply.code(200).send({ data: results, credits_remaining: newBalance })
  })

  // POST /api/leads/analyze — saves to DB, 15 credits
  server.post('/analyze', async (request, reply) => {
    const parse = analyzeBodySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { companyName, companyUrl, description } = parse.data
    const { id: userId } = getAuthUser(request)
    const user = await getUserById(userId)
    if (!user) return reply.code(401).send({ error: 'User not found' })
    if (user.credits < ANALYZE_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    const newBalance = user.credits - ANALYZE_COST
    await updateUserCredits(userId, newBalance)

    let analysis: Awaited<ReturnType<typeof analyzeLead>>
    try {
      analysis = await analyzeLead({ companyName, companyUrl, description })
    } catch (err) {
      await updateUserCredits(userId, user.credits)
      server.log.error(err)
      return reply.code(500).send({ error: 'Lead analysis failed. Credits refunded.' })
    }

    const { data: lead, error: insertError } = await supabaseAdmin
      .from('leads')
      .insert({
        user_id: userId,
        company_name: companyName,
        company_url: companyUrl,
        pain_score: analysis.pain_score,
        pain_summary: analysis.pain_summary,
        weaknesses: analysis.weaknesses,
        opportunities: analysis.opportunities,
        status: 'new',
      })
      .select()
      .single()

    if (insertError || !lead) {
      await updateUserCredits(userId, user.credits)
      server.log.error(insertError)
      return reply.code(500).send({ error: 'Failed to save lead. Credits refunded.' })
    }

    await logCreditTransaction(userId, 'lead_analyze', ANALYZE_COST, newBalance)

    return reply.code(200).send({ data: lead, credits_remaining: newBalance })
  })

  // POST /api/leads/pitch — generates pitch email, 20 credits
  server.post('/pitch', async (request, reply) => {
    const parse = pitchBodySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { leadId, agencyName } = parse.data
    const { id: userId } = getAuthUser(request)

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('user_id', userId)
      .single()

    if (!lead) return reply.code(404).send({ error: 'Lead not found' })

    const user = await getUserById(userId)
    if (!user) return reply.code(401).send({ error: 'User not found' })
    if (user.credits < PITCH_COST) {
      return reply.code(402).send({
        error: 'Insufficient credits',
        credits_remaining: user.credits,
      })
    }

    const newBalance = user.credits - PITCH_COST
    await updateUserCredits(userId, newBalance)

    let pitch: Awaited<ReturnType<typeof generatePitch>>
    try {
      pitch = await generatePitch({
        companyName: lead.company_name,
        companyUrl: lead.company_url ?? '',
        painSummary: lead.pain_summary ?? '',
        weaknesses: (lead.weaknesses as string[]) ?? [],
        opportunities: (lead.opportunities as string[]) ?? [],
        agencyName,
      })
    } catch (err) {
      await updateUserCredits(userId, user.credits)
      server.log.error(err)
      return reply.code(500).send({ error: 'Pitch generation failed. Credits refunded.' })
    }

    const { data: closing, error: closingError } = await supabaseAdmin
      .from('closings')
      .insert({
        lead_id: leadId,
        user_id: userId,
        email_subject: pitch.subject,
        email_body: pitch.body,
        status: 'draft',
      })
      .select()
      .single()

    if (closingError || !closing) {
      await updateUserCredits(userId, user.credits)
      server.log.error(closingError)
      return reply.code(500).send({ error: 'Failed to save pitch. Credits refunded.' })
    }

    await supabaseAdmin
      .from('leads')
      .update({ status: 'pitched' })
      .eq('id', leadId)

    await logCreditTransaction(userId, 'lead_pitch', PITCH_COST, newBalance)

    return reply.code(200).send({
      data: { closing, leadId, status: 'pitched' },
      credits_remaining: newBalance,
    })
  })

  // POST /api/leads/close — stub send, updates closing + lead status
  server.post('/close', async (request, reply) => {
    const parse = closeBodySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { closingId } = parse.data
    const { id: userId } = getAuthUser(request)

    const { data: closing } = await supabaseAdmin
      .from('closings')
      .select('*, leads!inner(user_id)')
      .eq('id', closingId)
      .eq('user_id', userId)
      .single()

    if (!closing) return reply.code(404).send({ error: 'Closing not found' })

    await supabaseAdmin
      .from('closings')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', closingId)

    await supabaseAdmin
      .from('leads')
      .update({ status: 'converted' })
      .eq('id', closing.lead_id)

    // TODO post-launch: integrate Nodemailer/SendGrid to send email_body to prospect
    server.log.info(`[stub] pitch email logged for closing ${closingId}`)

    return reply.code(200).send({ data: { success: true } })
  })

  // GET /api/leads — list user's leads ordered by pain_score DESC
  server.get('/', async (request, reply) => {
    const { id: userId } = getAuthUser(request)

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .order('pain_score', { ascending: false })

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch leads' })
    }

    return reply.code(200).send({ data: leads ?? [] })
  })

  // PATCH /api/leads/:leadId/status
  server.patch('/:leadId/status', async (request, reply) => {
    const { leadId } = request.params as { leadId: string }
    const parse = statusBodySchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { id: userId } = getAuthUser(request)

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .update({ status: parse.data.status })
      .eq('id', leadId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error || !lead) {
      return reply.code(404).send({ error: 'Lead not found' })
    }

    return reply.code(200).send({ data: lead })
  })

  // GET /api/leads/:leadId/closings
  server.get('/:leadId/closings', async (request, reply) => {
    const { leadId } = request.params as { leadId: string }
    const { id: userId } = getAuthUser(request)

    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('user_id', userId)
      .single()

    if (!lead) return reply.code(404).send({ error: 'Lead not found' })

    const { data: closings, error } = await supabaseAdmin
      .from('closings')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch closings' })
    }

    return reply.code(200).send({ data: closings ?? [] })
  })
}
