# Sacred Core Agency — Project Context

## Vision

Sacred Core Agency is a B2B AI marketing agency platform that gives marketing teams and agencies a sovereign workspace per client (Portfolio), competitive intelligence (Leads), and autonomous agent execution (Agent Forge). It is a premium, revenue-generating SaaS — the kind clients pay $199/month for without hesitation.

## Stack (locked)

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, Zustand, React Router v7, Framer Motion, Lenis
- **Backend:** Fastify v4, TypeScript, @fastify/helmet, @fastify/cors, @fastify/rate-limit, @fastify/jwt
- **Database:** Supabase ONLY (PostgreSQL + Auth + Realtime + Storage). NO Firebase. NO Redis. NO MongoDB.
- **AI:** @google/genai (Gemini 2.0 Flash) — server-side only
- **Audio:** ElevenLabs REST API — server-side only
- **Agents:** OpenClaw daemon ws://localhost:18789 — server-side only
- **Testing:** Playwright

## UI Philosophy

Glassmorphism 2.0 + Bento Grid. Dark mode default. Agency-premium aesthetic. Every interaction must feel intentional and physical.

Progressive enhancement model:

- **Layer 1 — Structure (Session 1-2):** Tailwind dark mode, glass surface tokens, bento grid layout system
- **Layer 2 — Motion (Session 3):** Framer Motion springs, Lenis momentum scroll, View Transitions API, micro-interaction feedback
- **Layer 3 — Hardware (Session 3+):** Haptics, Wake Lock, Ambient Light, Speech Recognition, Web Share, WebAuthn, Badging API, ResizeObserver
- **Layer 4 — Swibe (future):** WebGPU generative shaders, Liquid Glass refraction, DNA-to-style-matrix, Rive/Lottie per-brand animated assets

## Style Tokens

| Token | Value |
|---|---|
| `--glass-bg` | `rgba(255,255,255,0.05)` |
| `--glass-border` | `rgba(255,255,255,0.1)` |
| `--glass-blur` | `20px` |
| `--accent-primary` | `#6366f1` (indigo) |
| `--accent-secondary` | `#8b5cf6` (violet) |
| `--accent-glow` | `#a78bfa` (glow state) |
| `--surface-1` | `#0f0f13` |
| `--surface-2` | `#1a1a23` |
| `--surface-3` | `#252532` |

## Folder Structure

```
sacred-core-agency/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── ui/          (GlassCard, BentoGrid, CreditBadge, StatusPill)
│   │   │   ├── layout/      (Sidebar, TopBar, ProtectedRoute)
│   │   │   ├── portfolio/   (PortfolioGrid, PortfolioCard, PortfolioWorkspace)
│   │   │   └── leads/       (LeadsPanel)
│   │   ├── pages/           (Dashboard, Portfolio, Leads, Login)
│   │   ├── tabs/            (DNAProfile, PortfolioBuilder, Campaigns, AgentForge, SonicLab, WebsiteBuilder)
│   │   ├── store/           (authStore, portfolioStore, creditsStore)
│   │   ├── services/        (supabaseClient, dna, campaign, agent, sonic, website)
│   │   ├── hooks/           (useAuth, useCredits, usePortfolio, useHaptics, useWakeLock, useAmbientLight, useSpeechSearch)
│   │   ├── lib/             (motion, webapis, utils)
│   │   └── types/           (index.ts)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── package.json
├── server/
│   ├── src/
│   │   ├── index.ts
│   │   ├── plugins/         (cors, helmet, jwt, rateLimit)
│   │   ├── routes/          (auth, portfolios, dna, campaigns, leads, agents, sonic, credits)
│   │   ├── services/        (supabaseAdmin, gemini, elevenLabs, openClaw)
│   │   ├── middleware/      (requireAuth)
│   │   └── types/           (index.ts)
│   ├── tsconfig.json
│   └── package.json
├── supabase/
│   └── schema.sql
├── tests/
│   └── e2e/
│       └── .gitkeep
├── CONTEXT.md
├── .env.example
├── .gitignore
└── README.md
```

## Web API Enhancement Plan

| Session | APIs |
|---|---|
| Session 3 | Framer Motion, Lenis, View Transitions API, Haptics (Navigator.vibrate), Wake Lock, ResizeObserver |
| Session 5 | Ambient Light Sensor, Speech Recognition (Web Speech API) |
| Session 7 | Web Share API, WebAuthn, Badging API |
| Future/Swibe | WebGPU, Liquid Glass, Rive |

