import { supabase } from './supabaseClient'
import type { ApiResponse, Lead, Closing } from '../types'

export interface LeadSearchResult {
  company_name: string
  company_url: string
  industry: string
  description: string
  location: string
}

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

export async function searchLeads(params: {
  query: string
  location?: string
  industry?: string
  limit?: number
}): Promise<ApiResponse<LeadSearchResult[]>> {
  const token = await getToken()
  const res = await fetch('/api/leads/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = (await res.json()) as ApiResponse<LeadSearchResult[]>
  if (!res.ok) throw new Error(json.error ?? 'Lead search failed')
  return json
}

export async function analyzeLead(params: {
  companyName: string
  companyUrl: string
  description: string
}): Promise<ApiResponse<Lead>> {
  const token = await getToken()
  const res = await fetch('/api/leads/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = (await res.json()) as ApiResponse<Lead>
  if (!res.ok) throw new Error(json.error ?? 'Lead analysis failed')
  return json
}

export async function generatePitch(params: {
  leadId: string
  agencyName?: string
}): Promise<ApiResponse<{ closing: Closing; leadId: string; status: string }>> {
  const token = await getToken()
  const res = await fetch('/api/leads/pitch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  const json = (await res.json()) as ApiResponse<{
    closing: Closing
    leadId: string
    status: string
  }>
  if (!res.ok) throw new Error(json.error ?? 'Pitch generation failed')
  return json
}

export async function closeDeal(
  closingId: string,
): Promise<ApiResponse<{ success: boolean }>> {
  const token = await getToken()
  const res = await fetch('/api/leads/close', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ closingId }),
  })
  const json = (await res.json()) as ApiResponse<{ success: boolean }>
  if (!res.ok) throw new Error(json.error ?? 'Failed to close deal')
  return json
}

export async function getLeads(): Promise<ApiResponse<Lead[]>> {
  const token = await getToken()
  const res = await fetch('/api/leads', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<Lead[]>
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch leads')
  return json
}

export async function getClosings(leadId: string): Promise<ApiResponse<Closing[]>> {
  const token = await getToken()
  const res = await fetch(`/api/leads/${leadId}/closings`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<Closing[]>
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch closings')
  return json
}

export async function updateLeadStatus(
  leadId: string,
  status: 'new' | 'pitched' | 'converted',
): Promise<ApiResponse<Lead>> {
  const token = await getToken()
  const res = await fetch(`/api/leads/${leadId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  })
  const json = (await res.json()) as ApiResponse<Lead>
  if (!res.ok) throw new Error(json.error ?? 'Failed to update lead status')
  return json
}
