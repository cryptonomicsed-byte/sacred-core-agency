import { create } from 'zustand'

interface CreditsState {
  balance: number
  tier: string
  setBalance: (balance: number) => void
  setTier: (tier: string) => void
  deductOptimistic: (amount: number) => void
}

export const useCreditsStore = create<CreditsState>((set) => ({
  balance: 0,
  tier: 'starter',
  setBalance: (balance) => set({ balance }),
  setTier: (tier) => set({ tier }),
  deductOptimistic: (amount) =>
    set((state) => ({ balance: Math.max(0, state.balance - amount) })),
}))
