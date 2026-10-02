# Sacred Core Agency

## What It Is

Sacred Core Agency is a B2B AI marketing agency platform that provides portfolio workspaces per client, competitive intelligence through automated lead discovery, and autonomous agent execution via OpenClaw. It is a credit-gated, revenue-generating SaaS built for marketing teams and agencies.

## Prerequisites

- Node 20+
- Supabase account (free tier ok)
- Gemini API key (ai.google.dev — free tier)
- ElevenLabs API key
- OpenClaw installed and running

## Setup

```bash
git clone <repo-url> sacred-core-agency
cd sacred-core-agency
cd frontend && npm install
cd ../server && npm install
cp .env.example .env.local  # fill in values
cd ..
npm run dev
```

## Dev Commands (from repo root)

```bash
npm run dev        # starts both frontend :3001 and server :4000 concurrently
npm run type-check # runs tsc --noEmit in both dirs
npm run test:e2e   # Playwright tests
```

## Session Progress

| # | Session | Status |
|---|---|---|
| 1 | Skeleton + config | ✅ Complete |
| 2 | Supabase schema + auth | ⬜ Next |
| 3 | Dashboard shell + motion | ⬜ Pending |
| 4 | DNA Extraction | ⬜ Pending |
| 5 | Portfolio + Campaigns | ⬜ Pending |
| 6 | Agent Forge | ⬜ Pending |
| 7 | Sonic Lab | ⬜ Pending |
| 8 | Website Builder | ⬜ Pending |
| 9 | Lead + Closing Agents | ⬜ Pending |
| 10 | Credits + E2E Tests | ⬜ Pending |

## Architecture

```
Frontend (:3001) → Vite proxy → Server (:4000)
Server → Supabase (DB + Auth + Storage)
Server → Gemini API (DNA, campaigns, leads)
Server → ElevenLabs (Sonic Lab audio)
Server → OpenClaw :18789 (Agent Forge)
```

## Security Notes

- All AI API keys are server-side only
- VITE_ prefix = browser-safe public keys only
- JWT required on all /api/* routes except /api/auth
- RLS enforced at database level
