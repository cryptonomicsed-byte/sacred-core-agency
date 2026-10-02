import type { DNAProfile, CampaignAsset } from '../types/index.js'

// ─── AI backend: DeepSeek via the local proxy (key stays server-side) ─────────
// Mirrors the @google/genai call shape (ai.models.generateContent({model,contents}) -> {text})
// so every call site below keeps working unchanged. No Gemini quota involved.
const AI_URL = process.env.AI_PROXY_URL || 'http://127.0.0.1:4010/chat/completions'
const AI_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

const ai = {
  models: {
    async generateContent(args: { model?: string; contents: any; config?: any }): Promise<{ text: string }> {
      const contents = args?.contents
      const userText = typeof contents === 'string'
        ? contents
        : Array.isArray(contents)
          ? contents.map((c: any) => (typeof c === 'string' ? c : c?.text ?? '')).join('\n')
          : String(contents ?? '')
      const messages: Array<{ role: string; content: string }> = []
      const sys = args?.config?.systemInstruction
      if (sys) messages.push({ role: 'system', content: typeof sys === 'string' ? sys : String(sys) })
      messages.push({ role: 'user', content: userText })
      const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: AI_MODEL, messages, temperature: 0.2 }),
      })
      if (!res.ok) throw new Error(`AI backend error ${res.status}`)
      const data: any = await res.json()
      return { text: data?.choices?.[0]?.message?.content ?? '' }
    },
  },
}

// ─── DNA Extraction ───────────────────────────────────────────────────────────

export interface ExtractDNAParams {
  companyName: string
  companyUrl?: string
}

export interface RawDNAData {
  tone: DNAProfile['tone']
  colors: string[]
  values: string[]
  personas: string[]
  swot: {
    strengths: string[]
    weaknesses: string[]
    opportunities: string[]
    threats: string[]
  }
  summary: string
}

function buildDNAPrompt(companyName: string, companyUrl?: string): string {
  return `You are a senior brand intelligence analyst specializing in digital marketing for agencies.

Analyze the following company and extract their brand DNA.

Company Name: ${companyName}
${companyUrl ? `Company Website: ${companyUrl}` : '(no URL provided — infer from name and industry context)'}

Return ONLY a valid JSON object with NO markdown formatting, NO code fences, NO explanation — raw JSON only:

{
  "tone": "<exactly one of: bold/edgy | luxury/clean | playful/warm | professional | experimental>",
  "colors": ["<primary hex e.g. #1a1a2e>", "<secondary hex>", "<accent hex>"],
  "values": ["<core value 1>", "<core value 2>", "<core value 3>", "<core value 4>"],
  "personas": ["<target persona 1 e.g. 'Millennial CMO at growth-stage SaaS'>", "<persona 2>", "<persona 3>"],
  "swot": {
    "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"],
    "opportunities": ["<opportunity 1>", "<opportunity 2>"],
    "threats": ["<threat 1>", "<threat 2>"]
  },
  "summary": "<2-3 sentence brand positioning statement for agency use>"
}`
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim()
}

export async function extractDNA(params: ExtractDNAParams): Promise<RawDNAData> {
  const prompt = buildDNAPrompt(params.companyName, params.companyUrl)
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })
  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')
  return JSON.parse(stripFences(text)) as RawDNAData
}

// ─── Portfolio Content Generation ────────────────────────────────────────────

export interface PortfolioContent {
  headline: string
  tagline: string
  about: string
  services: string[]
  caseStudyHook: string
  callToAction: string
}

