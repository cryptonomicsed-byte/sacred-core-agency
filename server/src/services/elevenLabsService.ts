import { supabaseAdmin } from './supabaseAdmin.js'

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('Missing ELEVENLABS_API_KEY environment variable')
  return key
}

export async function generateVoice(params: {
  text: string
  voiceId?: string
  stability?: number
  similarityBoost?: number
}): Promise<Buffer> {
  const {
    text,
    voiceId = DEFAULT_VOICE_ID,
    stability = 0.5,
    similarityBoost = 0.75,
  } = params

  const apiKey = getApiKey()

  const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ElevenLabs TTS error ${response.status}: ${errorText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function generateJingle(params: {
  prompt: string
  durationSeconds?: number
}): Promise<Buffer> {
  const { prompt, durationSeconds = 30 } = params
  const apiKey = getApiKey()

  try {
    const response = await fetch(`${ELEVENLABS_BASE}/sound-generation`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: durationSeconds,
        prompt_influence: 0.3,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ElevenLabs sound-generation error ${response.status}: ${errorText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.warn(
      'ElevenLabs /sound-generation unavailable (free tier?), falling back to TTS:',
      err instanceof Error ? err.message : String(err),
    )
    return generateVoice({ text: prompt })
  }
}

export async function getAvailableVoices(): Promise<{
  voices: { voice_id: string; name: string; category: string }[]
}> {
  const apiKey = getApiKey()

  const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
    headers: { 'xi-api-key': apiKey },
  })

  if (!response.ok) {
    throw new Error(`ElevenLabs voices error ${response.status}`)
  }

  const data = (await response.json()) as {
    voices: { voice_id: string; name: string; category: string }[]
  }

  return {
    voices: data.voices.filter((v) => v.category === 'premade'),
  }
}

export async function uploadToStorage(params: {
  audioBuffer: Buffer
  portfolioId: string
  fileName: string
  userId: string
}): Promise<string> {
  const { audioBuffer, portfolioId, fileName, userId } = params
  const bucket = 'sonic-identities'
  const storagePath = `${userId}/${portfolioId}/${fileName}`

  // Ensure bucket exists (ignore error if already exists)
  await supabaseAdmin.storage
    .createBucket(bucket, { public: true })
    .catch(() => { /* bucket already exists */ })

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`)
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath)
  return data.publicUrl
}
