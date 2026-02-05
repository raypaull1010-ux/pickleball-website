-- Ray's Pickleball Website Database Schema
-- Run this in Supabase SQL Editor to set up all tables
--
-- IMPORTANT: Run these commands in order

-- ============================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'instructor', 'admin')),
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "Admins can read all users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert (for signup flow)
CREATE POLICY "Service role can insert users" ON public.users
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 2. VIDEO SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.video_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  -- Allow submissions without account (guest submissions)
  guest_name TEXT,
  guest_email TEXT,
  guest_phone TEXT,
  video_url TEXT NOT NULL,
  video_length INTEGER NOT NULL CHECK (video_length IN (30, 60)), -- minutes
  skill_level TEXT,
  focus_areas TEXT,
  referral_code_used TEXT,

  -- Pricing
  price_cents INTEGER NOT NULL,

  -- Status tracking
  status TEXT DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'payment_received', 'in_review', 'completed', 'cancelled'
  )),
  payment_method TEXT CHECK (payment_method IN ('stripe', 'venmo')),
  payment_id TEXT, -- Stripe payment intent ID or Venmo transaction reference
  paid_at TIMESTAMPTZ,

  -- Analysis results (stored as JSON)
  analysis_result JSONB,
  completed_at TIMESTAMPTZ,

  -- Emails
  stage1_email_sent BOOLEAN DEFAULT FALSE,
  stage2_email_sent BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.video_submissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own submissions
CREATE POLICY "Users can read own submissions" ON public.video_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read all submissions
CREATE POLICY "Admins can read all submissions" ON public.video_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update submissions
CREATE POLICY "Admins can update submissions" ON public.video_submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert (for form submissions)
CREATE POLICY "Service role can insert submissions" ON public.video_submissions
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 3. MEMBERSHIPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  -- Allow memberships without account initially
  guest_name TEXT,
  guest_email TEXT,

  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  price_cents INTEGER NOT NULL,

  status TEXT DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'active', 'paused', 'cancelled', 'expired'
  )),
  payment_method TEXT CHECK (payment_method IN ('stripe', 'venmo')),
  stripe_subscription_id TEXT,

  -- Dates
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Founding member tracking
  is_founding_member BOOLEAN DEFAULT FALSE,
  founding_member_number INTEGER,

  -- Referral
  referral_code_used TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- Users can read their own membership
CREATE POLICY "Users can read own membership" ON public.memberships
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read all memberships
CREATE POLICY "Admins can read all memberships" ON public.memberships
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update memberships
CREATE POLICY "Admins can update memberships" ON public.memberships
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert
CREATE POLICY "Service role can insert memberships" ON public.memberships
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 4. INSTRUCTORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),

  -- Profile info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  bio TEXT,
  photo_url TEXT,
  experience_years INTEGER,
  certifications TEXT[],
  specialties TEXT[],

  -- Referral tracking
  referral_code TEXT UNIQUE NOT NULL,
  total_referrals INTEGER DEFAULT 0,
  membership_referrals INTEGER DEFAULT 0, -- Counts toward grace period requirement

  -- Status and grace period
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'grace_period', 'paused', 'inactive'
  )),

  -- Grace period: 90 days from launch (set launch_date when site goes live)
  grace_period_start TIMESTAMPTZ DEFAULT NOW(),
  grace_period_ends TIMESTAMPTZ,

  -- Payment to maintain listing ($40)
  has_paid_fee BOOLEAN DEFAULT FALSE,
  fee_paid_at TIMESTAMPTZ,
  payment_id TEXT,

  -- Visibility (hidden if grace period expired without payment or 2+ referrals)
  is_visible BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible instructors
CREATE POLICY "Anyone can read visible instructors" ON public.instructors
  FOR SELECT USING (is_visible = TRUE);

-- Instructors can read their own profile
CREATE POLICY "Instructors can read own profile" ON public.instructors
  FOR SELECT USING (auth.uid() = user_id);

-- Instructors can update their own profile
CREATE POLICY "Instructors can update own profile" ON public.instructors
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can read all instructors
CREATE POLICY "Admins can read all instructors" ON public.instructors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can update all instructors
CREATE POLICY "Admins can update all instructors" ON public.instructors
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert
CREATE POLICY "Service role can insert instructors" ON public.instructors
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 5. REFERRALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who made the referral
  referrer_code TEXT NOT NULL,
  referrer_user_id UUID REFERENCES public.users(id),

  -- Who was referred
  referred_email TEXT NOT NULL,
  referred_user_id UUID REFERENCES public.users(id),

  -- What was purchased
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('video_analysis', 'membership', 'evaluation')),
  purchase_id UUID, -- Reference to the specific purchase
  purchase_amount_cents INTEGER,

  -- Status (30-day confirmation period)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- 30 days from creation

  -- Reward tracking
  reward_tier TEXT, -- 'bronze', 'silver', 'gold', 'platinum', 'legendary'
  reward_claimed BOOLEAN DEFAULT FALSE,
  reward_claimed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can read their own referrals (as referrer)