export async function generatePortfolioContent(
  dnaProfile: DNAProfile,
  companyName: string,
): Promise<PortfolioContent> {
  const prompt = `You are a senior brand copywriter.
Using this brand DNA, generate portfolio content.
Return ONLY valid JSON. No markdown.

Company: ${companyName}
Tone: ${dnaProfile.tone}
Values: ${dnaProfile.values.join(', ')}
Personas: ${dnaProfile.personas.join(', ')}

Return exactly:
{
  "headline": "compelling hero headline",
  "tagline": "one-line brand tagline",
  "about": "3-sentence about paragraph",
  "services": ["4-6 service offerings"],
  "caseStudyHook": "one paragraph case study teaser",
  "callToAction": "strong CTA phrase"
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })
  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')
  return JSON.parse(stripFences(text)) as PortfolioContent
}

// ─── Campaign Asset Generation ────────────────────────────────────────────────

export interface GenerateCampaignParams {
  dnaProfile: DNAProfile
  companyName: string
  campaignTitle: string
  platforms: ('instagram' | 'tiktok' | 'linkedin' | 'email')[]
}

export async function generateCampaignAssets(
  params: GenerateCampaignParams,
): Promise<CampaignAsset[]> {
  const { dnaProfile, companyName, campaignTitle, platforms } = params

  const prompt = `You are a senior social media strategist.
Generate campaign assets for each platform.
Return ONLY valid JSON array. No markdown.

Company: ${companyName}
Campaign: ${campaignTitle}
Tone: ${dnaProfile.tone}
Values: ${dnaProfile.values.join(', ')}
Platforms: ${platforms.join(', ')}

For each platform return:
{
  "platform": "platform name",
  "content": "full post copy optimized for that platform",
  "hashtags": ["relevant", "hashtags"],
  "mediaDescription": "description of ideal visual/video to pair"
}

Return as JSON array, one object per platform.`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })
  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')

  const parsed = JSON.parse(stripFences(text)) as CampaignAsset[]

  // Validate each item has a platform matching one of the requested platforms
  const valid = parsed.filter((item) =>
    platforms.includes(item.platform as 'instagram' | 'tiktok' | 'linkedin' | 'email'),
  )

  if (valid.length === 0) {
    throw new Error('Gemini returned no valid platform assets')
  }

  return valid
}

// ─── Website Generation ───────────────────────────────────────────────────────

export type StylePreset =
  | 'glassmorphism'
  | 'neubrutalism'
  | 'claymorphism'
  | 'minimal'
  | 'bold'

export function mapToneToStylePreset(tone: DNAProfile['tone']): StylePreset {
  const map: Record<DNAProfile['tone'], StylePreset> = {
    'bold/edgy': 'neubrutalism',
    'luxury/clean': 'minimal',
    'playful/warm': 'claymorphism',
    professional: 'glassmorphism',
    experimental: 'bold',
  }
  return map[tone] ?? 'glassmorphism'
}

export interface WebsiteGenerationResult {
  html: string
  css: string
  js: string
  pageName: string
  fullHtml: string
}

const STYLE_GUIDELINES: Record<StylePreset, string> = {
  glassmorphism:
    'dark bg (#0f0f13), glass cards (backdrop-filter blur), indigo/violet accents, subtle borders rgba(255,255,255,0.1)',
  neubrutalism:
    'white bg, black borders (3px solid), bold saturated colors, offset box-shadows, uppercase headings',
  claymorphism:
    'light pastel bg, rounded-3xl, soft shadows, playful gradients, large rounded elements',
  minimal:
    'white bg, lots of whitespace, serif headings, single accent color, clean lines',
  bold: 'dark bg, large typography, full-bleed sections, high contrast, strong CTAs',
}

export async function generateWebsite(params: {
  dnaProfile: DNAProfile
  companyName: string
  portfolioContent?: {
    headline?: string
    tagline?: string
    about?: string
    services?: string[]
    callToAction?: string
  }
  stylePreset: StylePreset
}): Promise<WebsiteGenerationResult> {
  const { dnaProfile, companyName, portfolioContent, stylePreset } = params
  const pc = portfolioContent ?? {}

  const prompt = `You are a senior web designer and developer.
Generate a complete, beautiful, single-page website.
Return ONLY valid JSON. No markdown.

Company: ${companyName}
Style: ${stylePreset}
Tone: ${dnaProfile.tone}
Colors: ${dnaProfile.colors.join(', ')}
Values: ${dnaProfile.values.join(', ')}
Headline: ${pc.headline ?? 'Welcome'}
Tagline: ${pc.tagline ?? ''}
About: ${pc.about ?? ''}
Services: ${(pc.services ?? []).join(', ')}
CTA: ${pc.callToAction ?? 'Get Started'}

Generate a complete single-page website with:
- Hero section (headline, tagline, CTA button)
- About section (company story)
- Services section (cards for each service)
- Contact/CTA section
- Footer

Style requirements for ${stylePreset}: ${STYLE_GUIDELINES[stylePreset]}

Return exactly:
{
  "html": "complete HTML body content only (no <html><head><body> tags), using Tailwind CSS classes, semantic HTML5",
  "css": "additional custom CSS beyond Tailwind (animations, custom properties, etc.)",
  "js": "vanilla JavaScript for interactions (smooth scroll, mobile menu, etc.)",
  "pageName": "seo-friendly-page-name"
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })
  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')

  const parsed = JSON.parse(stripFences(text)) as {
    html: string
    css: string
    js: string
    pageName: string
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${parsed.css}</style>
</head>
<body>
${parsed.html}
<script>${parsed.js}</script>
</body>
</html>`

  return { ...parsed, fullHtml }
}

// ─── Session 9 — Lead Intelligence ───────────────────────────────────────────

export interface LeadSearchResult {
  company_name: string
  company_url: string
  industry: string
  description: string
  location: string
}

export async function searchLeads(params: {
  query: string
  location?: string
  industry?: string
  limit?: number
}): Promise<LeadSearchResult[]> {
  const { query, location = 'anywhere', industry = 'any industry', limit = 5 } = params

  const prompt = `You are a business intelligence analyst.
Generate realistic business leads.
Return ONLY a valid JSON array. No markdown.

Search: ${query}
Location: ${location}
Industry: ${industry}
Count: ${limit}

For each business return:
{
  "company_name": "realistic company name",
  "company_url": "realistic website URL",
  "industry": "specific industry",
  "description": "2-sentence company description",
  "location": "City, Country"
}

Make companies realistic, varied, and relevant to the search.
Return exactly ${limit} results as a JSON array.`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })
  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')
  return JSON.parse(stripFences(text)) as LeadSearchResult[]
}

export interface LeadAnalysisResult {
  pain_score: number
  pain_summary: string
  weaknesses: string[]
  opportunities: string[]
}

export async function analyzeLead(params: {
  companyName: string
  companyUrl: string
  description: string
}): Promise<LeadAnalysisResult> {
  const { companyName, companyUrl, description } = params

  const prompt = `You are a sales intelligence analyst.
Analyze this business and score their need for AI marketing services.
Return ONLY valid JSON. No markdown.

Company: ${companyName}
URL: ${companyUrl}
Description: ${description}

Score their pain from 0-100 where:
100 = desperately needs marketing help
0 = excellent marketing, no need

Return exactly:
{
  "pain_score": number 0-100,
  "pain_summary": "2-3 sentence explanation of why they need marketing help",
  "weaknesses": ["3-4 specific marketing weaknesses observed"],
  "opportunities": ["2-3 specific ways Sacred Core Agency could help them"]
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })
  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')
  return JSON.parse(stripFences(text)) as LeadAnalysisResult
}

export interface PitchResult {
  subject: string
  body: string
}

export async function generatePitch(params: {
  companyName: string
  companyUrl: string
  painSummary: string
  weaknesses: string[]
  opportunities: string[]
  agencyName?: string
}): Promise<PitchResult> {
  const {
    companyName,
    companyUrl,
    painSummary,
    weaknesses,
    opportunities,
    agencyName = 'Sacred Core Agency',
  } = params

  const prompt = `You are a senior business development writer.
Write a compelling cold outreach email.
Return ONLY valid JSON. No markdown.

Target Company: ${companyName} (${companyUrl})
Their Pain Points: ${painSummary}
Their Weaknesses: ${weaknesses.join(', ')}
Our Opportunities: ${opportunities.join(', ')}
Our Agency: ${agencyName}

Write a personalized cold email that:
- Opens with a specific observation about them
- Acknowledges their specific challenge
- Presents one concrete solution we offer
- Has a clear, low-friction CTA
- Is under 200 words
- Feels human, not templated

Return exactly:
{
  "subject": "compelling email subject line",
  "body": "full email body with line breaks represented as \\n"
}`

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })
  const text = response.text
  if (!text) throw new Error('Empty response from Gemini')
  return JSON.parse(stripFences(text)) as PitchResult
}