## Swibe Style Resolution Matrix (future reference)

| DNA Tone | Style |
|---|---|
| `bold/edgy` | Neubrutalism + Glitch |
| `luxury/clean` | Liquid Glass + Holographic |
| `playful/warm` | Claymorphism + Lottie |
| `professional` | Glassmorphism + Bento |
| `experimental` | Generative + Anti-Grid |

## Session Log

| Session | Focus | Status |
|---|---|---|
| 1 | Skeleton + config | ✅ Complete |
| 2 | Supabase schema + auth | ✅ Complete |
| 3 | Dashboard shell + motion | ✅ Complete |
| 4 | DNA Extraction (Gemini) | ✅ Complete |
| 5 | Portfolio Builder + Campaigns | ✅ Complete |
| 6 | Agent Forge (OpenClaw) | ✅ Complete |
| 7 | Sonic Lab (ElevenLabs) | ✅ Complete |
| 8 | Website Builder | ✅ Complete |
| 9 | Lead + Closing Agents | ✅ Complete |
| 10 | Credit gating + E2E tests | ⬜ Next |

## Auth Architecture

- Supabase Auth handles sessions (signInWithPassword, onAuthStateChange)
- JWT verified on every server request by both fastify-jwt AND supabaseAdmin.auth.getUser()
- public.users extends auth.users via the `handle_new_user` trigger (auto-creates profile on signup)
- RLS enforces tenant isolation on all 9 tables (SELECT/INSERT/UPDATE/DELETE only where user_id = auth.uid())
- Credits stored in public.users.credits (default: 500 for starter tier)
- All credit mutations logged to credit_transactions table
- Server uses SUPABASE_URL (non-VITE) + SUPABASE_SERVICE_ROLE_KEY (bypasses RLS for admin ops)
- Frontend uses VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (respects RLS)

## Content Generation Architecture

- **Portfolio Report:** 30 credits, `geminiService.generatePortfolioContent` → returns headline/tagline/about/services/caseStudyHook/callToAction → jspdf client-side PDF (up to 4 pages: header, services+CTA, SWOT, personas)
- **Campaigns:** 30 credits, `geminiService.generateCampaignAssets` → returns `CampaignAsset[]` with hashtags + mediaDescription → saved to `campaigns` table
- **Both require DNA profile** to exist on portfolio (`portfolio.dna_profile_id` must be set)
- **tab:switch CustomEvent:** child tabs emit `new CustomEvent('tab:switch', { detail: { tab: 'DNA Profile' } })` → `PortfolioWorkspace` listens and updates `activeTab`
- **Speech Recognition:** wired in `CampaignsTab` title input and `LeadsPanel` search via `useSpeechSearch` hook
- **Ambient Light:** `useAmbientLight` polls every 5s, adjusts `--glass-opacity` CSS var (0.08 bright / 0.05 normal / 0.03 dark)
- **Real API data:** `DashboardPage` fetches portfolios from `GET /api/portfolios` + user credits from Supabase client; `PortfolioPage` reads from portfolioStore
- **New Portfolio modal:** in `PortfolioGrid`, calls `POST /api/portfolios`, navigates to new workspace on success

## Website Builder Architecture

- **Cost:** 40 credits per generation, logged to `credit_transactions` as `website_generate`
- **DNA tone auto-maps to style preset:** `bold/edgy` → `neubrutalism`, `luxury/clean` → `minimal`, `playful/warm` → `claymorphism`, `professional` → `glassmorphism`, `experimental` → `bold`; mapping lives in both `geminiService.mapToneToStylePreset()` and `WebsiteBuilderTab` (local duplicate, keeps frontend independent)
- **Gemini generates:** JSON `{ html, css, js, pageName }` — HTML body only (no outer wrapper); server assembles into complete file with Tailwind CDN `<script src="https://cdn.tailwindcss.com">`
- **Stored in `websites` table:** `id, portfolio_id, user_id, company_name, full_html, style_preset, created_at`; RLS via `user_id = auth.uid()`
- **`includePortfolioContent` flag:** if true, parses DNA `raw_gemini_output` for `summary`/`values` to enrich website prompt; if no stored portfolio report exists, proceeds with DNA only (no extra cost)
- **Routes:** `POST /generate` (200), `GET /:portfolioId` (list without `full_html`), `GET /html/:websiteId` (full HTML only); `/html/:websiteId` registered before `/:portfolioId` (static prefix beats param in Fastify radix router)
- **Preview:** `<iframe srcDoc={fullHtml} sandbox="allow-scripts allow-same-origin">` — sandboxed, no navigation
- **Open in new tab:** `Blob` URL created from `fullHtml`, opened via `window.open`, revoked after 10s via `setTimeout`
- **ZIP export:** `jszip` creates `index.html` + `README.txt`, triggers browser download, `triggerHaptic([50,30,50])` on complete
- **Version history:** loads on mount via `GET /api/website/:portfolioId`; each version has Load (fetches + sets in iframe) and Download ZIP buttons; "Load" scrolls to preview section
- **Wake Lock:** active during generation (`isGenerating`)
- **Progress bar:** `useInterval` increments 0→95% over 12s, jumps to 100% on completion
- **Badge:** `updateAppBadge(versions.length + 1)` on successful generation