CREATE POLICY "Users can read own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);

-- Admins can read all referrals
CREATE POLICY "Admins can read all referrals" ON public.referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert
CREATE POLICY "Service role can insert referrals" ON public.referrals
  FOR INSERT WITH CHECK (true);

-- Service role can update (for confirmation)
CREATE POLICY "Service role can update referrals" ON public.referrals
  FOR UPDATE WITH CHECK (true);

-- ============================================
-- 6. SKILL EVALUATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.skill_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),

  -- Guest info (if no account)
  guest_name TEXT,
  guest_email TEXT,

  video_url TEXT NOT NULL,
  skill_level TEXT,
  focus_areas TEXT,

  -- Pricing ($35)
  price_cents INTEGER NOT NULL DEFAULT 3500,

  status TEXT DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment', 'payment_received', 'in_review', 'completed'
  )),
  payment_method TEXT CHECK (payment_method IN ('stripe', 'venmo')),
  payment_id TEXT,
  paid_at TIMESTAMPTZ,

  -- Results
  evaluation_result JSONB,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.skill_evaluations ENABLE ROW LEVEL SECURITY;

-- Users can read their own evaluations
CREATE POLICY "Users can read own evaluations" ON public.skill_evaluations
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "Admins can read all evaluations" ON public.skill_evaluations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role can insert
CREATE POLICY "Service role can insert evaluations" ON public.skill_evaluations
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 7. CONTESTS TABLE (Community Contests)
-- ============================================
CREATE TABLE IF NOT EXISTS public.contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  -- Dates
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  voting_ends TIMESTAMPTZ,

  -- Prize info
  prize_description TEXT,
  prize_value_cents INTEGER,

  status TEXT DEFAULT 'upcoming' CHECK (status IN (
    'upcoming', 'active', 'voting', 'completed'
  )),

  winner_entry_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;

-- Anyone can read contests
CREATE POLICY "Anyone can read contests" ON public.contests
  FOR SELECT USING (true);

-- Admins can create/update
CREATE POLICY "Admins can manage contests" ON public.contests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 8. CONTEST ENTRIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.contest_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),

  video_url TEXT NOT NULL,
  video_title TEXT,
  description TEXT,

  votes INTEGER DEFAULT 0,
  is_winner BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.contest_entries ENABLE ROW LEVEL SECURITY;

-- Anyone can read entries
CREATE POLICY "Anyone can read entries" ON public.contest_entries
  FOR SELECT USING (true);

-- Users can create their own entries
CREATE POLICY "Users can create entries" ON public.contest_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 9. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_video_submissions_updated_at
  BEFORE UPDATE ON public.video_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_instructors_updated_at
  BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_skill_evaluations_updated_at
  BEFORE UPDATE ON public.skill_evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to generate unique referral codes
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    -- Generate random 8-character code
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));

    -- Check if it exists
    SELECT COUNT(*) INTO exists_count
    FROM public.users WHERE referral_code = code;

    IF exists_count = 0 THEN
      SELECT COUNT(*) INTO exists_count
      FROM public.instructors WHERE referral_code = code;
    END IF;

    EXIT WHEN exists_count = 0;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update instructor visibility based on grace period
CREATE OR REPLACE FUNCTION check_instructor_grace_period()
RETURNS TRIGGER AS $$
BEGIN
  -- If grace period has ended
  IF NEW.grace_period_ends IS NOT NULL AND NEW.grace_period_ends < NOW() THEN
    -- Check if they've paid the fee OR have 2+ membership referrals
    IF NOT NEW.has_paid_fee AND NEW.membership_referrals < 2 THEN
      NEW.is_visible := FALSE;
      NEW.status := 'paused';
    ELSE
      NEW.is_visible := TRUE;
      NEW.status := 'active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_instructor_grace
  BEFORE UPDATE ON public.instructors
  FOR EACH ROW EXECUTE FUNCTION check_instructor_grace_period();

-- ============================================
-- 10. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_video_submissions_user ON public.video_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_video_submissions_status ON public.video_submissions(status);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.memberships(status);
CREATE INDEX IF NOT EXISTS idx_instructors_visible ON public.instructors(is_visible);
CREATE INDEX IF NOT EXISTS idx_instructors_referral_code ON public.instructors(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referrer_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);

-- ============================================
-- 11. INITIAL DATA (OPTIONAL)
-- ============================================

-- Set launch date for grace period calculation (adjust this date to your actual launch)
-- UPDATE public.instructors
-- SET grace_period_ends = '2025-05-01'::TIMESTAMPTZ + INTERVAL '90 days'
-- WHERE grace_period_ends IS NULL;
