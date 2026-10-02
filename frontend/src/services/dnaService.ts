import { supabase } from './supabaseClient'
import type { DNAProfile, ApiResponse } from '../types'

interface ExtractDNAParams {
  portfolioId: string
  companyName: string
  companyUrl?: string
}

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

export async function extractDNA(
  params: ExtractDNAParams,
): Promise<ApiResponse<DNAProfile>> {
  const token = await getToken()
  const res = await fetch('/api/dna/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = (await res.json()) as ApiResponse<DNAProfile>
  if (!res.ok) throw new Error(json.error ?? 'DNA extraction failed')
  return json
}

export async function getDNAProfile(
  portfolioId: string,
): Promise<DNAProfile | null> {
  const token = await getToken()
  const res = await fetch(`/api/dna/${portfolioId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<DNAProfile>
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch DNA profile')
  return json.data ?? null
}
