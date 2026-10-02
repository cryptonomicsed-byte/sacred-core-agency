import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthSession {
  access_token: string
  refresh_token: string
}

interface AuthState {
  user: User | null
  session: AuthSession | null
  isDemo: boolean
  setUser: (user: User | null) => void
  setSession: (session: AuthSession | null) => void
  setDemo: (isDemo: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isDemo: false,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setDemo: (isDemo) => set({ isDemo }),
      clear: () => set({ user: null, session: null, isDemo: false }),
    }),
    {
      name: 'sacred-core-auth',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isDemo: state.isDemo,
      }),
    },
  ),
)
