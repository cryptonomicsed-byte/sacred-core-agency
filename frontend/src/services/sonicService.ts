import { supabase } from './supabaseClient'
import type { ApiResponse, SonicIdentity } from '../types'

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

export async function generateSonic(params: {
  portfolioId: string
  name: string
  type: 'voice' | 'jingle'
  prompt: string
  voiceId?: string
  durationSeconds?: number
}): Promise<ApiResponse<SonicIdentity>> {
  const token = await getToken()
  const res = await fetch('/api/sonic/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = (await res.json()) as ApiResponse<SonicIdentity>
  if (!res.ok) throw new Error(json.error ?? 'Failed to generate sonic')
  return json
}

export async function getSonicIdentities(
  portfolioId: string,
): Promise<ApiResponse<SonicIdentity[]>> {
  const token = await getToken()
  const res = await fetch(`/api/sonic/${portfolioId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<SonicIdentity[]>
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch sonic identities')
  return json
}

export async function deleteSonic(
  sonicId: string,
): Promise<ApiResponse<{ success: boolean }>> {
  const token = await getToken()
  const res = await fetch(`/api/sonic/${sonicId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<{ success: boolean }>
  if (!res.ok) throw new Error(json.error ?? 'Failed to delete sonic identity')
  return json
}

export async function getVoices(): Promise<
  ApiResponse<{ voices: { voice_id: string; name: string }[] }>
> {
  const token = await getToken()
  const res = await fetch('/api/sonic/voices', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<{
    voices: { voice_id: string; name: string }[]
  }>
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch voices')
  return json
}
