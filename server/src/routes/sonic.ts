import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAuthUser } from '../middleware/requireAuth.js'
import * as elevenLabsService from '../services/elevenLabsService.js'
import {
  supabaseAdmin,
  getUserById,
  updateUserCredits,
  logCreditTransaction,
} from '../services/supabaseAdmin.js'

const VOICE_COST = 15
const JINGLE_COST = 25

const generateSchema = z.object({
  portfolioId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum(['voice', 'jingle']),
  prompt: z.string().min(10).max(500),
  voiceId: z.string().optional(),
  durationSeconds: z.number().min(5).max(60).default(30),
})

export async function sonicRoutes(server: FastifyInstance) {
  // GET /api/sonic/voices — static route must be registered before /:portfolioId
  server.get('/voices', async (_request, reply) => {
    try {
      const result = await elevenLabsService.getAvailableVoices()
      return reply.code(200).send({ data: result })
    } catch (err) {
      server.log.error(err)
      return reply.code(500).send({ error: 'Failed to fetch voices' })
    }
  })

  // POST /api/sonic/generate
  server.post('/generate', async (request, reply) => {
    const parse = generateSchema.safeParse(request.body)
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.flatten().fieldErrors })
    }

    const { portfolioId, name, type, prompt, voiceId, durationSeconds } = parse.data
    const { id: userId } = getAuthUser(request)
    const cost = type === 'voice' ? VOICE_COST : JINGLE_COST

    // Fetch portfolio + ownership check
    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id, company_name, dna_profile_id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(404).send({ error: 'Portfolio not found' })
    }

    // Enhance prompt with DNA context if available
    let enhancedPrompt = prompt
    if (portfolio.dna_profile_id) {
      const { data: dnaProfile } = await supabaseAdmin
        .from('dna_profiles')
        .select('tone, values')
        .eq('id', portfolio.dna_profile_id)
        .single()

      if (dnaProfile) {
        const valuesStr = (dnaProfile.values as string[]).slice(0, 3).join(', ')
        enhancedPrompt = `For ${portfolio.company_name} brand with ${String(dnaProfile.tone)} tone and values ${valuesStr}: ${prompt}`
      }
    }

    // Credit check
    const user = await getUserById(userId)
    if (!user) return reply.code(401).send({ error: 'User not found' })
    if (user.credits < cost) {
      return reply.code(402).send({ error: 'Insufficient credits', credits_remaining: user.credits })
    }

    // Generate audio via ElevenLabs
    let audioBuffer: Buffer
    try {
      if (type === 'voice') {
        audioBuffer = await elevenLabsService.generateVoice({
          text: enhancedPrompt,
          voiceId,
        })
      } else {
        audioBuffer = await elevenLabsService.generateJingle({
          prompt: enhancedPrompt,
          durationSeconds,
        })
      }
    } catch (err) {
      server.log.error(err)
      return reply.code(500).send({ error: 'Failed to generate audio' })
    }

    // Upload to Supabase Storage
    const safeName = name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const fileName = `${Date.now()}-${safeName}.mp3`
    let audioUrl: string
    try {
      audioUrl = await elevenLabsService.uploadToStorage({
        audioBuffer,
        portfolioId,
        fileName,
        userId,
      })
    } catch (err) {
      server.log.error(err)
      return reply.code(500).send({ error: 'Failed to upload audio' })
    }

    // Insert into sonic_identities
    const { data: sonicIdentity, error: insertError } = await supabaseAdmin
      .from('sonic_identities')
      .insert({
        portfolio_id: portfolioId,
        user_id: userId,
        name,
        audio_url: audioUrl,
        prompt_used: enhancedPrompt,
        duration_seconds: durationSeconds,
      })
      .select()
      .single()

    if (insertError || !sonicIdentity) {
      server.log.error(insertError)
      return reply.code(500).send({ error: 'Failed to save sonic identity' })
    }

    // Deduct credits
    const newBalance = user.credits - cost
    await updateUserCredits(userId, newBalance)
    await logCreditTransaction(
      userId,
      type === 'voice' ? 'sonic_voice' : 'sonic_jingle',
      cost,
      newBalance,
    )

    return reply.code(201).send({ data: sonicIdentity, credits_remaining: newBalance })
  })

  // GET /api/sonic/:portfolioId
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
      .from('sonic_identities')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('created_at', { ascending: false })

    if (error) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to fetch sonic identities' })
    }

    return reply.code(200).send({ data: data ?? [] })
  })

  // DELETE /api/sonic/:sonicId
  server.delete('/:sonicId', async (request, reply) => {
    const { sonicId } = request.params as { sonicId: string }
    const { id: userId } = getAuthUser(request)

    // Fetch sonic identity
    const { data: sonic } = await supabaseAdmin
      .from('sonic_identities')
      .select('id, audio_url, portfolio_id')
      .eq('id', sonicId)
      .single()

    if (!sonic) {
      return reply.code(404).send({ error: 'Sonic identity not found' })
    }

    // Ownership check via portfolio
    const { data: portfolio } = await supabaseAdmin
      .from('portfolios')
      .select('id')
      .eq('id', sonic.portfolio_id)
      .eq('user_id', userId)
      .single()

    if (!portfolio) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    // Delete from Supabase Storage (non-fatal)
    const audioUrl: string = sonic.audio_url as string
    const marker = '/object/public/sonic-identities/'
    const markerIndex = audioUrl.indexOf(marker)
    if (markerIndex !== -1) {
      const storagePath = audioUrl.slice(markerIndex + marker.length)
      const { error: storageError } = await supabaseAdmin.storage
        .from('sonic-identities')
        .remove([storagePath])
      if (storageError) {
        server.log.warn('Storage delete failed (non-fatal):', storageError.message)
      }
    }

    // Delete from DB
    const { error: deleteError } = await supabaseAdmin
      .from('sonic_identities')
      .delete()
      .eq('id', sonicId)

    if (deleteError) {
      server.log.error(deleteError)
      return reply.code(500).send({ error: 'Failed to delete sonic identity' })
    }

    return reply.code(200).send({ data: { success: true } })
  })
}