## Sonic Lab Architecture

- **Voice generation:** 15 credits, ElevenLabs `POST /text-to-speech/:voiceId` REST endpoint, model `eleven_monolingual_v1`, default Rachel voice (`21m00Tcm4TlvDq8ikWAM`)
- **Jingle generation:** 25 credits, ElevenLabs `POST /sound-generation` REST endpoint (falls back to TTS on free tier, logs warning)
- **Audio storage:** Supabase Storage bucket `sonic-identities` (public), path `userId/portfolioId/timestamp-name.mp3`; URL extracted for delete via `/object/public/sonic-identities/` marker
- **DNA context:** If portfolio has DNA, prompt is prepended with `"For [company] brand with [tone] tone and values [values]: [original prompt]"`
- **Available voices:** `GET /api/sonic/voices` → filters ElevenLabs `/voices` to `category: 'premade'` only; must be registered before `/:portfolioId` in Fastify
- **Type detection heuristic:** `duration_seconds > 10 → 🎵 jingle, else → 🎙️ voice`; voice submissions send `durationSeconds: 5` so icon renders correctly
- **Web Share:** `shareContent({ title, text?, url?, file? })` — wired on sonic identities (`title: name, text: 'Brand audio...', url: audio_url`) and campaign assets (`title: campaign + platform, text: content`); uses `navigator.canShare` check
- **WebAuthn:** `registerWebAuthn()` — credential registration on LoginPage with biometric button (platform authenticator, userVerification required); full auth flow post-launch
- **Badging API:** `updateAppBadge(count)` — updates on sonic generation (`length + 1`) and deletion (`new length`); uses `navigator.setAppBadge` / `clearAppBadge`
- **Wake Lock:** active during generation (`isGenerating`)
- **Frontend 2-column layout:** generator (type toggle, form, progress, preview audio) | library (list with inline play, share, delete confirm)

## Agent Forge Architecture

- **OpenClaw daemon:** `ws://localhost:18789` (configurable via `OPENCLAW_WS_URL` env var) — server-side only
- **Graceful degradation:** `openClawClient.isConnected()` checked before spawn/message → returns 503 → frontend shows offline banner, no credits deducted
- **Credits:** spawn agent = 20 credits, send message = 10 credits; both logged to `credit_transactions`
- **Spawn flow:** POST /api/agents/spawn → OpenClaw `spawnAgent` → INSERT agents table → deduct credits; requires DNA profile
- **Message flow:** POST /api/agents/:agentId/message → OpenClaw `sendMessage` → append User/Agent logs to DB → deduct credits
- **WS stream:** `/ws/agent/:agentId?token=<supabase_jwt>` — `noServer` WebSocketServer, upgrade handler on `server.server`; verified via `supabaseAdmin.auth.getUser(token)`; forwards OpenClaw `streamLogs` to client; ws.close(4001) unauthorized / 4003 forbidden
- **Agents table:** `id, portfolio_id, user_id, name, tools[], status(idle/running/error), session_id, logs[]`
- **Valid tools:** `scrape`, `email`, `calendar`, `post`, `sonic_gen`, `website_gen`, `research`, `analyze`
- **Terminate:** DELETE /api/agents/:agentId → `openClawClient.terminateAgent(session_id)` (non-fatal) → status=idle, session_id=null
- **Frontend 3-column layout:** roster (240px) | chat (1fr) | intel (240px)
- **WS dedup:** WS stream appends system logs only (non `User:` / `Agent:` prefixed); user/agent conversation managed via REST response to avoid duplicates
- **Wake Lock:** active during spawning (`isSpawning`) and while agent is running (`status === 'running'`)
- **OpenClaw protocol:** `{ type: "spawn"|"message"|"terminate"|"ack"|"response"|"log"|"end", session_id, ... }`
- **Pending request pattern:** Map keyed as `${sessionId}:spawn` or `${sessionId}:message`; all rejected on WS close
- **System prompt:** `buildAgentSystemPrompt` parses `raw_gemini_output` JSON for `summary` field to ground agent in brand DNA

