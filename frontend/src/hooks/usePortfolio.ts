import { useCallback } from 'react'
import { usePortfolioStore } from '../store/portfolioStore'
import { useCreditsStore } from '../store/creditsStore'
import * as dnaService from '../services/dnaService'
import type { DNAProfile, Portfolio } from '../types'

interface ExtractDNAParams {
  portfolioId: string
  companyName: string
  companyUrl?: string
}

interface UsePortfolioReturn {
  portfolios: Portfolio[]
  activePortfolio: Portfolio | null
  activeDNAProfile: DNAProfile | null
  setActive: (portfolio: Portfolio | null) => void
  setActiveDNAProfile: (profile: DNAProfile | null) => void
  extractPortfolioDNA: (params: ExtractDNAParams) => Promise<DNAProfile>
  loadDNAProfile: (portfolioId: string) => Promise<DNAProfile | null>
}

export function usePortfolio(): UsePortfolioReturn {
  const portfolios = usePortfolioStore((s) => s.portfolios)
  const activePortfolio = usePortfolioStore((s) => s.activePortfolio)
  const activeDNAProfile = usePortfolioStore((s) => s.activeDNAProfile)
  const setActive = usePortfolioStore((s) => s.setActive)
  const setActiveDNAProfile = usePortfolioStore((s) => s.setActiveDNAProfile)
  const updatePortfolioDNA = usePortfolioStore((s) => s.updatePortfolioDNA)
  const setBalance = useCreditsStore((s) => s.setBalance)
  const deductOptimistic = useCreditsStore((s) => s.deductOptimistic)

  const extractPortfolioDNA = useCallback(
    async (params: ExtractDNAParams): Promise<DNAProfile> => {
      deductOptimistic(50)
      const result = await dnaService.extractDNA(params)
      if (!result.data) throw new Error('No DNA profile returned')
      setActiveDNAProfile(result.data)
      updatePortfolioDNA(params.portfolioId, result.data.id)
      if (result.credits_remaining !== undefined) {
        setBalance(result.credits_remaining)
      }
      return result.data
    },
    [setActiveDNAProfile, updatePortfolioDNA, setBalance, deductOptimistic],
  )

  const loadDNAProfile = useCallback(
    async (portfolioId: string): Promise<DNAProfile | null> => {
      const profile = await dnaService.getDNAProfile(portfolioId)
      setActiveDNAProfile(profile)
      return profile
    },
    [setActiveDNAProfile],
  )

  return {
    portfolios,
    activePortfolio,
    activeDNAProfile,
    setActive,
    setActiveDNAProfile,
    extractPortfolioDNA,
    loadDNAProfile,
  }
}
