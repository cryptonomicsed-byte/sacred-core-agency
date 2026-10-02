import { create } from 'zustand'
import type { Portfolio, DNAProfile } from '../types'

interface PortfolioState {
  portfolios: Portfolio[]
  activePortfolio: Portfolio | null
  activeDNAProfile: DNAProfile | null
  setPortfolios: (portfolios: Portfolio[]) => void
  setActive: (portfolio: Portfolio | null) => void
  setActiveDNAProfile: (profile: DNAProfile | null) => void
  updatePortfolioDNA: (portfolioId: string, dnaProfileId: string) => void
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  portfolios: [],
  activePortfolio: null,
  activeDNAProfile: null,
  setPortfolios: (portfolios) => set({ portfolios }),
  setActive: (portfolio) => set({ activePortfolio: portfolio }),
  setActiveDNAProfile: (profile) => set({ activeDNAProfile: profile }),
  updatePortfolioDNA: (portfolioId, dnaProfileId) =>
    set((state) => ({
      portfolios: state.portfolios.map((p) =>
        p.id === portfolioId ? { ...p, dna_profile_id: dnaProfileId } : p,
      ),
      activePortfolio:
        state.activePortfolio?.id === portfolioId
          ? { ...state.activePortfolio, dna_profile_id: dnaProfileId }
          : state.activePortfolio,
    })),
}))