## Lead & Closing Architecture

- **Search:** 10 credits, `geminiService.searchLeads` → ephemeral (not saved), returns `LeadSearchResult[]` (company_name, company_url, industry, description, location)
- **Analyze:** 15 credits, `geminiService.analyzeLead` → saves to `leads` table with pain_score, pain_summary, weaknesses (jsonb), opportunities (jsonb), status='new'
- **Pitch:** 20 credits, `geminiService.generatePitch` → fetches lead from DB, generates email, saves to `closings`, updates lead status='pitched'
- **Close:** stub send (post-launch: Nodemailer/SendGrid), updates closing status='sent' + lead status='converted'
- **Pipeline:** `GET /api/leads` ordered by pain_score DESC; filter by status (all/new/pitched/converted); each row expandable to show pain_summary, weaknesses, opportunities, and action buttons
- **Schema migration:** `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS weaknesses jsonb DEFAULT '[]', opportunities jsonb DEFAULT '[]'` — in schema.sql Session 9 section
- **LeadsPanel:** self-managing (no props); two sections: Discover (search form + ephemeral results with Analyze button) + Pipeline (saved leads with status filter + expand/collapse)
- **Speech Recognition:** `useSpeechSearch` wired to Discover search query input
- **Credits sync:** `deductOptimistic` before API call, `setBalance` with `credits_remaining` from response
- **Routes:** registered in order — POST /search, /analyze, /pitch, /close (all static) before GET /, PATCH /:leadId/status, GET /:leadId/closings (parameterized)

## DNA Extraction Architecture

- **Cost:** 50 credits per extraction, logged to `credit_transactions`
- **Gemini:** `@google/genai` v1.46.0 — `new GoogleGenAI({ apiKey })`, `ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt })`, text via `response.text`
- **Server flow:** POST /api/dna/extract → Zod validate → credit check → optimistic deduct → Gemini call → refund on failure → INSERT dna_profiles → UPDATE portfolios.dna_profile_id → log transaction
- **Frontend flow:** DNAProfileTab → usePortfolio.extractPortfolioDNA → dnaService.extractDNA (Bearer token) → store updates (activeDNAProfile, portfolios, credits)
- **Load flow:** On mount, if portfolio.dna_profile_id exists → GET /api/dna/:portfolioId → setActiveDNAProfile
- **Raw output:** Full Gemini JSON (tone, colors, values, personas, swot, summary) stored in `raw_gemini_output`; `summary` field parsed for display
- **Tab switching:** PortfolioWorkspace uses `useState<Tab>`, AnimatePresence mode="wait", `layoutId="tabIndicator"` for sliding indicator

## Motion System

- All variants defined in `lib/motion.ts`: `fadeUp`, `fadeIn`, `scaleIn`, `slideInLeft`, `slideInRight`, `staggerContainer`, `glassHover`, `glassGlow`
- Lenis initialized in `main.tsx` (RAF loop, duration 1.2, custom easing, smoothWheel)
- View Transitions on all navigation via `document.startViewTransition` in Sidebar + PortfolioCard
- Hardware: Haptics (`Navigator.vibrate`) implemented in `lib/webapis.ts` + `hooks/useHaptics.ts`
- Hardware: Wake Lock (`navigator.wakeLock.request`) implemented in `lib/webapis.ts` + `hooks/useWakeLock.ts`; active on DashboardPage; re-acquired on visibility change
- ResizeObserver pattern: Sidebar dispatches `sidebar:toggle` CustomEvent; BentoGrid + TopBar + ProtectedRoute listen and reflow via Framer Motion layout animation
- Mock data: `lib/mockData.ts` exports `mockUser`, `mockPortfolios` (4), `mockLeads` (3) — all typed against `types/index.ts`

## Rules (enforce in every session)

- No files at repo root except the 6 listed (package.json, .env.example, .gitignore, README.md, CONTEXT.md, and tests/e2e/.gitkeep via tests/)
- No packages outside approved list
- No business logic before its session
- No API calls in frontend (all go through /server)
- Read this file before every session starts
- One feature per session. Test before advancing.
