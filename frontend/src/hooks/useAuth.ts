import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getCurrentUser } from '../services/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { mockUser } from '../lib/mockData'
import type { User } from '../types'

interface AuthSession {
  access_token: string
  refresh_token: string
}

interface UseAuthReturn {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInAsGuest: () => void
  signOut: () => Promise<void>
  session: AuthSession | null
}

const DEMO_SESSION: AuthSession = { access_token: 'demo-token', refresh_token: 'demo-token' }

export function useAuth(): UseAuthReturn {
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { user, session, isDemo, setUser, setSession, setDemo, clear } = useAuthStore()

  function enterDemo(email?: string) {
    setDemo(true)
    setSession(DEMO_SESSION)
    setUser(email ? { ...mockUser, email } : mockUser)
  }

  useEffect(() => {
    let mounted = true

    async function initSession() {
      // Demo mode: a persisted demo session, or ?demo=1 in the URL — skip Supabase entirely.
      const urlDemo = new URLSearchParams(window.location.search).get('demo') === '1'
      if (urlDemo) {
        enterDemo()
        if (mounted) setLoading(false)
        return
      }
      if (isDemo) {
        setUser(user ?? mockUser)
        if (mounted) setLoading(false)
        return
      }

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (currentSession && mounted) {
          setSession({
            access_token: currentSession.access_token,
            refresh_token: currentSession.refresh_token,
          })
          const profile = await getCurrentUser()
          if (mounted) setUser(profile)
        } else if (mounted) {
          clear()
        }
      } catch {
        // Supabase unavailable (placeholder env) — do not hard-fail the app.
        if (mounted) clear()
      }

      if (mounted) setLoading(false)
    }

    initSession()

    let subscription: { unsubscribe: () => void } | undefined
    try {
      const sub = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!mounted || isDemo) return
        if (event === 'SIGNED_OUT' || !newSession) {
          clear()
          return
        }
        setSession({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token,
        })
        const profile = await getCurrentUser()
        if (mounted) setUser(profile)
      })
      subscription = sub?.data?.subscription
    } catch {
      /* Supabase unavailable */
    }

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setUser, setSession, clear, isDemo])

  const signIn = useCallback(
    async (email: string, password: string) => {
      // Real Supabase path when configured; otherwise fall back to a demo login so the
      // UI is fully explorable without credentials/backend.
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const profile = await getCurrentUser()
        setUser(profile)
        navigate('/')
      } catch {
        enterDemo(email || undefined)
        navigate('/')
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, setUser],
  )

  const signInAsGuest = useCallback(() => {
    enterDemo()
    navigate('/')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const signOut = useCallback(async () => {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
    clear()
    navigate('/login')
  }, [navigate, clear])

  return { user, session, loading, signIn, signInAsGuest, signOut }
}
