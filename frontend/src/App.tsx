import { Routes, Route } from 'react-router-dom'
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion'
import { DashboardPage } from './pages/DashboardPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { LeadsPage } from './pages/LeadsPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { CreditExhaustBanner } from './components/ui/CreditExhaustBanner'

export function App() {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/portfolio/:id" element={<PortfolioPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <CreditExhaustBanner />
      </MotionConfig>
    </LazyMotion>
  )
}
