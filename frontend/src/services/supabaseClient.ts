import { createClient } from '@supabase/supabase-js'
import type { User, Portfolio, ApiResponse } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (error || !data) return null
  return data as User
}

export async function getPortfolios(): Promise<Portfolio[]> {
  const token = await getToken()
  const res = await fetch('/api/portfolios', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = (await res.json()) as ApiResponse<Portfolio[]>
  if (!res.ok) throw new Error(json.error ?? 'Failed to fetch portfolios')
  return json.data ?? []
}

export async function createPortfolio(data: {
  company_name: string
  company_url?: string
  industry?: string
}): Promise<Portfolio> {
  const token = await getToken()
  const res = await fetch('/api/portfolios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  const json = (await res.json()) as ApiResponse<Portfolio>
  if (!res.ok) throw new Error(json.error ?? 'Failed to create portfolio')
  if (!json.data) throw new Error('No portfolio returned')
  return json.data
}
