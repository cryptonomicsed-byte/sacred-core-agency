import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { jsPDF } from 'jspdf'
import { GlassCard } from '../components/ui/GlassCard'
import { CreditGate } from '../components/ui/CreditGate'
import { fadeUp, fadeIn, scaleIn, staggerContainer, springConfig } from '../lib/motion'
import { triggerHaptic } from '../lib/webapis'
import { usePortfolio } from '../hooks/usePortfolio'
import { useCreditsStore } from '../store/creditsStore'
import * as campaignService from '../services/campaignService'
import type { Portfolio } from '../types'

const LOADING_PHRASES = [
  'Crafting your headline…',
  'Writing brand narrative…',
  'Building service offerings…',
  'Composing case study hook…',
  'Finalising report…',
]

interface PortfolioContent {
  headline: string
  tagline: string
  about: string
  services: string[]
  caseStudyHook: string
  callToAction: string
  includeSwot?: boolean
  includePersonas?: boolean
  dnaProfile?: {
    tone: string
    swot?: {
      strengths: string[]
      weaknesses: string[]
      opportunities: string[]
      threats: string[]
    }
    personas?: string[]
  }
}

type TabState = 'nodna' | 'ready' | 'generating' | 'generated'

interface PortfolioBuilderTabProps {
  portfolio: Portfolio
}

function switchToDNATab() {
  document.dispatchEvent(new CustomEvent('tab:switch', { detail: { tab: 'DNA Profile' } }))
}

