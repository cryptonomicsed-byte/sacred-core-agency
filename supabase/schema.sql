-- Sacred Core Agency — Supabase Schema
-- Session 2: Full implementation with RLS

-- ═══════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════

-- Users (extends auth.users via trigger)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  tier text NOT NULL DEFAULT 'starter'
    CHECK (tier IN ('starter', 'pro', 'enterprise')),
  credits integer NOT NULL DEFAULT 500,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Portfolios (tenant workspace per client)
CREATE TABLE IF NOT EXISTS public.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  company_url text,
  logo_url text,
  industry text,
  dna_profile_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- DNA Profiles (Gemini DNA extraction results)
CREATE TABLE IF NOT EXISTS public.dna_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tone text NOT NULL DEFAULT 'professional'
    CHECK (tone IN ('bold/edgy', 'luxury/clean', 'playful/warm', 'professional', 'experimental')),
  colors text[] DEFAULT '{}',
  "values" text[] DEFAULT '{}',
  personas text[] DEFAULT '{}',
  swot jsonb DEFAULT '{}',
  raw_gemini_output text,
  created_at timestamptz DEFAULT now()
);

-- Campaigns (multi-platform campaign assets)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  platforms text[] DEFAULT '{}',
  assets jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published')),
  scheduled_for timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Leads (geo-found leads with pain score)
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  company_url text,
  pain_score integer DEFAULT 0
    CHECK (pain_score >= 0 AND pain_score <= 100),
  pain_summary text,
  pitch_draft text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'pitched', 'converted')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Closings (pitch emails sent to leads)
CREATE TABLE IF NOT EXISTS public.closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_subject text NOT NULL,
  email_body text NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'replied')),
  created_at timestamptz DEFAULT now()
);

-- Agents (OpenClaw agent instances)
CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  tools text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'running', 'error')),
  session_id text,
  logs jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Sonic Identities (ElevenLabs audio generations)
CREATE TABLE IF NOT EXISTS public.sonic_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  audio_url text NOT NULL,
  prompt_used text NOT NULL,
  duration_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Credit Transactions (credit ledger)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  credits_used integer NOT NULL,
  balance_after integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sonic_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users: can only access their own row
CREATE POLICY "Users can select own row" ON public.users
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can insert own row" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "Users can update own row" ON public.users
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can delete own row" ON public.users
  FOR DELETE USING (id = auth.uid());

-- Portfolios: tenant isolation
CREATE POLICY "Users can select own portfolios" ON public.portfolios
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own portfolios" ON public.portfolios
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own portfolios" ON public.portfolios
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own portfolios" ON public.portfolios
  FOR DELETE USING (user_id = auth.uid());

-- DNA Profiles: tenant isolation
CREATE POLICY "Users can select own dna_profiles" ON public.dna_profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own dna_profiles" ON public.dna_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own dna_profiles" ON public.dna_profiles
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own dna_profiles" ON public.dna_profiles
  FOR DELETE USING (user_id = auth.uid());

-- Campaigns: tenant isolation
CREATE POLICY "Users can select own campaigns" ON public.campaigns
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own campaigns" ON public.campaigns
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own campaigns" ON public.campaigns
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own campaigns" ON public.campaigns
  FOR DELETE USING (user_id = auth.uid());

-- Leads: tenant isolation
CREATE POLICY "Users can select own leads" ON public.leads
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own leads" ON public.leads
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own leads" ON public.leads
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own leads" ON public.leads
  FOR DELETE USING (user_id = auth.uid());

-- Closings: tenant isolation
CREATE POLICY "Users can select own closings" ON public.closings
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own closings" ON public.closings
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own closings" ON public.closings
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own closings" ON public.closings
  FOR DELETE USING (user_id = auth.uid());

-- Agents: tenant isolation
CREATE POLICY "Users can select own agents" ON public.agents
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own agents" ON public.agents
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own agents" ON public.agents
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own agents" ON public.agents
  FOR DELETE USING (user_id = auth.uid());

-- Sonic Identities: tenant isolation
CREATE POLICY "Users can select own sonic_identities" ON public.sonic_identities
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own sonic_identities" ON public.sonic_identities
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own sonic_identities" ON public.sonic_identities
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own sonic_identities" ON public.sonic_identities
  FOR DELETE USING (user_id = auth.uid());

-- Credit Transactions: tenant isolation
CREATE POLICY "Users can select own credit_transactions" ON public.credit_transactions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own credit_transactions" ON public.credit_transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own credit_transactions" ON public.credit_transactions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own credit_transactions" ON public.credit_transactions
  FOR DELETE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires on every new auth.users row
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto-update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ═══════════════════════════════════════════
-- SESSION 8 — WEBSITE BUILDER
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id)
    ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id)
    ON DELETE CASCADE NOT NULL,
  company_name text NOT NULL,
  full_html text NOT NULL,
  style_preset text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_websites" ON public.websites
  FOR ALL USING (user_id = auth.uid());

-- ═══════════════════════════════════════════
-- SESSION 9 — LEAD + CLOSING AGENTS
-- ═══════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS weaknesses jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS opportunities jsonb DEFAULT '[]';
