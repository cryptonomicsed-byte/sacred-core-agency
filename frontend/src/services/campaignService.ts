import { supabase } from './supabaseClient'
import type { Campaign, ApiResponse } from '../types'

interface PortfolioContent {
  headline: string
  tagline: string
  about: string
  services: string[]
  caseStudyHook: string
  callToAction: string
}

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

export async function generateCampaign(params: {
  portfolioId: string
  campaignTitle: string
  platforms: string[]
}): Promise<ApiResponse<Campaign>> {
  const token = await getToken()
  const res = await fetch('/api/campaigns/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = (await res.json()) as ApiResponse<Campaign>
  if (!res.ok) throw new Error(json.error ?? 'Campaign generation failed')
  return json
}

export async function getCampaigns(
  portfolioId: string,
): Promise<ApiResponse<Campaign[]>> {
  const token = await getToken()
  const res = await fetch(`/api/campaigns/${portfolioId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<Campaign[]>
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch campaigns')
  return json
}

export async function updateCampaignStatus(params: {
  campaignId: string
  status: Campaign['status']
  scheduledFor?: string
}): Promise<ApiResponse<Campaign>> {
  const token = await getToken()
  const body: Record<string, unknown> = { status: params.status }
  if (params.scheduledFor) body.scheduled_for = params.scheduledFor
  const res = await fetch(`/api/campaigns/${params.campaignId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as ApiResponse<Campaign>
  if (!res.ok) throw new Error(json.error ?? 'Failed to update campaign status')
  return json
}

export async function generateReport(params: {
  portfolioId: string
  includeSwot: boolean
  includePersonas: boolean
}): Promise<ApiResponse<PortfolioContent>> {
  const token = await getToken()
  const res = await fetch('/api/portfolios/generate-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = (await res.json()) as ApiResponse<PortfolioContent>
  if (!res.ok) throw new Error(json.error ?? 'Report generation failed')
  return json
}
