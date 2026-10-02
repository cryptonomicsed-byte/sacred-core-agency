import { useParams } from 'react-router-dom'
import { PortfolioWorkspace } from '../components/portfolio/PortfolioWorkspace'
import { usePortfolioStore } from '../store/portfolioStore'

export function PortfolioPage() {
  const { id } = useParams<{ id: string }>()
  const portfolios = usePortfolioStore((s) => s.portfolios)
  const portfolio = portfolios.find((p) => p.id === id)

  return (
    <div className="min-h-screen">
      <PortfolioWorkspace portfolio={portfolio} />
    </div>
  )
}
