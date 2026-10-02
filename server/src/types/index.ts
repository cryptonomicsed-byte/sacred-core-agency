export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  tier: 'starter' | 'pro' | 'enterprise'
  credits: number
  created_at: string
}

export interface Portfolio {
  id: string
  user_id: string
  company_name: string
  company_url?: string
  logo_url?: string
  industry?: string
  dna_profile_id?: string
  created_at: string
  updated_at: string
}

export interface DNAProfile {
  id: string
  portfolio_id: string
  tone: 'bold/edgy' | 'luxury/clean' | 'playful/warm' | 'professional' | 'experimental'
  colors: string[]
  values: string[]
  personas: string[]
  swot: {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    threats: string[]
  }
  raw_gemini_output: string
  created_at: string
}

export interface Campaign {
  id: string
  portfolio_id: string
  title: string
  platforms: ('instagram' | 'tiktok' | 'linkedin' | 'email')[]
  assets: CampaignAsset[]
  status: 'draft' | 'scheduled' | 'published'
  scheduled_for?: string
  created_at: string
}

export interface CampaignAsset {
  platform: string
  content: string
  media_url?: string
  hashtags?: string[]
  mediaDescription?: string
}

export interface Lead {
  id: string
  user_id: string
  company_name: string
  company_url?: string
  pain_score: number
  pain_summary: string
  pitch_draft?: string
  status: 'new' | 'pitched' | 'converted'
  created_at: string
}

export interface Closing {
  id: string
  lead_id: string
  email_subject: string
  email_body: string
  sent_at?: string
  status: 'draft' | 'sent' | 'replied'
}

export interface Agent {
  id: string
  portfolio_id: string
  name: string
  tools: string[]
  status: 'idle' | 'running' | 'error'
  session_id?: string
  logs: AgentLog[]
  created_at: string
}

export interface AgentLog {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface SonicIdentity {
  id: string
  portfolio_id: string
  name: string
  audio_url: string
  prompt_used: string
  duration_seconds: number
  created_at: string
}

export interface CreditTransaction {
  id: string
  user_id: string
  action: string
  credits_used: number
  balance_after: number
  created_at: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  credits_remaining?: number
}
