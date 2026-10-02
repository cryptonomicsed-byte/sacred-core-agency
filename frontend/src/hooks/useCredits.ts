import { useEffect, useState, useCallback } from 'react'
import { useCreditsStore } from '../store/creditsStore'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../services/supabaseClient'
import type { CreditTransaction } from '../types'

interface UseCreditsReturn {
  balance: number
  deduct: (amount: number, action: string) => Promise<boolean>
  loading: boolean
  history: CreditTransaction[]
  fetchHistory: () => Promise<void>
  topUp: (pkg: 'starter' | 'pro' | 'enterprise') => Promise<void>
  topUpMessage: string | null
}

export function useCredits(): UseCreditsReturn {
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<CreditTransaction[]>([])
  const [topUpMessage, setTopUpMessage] = useState<string | null>(null)
  const { balance, setBalance, setTier, deductOptimistic } = useCreditsStore()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    async function fetchBalance() {
      const { data, error } = await supabase
        .from('users')
        .select('credits, tier')
        .eq('id', user!.id)
        .single()

      if (!error && data) {
        setBalance(data.credits)
        setTier(data.tier)
      }
      setLoading(false)
    }

    fetchBalance()
  }, [user?.id, setBalance, setTier])

  const deduct = useCallback(
    async (amount: number, action: string): Promise<boolean> => {
      if (balance < amount) return false

      const previousBalance = balance
      deductOptimistic(amount)

      try {
        const response = await fetch('/api/credits/deduct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, action }),
        })

        if (!response.ok) {
          setBalance(previousBalance)
          return false
        }

        const result = await response.json()
        setBalance(result.credits_remaining)
        return true
      } catch {
        setBalance(previousBalance)
        return false
      }
    },
    [balance, deductOptimistic, setBalance],
  )

  const fetchHistory = useCallback(async (): Promise<void> => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch('/api/credits/history?limit=20', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const json = await res.json()
      setHistory(json.data ?? [])
    } catch {
      // silent
    }
  }, [])

  const topUp = useCallback(
    async (pkg: 'starter' | 'pro' | 'enterprise'): Promise<void> => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return

      try {
        const res = await fetch('/api/credits/topup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ package: pkg }),
        })
        const json = await res.json()
        setTopUpMessage(json.message ?? 'Request received.')
      } catch {
        setTopUpMessage('Failed to process top-up request. Please try again.')
      }
    },
    [],
  )

  return { balance, deduct, loading, history, fetchHistory, topUp, topUpMessage }
}