function generatePDF(portfolio: Portfolio, content: PortfolioContent) {
  const doc = new jsPDF()
  const margin = 20
  const pageWidth = doc.internal.pageSize.getWidth()
  const maxWidth = pageWidth - margin * 2

  // ── Page 1: Company + headline + tagline + about ──
  doc.setFillColor(15, 15, 19)
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')

  doc.setTextColor(99, 102, 241)
  doc.setFontSize(10)
  doc.text('SACRED CORE AGENCY', margin, 15)

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  const companyLines = doc.splitTextToSize(portfolio.company_name, maxWidth)
  doc.text(companyLines as string[], margin, 35)

  doc.setFontSize(20)
  doc.setTextColor(200, 200, 200)
  const headlineLines = doc.splitTextToSize(content.headline, maxWidth)
  doc.text(headlineLines as string[], margin, 55)

  doc.setFontSize(13)
  doc.setTextColor(160, 160, 180)
  doc.setFont('helvetica', 'italic')
  const taglineLines = doc.splitTextToSize(content.tagline, maxWidth)
  doc.text(taglineLines as string[], margin, 75)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(180, 180, 200)
  doc.text('About', margin, 95)
  doc.setTextColor(220, 220, 230)
  doc.setFontSize(10)
  const aboutLines = doc.splitTextToSize(content.about, maxWidth)
  doc.text(aboutLines as string[], margin, 103)

  // ── Page 2: Services + case study hook + CTA ──
  doc.addPage()
  doc.setFillColor(15, 15, 19)
  doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')

  doc.setTextColor(99, 102, 241)
  doc.setFontSize(10)
  doc.text('SACRED CORE AGENCY', margin, 15)

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Services', margin, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(200, 200, 210)
  let y = 40
  content.services.forEach((service) => {
    doc.text(`• ${service}`, margin + 4, y)
    y += 8
  })

  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('Case Study', margin, y)
  y += 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(200, 200, 210)
  const caseLines = doc.splitTextToSize(content.caseStudyHook, maxWidth)
  doc.text(caseLines as string[], margin, y)
  y += (caseLines.length as number) * 6 + 16

  doc.setFillColor(99, 102, 241)
  doc.roundedRect(margin, y, maxWidth, 14, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(content.callToAction, margin + 6, y + 9)

  // ── Page 3: SWOT (if included) ──
  const swotData = content.dnaProfile?.swot
  if (content.includeSwot && swotData) {
    doc.addPage()
    doc.setFillColor(15, 15, 19)
    doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')

    doc.setTextColor(99, 102, 241)
    doc.setFontSize(10)
    doc.text('SACRED CORE AGENCY', margin, 15)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('SWOT Analysis', margin, 30)

    const swot = swotData
    const half = (maxWidth - 10) / 2
    const boxes = [
      { label: 'Strengths', items: swot.strengths, x: margin, y: 42, color: [34, 197, 94] as [number, number, number] },
      { label: 'Weaknesses', items: swot.weaknesses, x: margin + half + 10, y: 42, color: [239, 68, 68] as [number, number, number] },
      { label: 'Opportunities', items: swot.opportunities, x: margin, y: 110, color: [251, 191, 36] as [number, number, number] },
      { label: 'Threats', items: swot.threats, x: margin + half + 10, y: 110, color: [167, 139, 250] as [number, number, number] },
    ]

    boxes.forEach(({ label, items, x, y: by, color }) => {
      doc.setFillColor(color[0], color[1], color[2])
      doc.roundedRect(x, by, half, 8, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(label, x + 4, by + 5.5)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 200, 210)
      doc.setFontSize(9)
      let iy = by + 14
      items.forEach((item) => {
        const lines = doc.splitTextToSize(`• ${item}`, half - 8)
        doc.text(lines as string[], x + 4, iy)
        iy += (lines.length as number) * 5.5
      })
    })
  }

  // ── Page 4: Personas (if included) ──
  const personasData = content.dnaProfile?.personas
  if (content.includePersonas && personasData?.length) {
    doc.addPage()
    doc.setFillColor(15, 15, 19)
    doc.rect(0, 0, pageWidth, doc.internal.pageSize.getHeight(), 'F')

    doc.setTextColor(99, 102, 241)
    doc.setFontSize(10)
    doc.text('SACRED CORE AGENCY', margin, 15)

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Target Personas', margin, 30)

    let py = 44
    personasData.forEach((persona, i) => {
      doc.setFillColor(26, 26, 35)
      doc.roundedRect(margin, py, maxWidth, 18, 3, 3, 'F')
      doc.setTextColor(99, 102, 241)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}`, margin + 5, py + 11)
      doc.setTextColor(220, 220, 230)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(persona, margin + 14, py + 11)
      py += 24
    })
  }

  const filename = `${portfolio.company_name.toLowerCase().replace(/\s+/g, '-')}-portfolio.pdf`
  doc.save(filename)
  triggerHaptic([50, 30, 50])
}

export function PortfolioBuilderTab({ portfolio }: PortfolioBuilderTabProps) {
  const { activeDNAProfile } = usePortfolio()
  const setBalance = useCreditsStore((s) => s.setBalance)
  const deductOptimistic = useCreditsStore((s) => s.deductOptimistic)

  const hasDNA = !!portfolio.dna_profile_id
  const [state, setState] = useState<TabState>(hasDNA ? 'ready' : 'nodna')
  const [includeSwot, setIncludeSwot] = useState(true)
  const [includePersonas, setIncludePersonas] = useState(true)
  const [report, setReport] = useState<PortfolioContent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const phraseRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setState(hasDNA ? 'ready' : 'nodna')
  }, [hasDNA])

  useEffect(() => {
    if (state === 'generating') {
      phraseRef.current = setInterval(() => {
        setPhraseIndex((i) => (i + 1) % LOADING_PHRASES.length)
      }, 1400)
    }
    return () => {
      if (phraseRef.current) clearInterval(phraseRef.current)
    }
  }, [state])

  async function handleGenerate() {
    setError(null)
    setState('generating')
    setPhraseIndex(0)
    deductOptimistic(30)

    try {
      const result = await campaignService.generateReport({
        portfolioId: portfolio.id,
        includeSwot,
        includePersonas,
      })
      if (!result.data) throw new Error('No report returned')

      const content: PortfolioContent = {
        ...result.data,
        includeSwot,
        includePersonas,
        dnaProfile: activeDNAProfile ?? undefined,
      }
      setReport(content)
      if (result.credits_remaining !== undefined) {
        setBalance(result.credits_remaining)
      }
      setState('generated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed')
      setState('ready')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence mode="wait">
        {/* ── No DNA state ── */}
        {state === 'nodna' && (
          <motion.div
            key="nodna"
            variants={scaleIn}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <GlassCard className="flex flex-col items-center justify-center py-16 gap-5" hoverable={false}>
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">
                🧬
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1">DNA Required</p>
                <p className="text-white/40 text-sm max-w-xs">
                  Extract this brand&apos;s DNA before generating portfolio content.
                </p>
              </div>
              <motion.button
                onClick={switchToDNATab}
                whileTap={{ scale: 0.97 }}
                transition={springConfig}
                className="px-5 py-2.5 rounded-glass text-sm font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow"
              >
                Extract DNA First →
              </motion.button>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Ready state ── */}
        {state === 'ready' && (
          <motion.div
            key="ready"
            variants={fadeUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col gap-6"
          >
            <div>
              <h2 className="text-xl font-bold text-white">Generate Portfolio Report</h2>
              <p className="text-white/40 text-sm mt-1">
                Powered by Gemini 2.0 Flash · 30 credits
              </p>
            </div>

            {error && (
              <motion.div
                variants={fadeIn}
                initial="initial"
                animate="animate"
                className="flex items-center gap-3 px-4 py-3 rounded-glass bg-red-500/10 border border-red-500/20"
              >
                <span className="text-red-400 text-sm">{error}</span>
              </motion.div>
            )}

            <GlassCard className="flex flex-col gap-5 p-6" hoverable={false}>
              {/* SWOT toggle */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="text-white/70 text-sm">Include SWOT Analysis</span>
                <button
                  role="switch"
                  aria-checked={includeSwot}
                  onClick={() => setIncludeSwot((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    includeSwot ? 'bg-accent-primary' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      includeSwot ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </label>

              {/* Personas toggle */}
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="text-white/70 text-sm">Include Target Personas</span>
                <button
                  role="switch"
                  aria-checked={includePersonas}
                  onClick={() => setIncludePersonas((v) => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    includePersonas ? 'bg-accent-primary' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      includePersonas ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </label>

              <CreditGate cost={30} action="Portfolio Report">
                <motion.button
                  onClick={handleGenerate}
                  whileTap={{ scale: 0.97 }}
                  transition={springConfig}
                  className="w-full py-3 rounded-glass font-semibold text-white bg-gradient-to-r from-accent-primary to-accent-secondary hover:shadow-glow transition-shadow flex items-center justify-center gap-2"
                >
                  <span>⚡</span> Generate Report
                  <span className="text-white/60 text-xs font-normal ml-1">−30 credits</span>
                </motion.button>
              </CreditGate>

              <motion.button
                disabled
                className="w-full py-2.5 rounded-glass text-sm font-medium text-white/30 border border-white/10 cursor-not-allowed"
              >
                Download PDF
              </motion.button>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Generating state ── */}
        {state === 'generating' && (
          <motion.div
            key="generating"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col items-center justify-center py-24 gap-8"
          >
            <div className="relative w-16 h-16">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-accent-primary/30"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-2 rounded-full border-2 border-accent-secondary/50"
                animate={{ rotate: -360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-4 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
            <div className="h-7 flex items-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="text-white/60 text-base font-medium"
                >
                  {LOADING_PHRASES[phraseIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
            <p className="text-white/25 text-xs">Gemini is writing for {portfolio.company_name}</p>
          </motion.div>
        )}

        {/* ── Generated state ── */}
        {state === 'generated' && report && (
          <motion.div
            key="generated"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col gap-5"
          >
            {/* Header */}
            <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Portfolio Report</h2>
                <p className="text-white/40 text-xs mt-0.5">{portfolio.company_name}</p>
              </div>
              <CreditGate cost={30} action="Portfolio Report">
                <motion.button
                  onClick={handleGenerate}
                  whileTap={{ scale: 0.97 }}
                  transition={springConfig}
                  className="px-3 py-1.5 rounded-glass text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
                >
                  ⚡ Regenerate
                  <span className="text-white/25 ml-1">−30</span>
                </motion.button>
              </CreditGate>
            </motion.div>

            {/* Report preview */}
            <motion.div variants={fadeUp}>
              <GlassCard className="p-6 flex flex-col gap-5" hoverable={false}>
                {/* Headline */}
                <div>
                  <p
                    className="text-2xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent leading-tight"
                  >
                    {report.headline}
                  </p>
                  <p className="text-white/50 italic text-sm mt-1">{report.tagline}</p>
                </div>

                {/* About */}
                <div>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">About</p>
                  <p className="text-white/70 text-sm leading-relaxed">{report.about}</p>
                </div>

                {/* Services */}
                <div>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-3">Services</p>
                  <div className="flex flex-wrap gap-2">
                    {report.services.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-accent-primary/15 text-accent-glow border border-accent-primary/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Case Study Hook */}
                <div>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-2">Case Study</p>
                  <p className="text-white/70 text-sm leading-relaxed">{report.caseStudyHook}</p>
                </div>

                {/* CTA */}
                <div className="pt-2 border-t border-white/5">
                  <p className="text-white font-bold text-lg">{report.callToAction}</p>
                </div>
              </GlassCard>
            </motion.div>

            {/* Download PDF button */}
            <motion.div variants={fadeUp}>
              <motion.button
                onClick={() => generatePDF(portfolio, report)}
                whileTap={{ scale: 0.97 }}
                transition={springConfig}
                className="w-full py-3 rounded-glass font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-glow transition-shadow flex items-center justify-center gap-2"
              >
                <span>↓</span> Download PDF
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
