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
-- 11. COACHES TABLE (Internal coaches who deliver services)
-- ============================================
CREATE TABLE IF NOT EXISTS public.coaches (
  id TEXT PRIMARY KEY, -- 'ray', 'priscilla', 'eddie'
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  stripe_account_id TEXT, -- For direct payments
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default coaches
INSERT INTO public.coaches (id, name, email) VALUES
  ('ray', 'Ray', 'raypaull1010@gmail.com'),
  ('priscilla', 'Priscilla', 'priscilla@rayspickleball.com'),
  ('eddie', 'Eddie', 'eddie@rayspickleball.com')
ON CONFLICT (id) DO NOTHING;

-- Anyone can read coaches
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read coaches" ON public.coaches
  FOR SELECT USING (true);

-- ============================================
-- 12. ADD coach_name TO EXISTING TABLES
-- ============================================

-- Add coach_name to video_submissions
ALTER TABLE public.video_submissions
  ADD COLUMN IF NOT EXISTS coach_name TEXT DEFAULT 'ray';

-- Add coach_name to skill_evaluations
ALTER TABLE public.skill_evaluations
  ADD COLUMN IF NOT EXISTS coach_name TEXT DEFAULT 'ray';

-- Create index for coach filtering
CREATE INDEX IF NOT EXISTS idx_video_submissions_coach ON public.video_submissions(coach_name);
CREATE INDEX IF NOT EXISTS idx_skill_evaluations_coach ON public.skill_evaluations(coach_name);

-- ============================================
-- 13. GAMIFICATION SYSTEM
-- ============================================

-- User XP and Level tracking
CREATE TABLE IF NOT EXISTS public.user_gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- XP History/Transactions (for tracking what earned XP)
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  action_type TEXT NOT NULL, -- 'login', 'streak_bonus', 'video_submit', 'drill_complete', 'badge_earned', 'referral', 'community_help'
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badge Definitions
CREATE TABLE IF NOT EXISTS public.badge_definitions (
  id TEXT PRIMARY KEY, -- e.g., 'first_video', 'streak_7', 'helper_5'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL, -- emoji or icon class
  category TEXT NOT NULL, -- 'achievement', 'streak', 'social', 'skill', 'milestone'
  xp_reward INTEGER DEFAULT 0,
  requirement_type TEXT NOT NULL, -- 'count', 'streak', 'milestone', 'special'
  requirement_value INTEGER DEFAULT 1,
  requirement_action TEXT, -- what action triggers this badge
  is_hidden BOOLEAN DEFAULT FALSE, -- secret badges
  rarity TEXT DEFAULT 'common', -- 'common', 'uncommon', 'rare', 'epic', 'legendary'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Earned Badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id TEXT REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  is_displayed BOOLEAN DEFAULT TRUE, -- user can choose to display or hide
  UNIQUE(user_id, badge_id)
);

-- Daily Check-ins (for streak tracking)
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  streak_day INTEGER DEFAULT 1, -- which day of the streak this was
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);

-- Leaderboard Cache (updated periodically for performance)
CREATE TABLE IF NOT EXISTS public.leaderboard_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- 'weekly', 'monthly', 'alltime'
  xp_earned INTEGER DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period)
);

-- Activity Feed (what members are doing)
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'badge_earned', 'level_up', 'streak_milestone', 'video_submitted', 'drill_completed'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  is_public BOOLEAN DEFAULT TRUE, -- show in community feed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all gamification tables
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gamification

-- user_gamification: Users can read all (for leaderboards), update own
CREATE POLICY "Anyone can read gamification stats" ON public.user_gamification
  FOR SELECT USING (true);
CREATE POLICY "Users can update own gamification" ON public.user_gamification
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert gamification" ON public.user_gamification
  FOR INSERT WITH CHECK (true);

-- xp_transactions: Users can read own
CREATE POLICY "Users can read own XP transactions" ON public.xp_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert XP transactions" ON public.xp_transactions
  FOR INSERT WITH CHECK (true);

-- badge_definitions: Anyone can read
CREATE POLICY "Anyone can read badge definitions" ON public.badge_definitions
  FOR SELECT USING (NOT is_hidden OR EXISTS (
    SELECT 1 FROM public.user_badges WHERE user_id = auth.uid() AND badge_id = id
  ));

-- user_badges: Anyone can read (for profiles), users manage own display
CREATE POLICY "Anyone can read user badges" ON public.user_badges
  FOR SELECT USING (true);
CREATE POLICY "Users can update own badge display" ON public.user_badges
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert user badges" ON public.user_badges
  FOR INSERT WITH CHECK (true);

-- daily_checkins: Users can read own
CREATE POLICY "Users can read own checkins" ON public.daily_checkins
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert checkins" ON public.daily_checkins
  FOR INSERT WITH CHECK (true);

-- leaderboard_cache: Anyone can read
CREATE POLICY "Anyone can read leaderboard" ON public.leaderboard_cache
  FOR SELECT USING (true);

-- activity_feed: Public activities visible to all, private only to owner
CREATE POLICY "Public activities visible to all" ON public.activity_feed
  FOR SELECT USING (is_public OR auth.uid() = user_id);
CREATE POLICY "Service can insert activities" ON public.activity_feed
  FOR INSERT WITH CHECK (true);

-- Indexes for gamification tables
CREATE INDEX IF NOT EXISTS idx_user_gamification_xp ON public.user_gamification(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_gamification_level ON public.user_gamification(level DESC);
CREATE INDEX IF NOT EXISTS idx_user_gamification_streak ON public.user_gamification(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON public.xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created ON public.xp_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period_rank ON public.leaderboard_cache(period, rank);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON public.activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_public ON public.activity_feed(is_public, created_at DESC);

-- ============================================
-- 14. BADGE DEFINITIONS
-- ============================================
-- Full badge set (309 badges) is in database/badge-migration.sql
-- Run that migration to populate all badges.
-- Badges are managed via the admin panel Badges tab and stored in the badge_definitions table.
-- Below are the core/seed badges for initial setup:

INSERT INTO public.badge_definitions (id, name, description, icon, category, xp_reward, requirement_type, requirement_value, requirement_action, rarity) VALUES
  ('first_login', 'Welcome!', 'Logged in for the first time', '👋', 'achievement', 10, 'milestone', 1, 'login', 'common'),
  ('first_video', 'Video Rookie', 'Submitted your first video for analysis', '🎬', 'achievement', 50, 'milestone', 1, 'video_submit', 'common'),
  ('first_drill', 'Drill Starter', 'Completed your first AI drill session', '🏃', 'achievement', 25, 'milestone', 1, 'drill_complete', 'common')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 15. GAMIFICATION HELPER FUNCTIONS
-- ============================================

-- Function to calculate level from XP (every 100 XP = 1 level, with increasing requirements)
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Level formula: Level = floor(sqrt(xp / 50)) + 1
  -- Level 1: 0-49 XP, Level 2: 50-199 XP, Level 3: 200-449 XP, etc.
  RETURN GREATEST(1, FLOOR(SQRT(xp::FLOAT / 50)) + 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate XP needed for next level
CREATE OR REPLACE FUNCTION xp_for_level(level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Inverse of level formula
  RETURN ((level - 1) * (level - 1)) * 50;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 16. SOCIAL FEATURES & MEMBER PROFILES
-- ============================================

-- Enhanced Member Profiles
CREATE TABLE IF NOT EXISTS public.member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  skill_level DECIMAL(2,1), -- 2.5 to 5.5
  dupr_rating DECIMAL(3,2),
  preferred_play_style TEXT, -- 'aggressive', 'defensive', 'balanced'
  dominant_hand TEXT, -- 'right', 'left', 'ambidextrous'
  years_playing INTEGER,
  favorite_paddle TEXT,
  location_city TEXT,
  location_state TEXT,
  location_zip TEXT,
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  looking_for_partners BOOLEAN DEFAULT FALSE,
  availability JSONB DEFAULT '{}', -- {"monday": ["morning", "evening"], ...}
  social_links JSONB DEFAULT '{}', -- {"instagram": "...", "facebook": "..."}
  is_public BOOLEAN DEFAULT TRUE,
  show_on_leaderboard BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player Connections (friends/following)
CREATE TABLE IF NOT EXISTS public.player_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'following', -- 'following', 'friends' (mutual), 'blocked'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Partner Match Requests
CREATE TABLE IF NOT EXISTS public.partner_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  target_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT,
  play_date DATE,
  play_time TEXT, -- 'morning', 'afternoon', 'evening'
  location TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(requester_id, target_id, play_date)
);

-- Challenges between members
CREATE TABLE IF NOT EXISTS public.member_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  challenged_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  challenge_type TEXT NOT NULL, -- 'drill_completion', 'streak_race', 'xp_battle', 'custom'
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT, -- 'count', 'duration', 'score'
  goal_value INTEGER,
  duration_days INTEGER DEFAULT 7,
  stakes TEXT, -- Optional: what the loser does
  xp_reward INTEGER DEFAULT 100,
  status TEXT DEFAULT 'pending', -- 'pending', 'active', 'completed', 'declined', 'expired'
  winner_id UUID REFERENCES public.users(id),
  challenger_progress INTEGER DEFAULT 0,
  challenged_progress INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progress/Stats Tracking (for visual progression)
CREATE TABLE IF NOT EXISTS public.player_stats_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  skill_level DECIMAL(2,1),
  games_played INTEGER DEFAULT 0,
  drills_completed INTEGER DEFAULT 0,
  practice_minutes INTEGER DEFAULT 0,
  videos_analyzed INTEGER DEFAULT 0,
  strengths JSONB DEFAULT '[]', -- ["dinks", "serves"]
  weaknesses JSONB DEFAULT '[]', -- ["third_shot_drop", "positioning"]
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, stat_date)
);

-- Video Analysis Progress (before/after tracking)
CREATE TABLE IF NOT EXISTS public.analysis_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES public.video_submissions(id) ON DELETE SET NULL,
  analysis_date DATE NOT NULL,
  skill_ratings JSONB DEFAULT '{}', -- {"dinks": 7, "serves": 8, "positioning": 6}
  coach_notes TEXT,
  improvement_areas JSONB DEFAULT '[]',
  strengths_identified JSONB DEFAULT '[]',
  overall_rating DECIMAL(2,1),
  compared_to_previous JSONB DEFAULT '{}', -- {"dinks": +1, "serves": 0}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Membership Tiers & Perks
CREATE TABLE IF NOT EXISTS public.membership_tiers (
  id TEXT PRIMARY KEY, -- 'monthly', '6_month', 'annual'
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  duration_months INTEGER NOT NULL,
  perks JSONB NOT NULL, -- List of perk IDs
  discount_video_analysis INTEGER DEFAULT 0, -- Percentage discount
  discount_skill_eval INTEGER DEFAULT 0,
  free_monthly_videos INTEGER DEFAULT 0,
  priority_support BOOLEAN DEFAULT FALSE,
  exclusive_content BOOLEAN DEFAULT FALSE,
  badge_id TEXT REFERENCES public.badge_definitions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert membership tiers with perks
INSERT INTO public.membership_tiers (id, name, price_cents, duration_months, perks, discount_video_analysis, discount_skill_eval, free_monthly_videos, priority_support, exclusive_content) VALUES
  ('monthly', 'Monthly Member', 1999, 1,
   '["ai_drill_coach", "drill_playbook", "community_access", "progress_tracking"]',
   10, 10, 0, FALSE, FALSE),
  ('6_month', '6-Month Member', 9999, 6,
   '["ai_drill_coach", "drill_playbook", "community_access", "progress_tracking", "monthly_live_qa", "exclusive_drills", "partner_matching"]',
   15, 15, 1, TRUE, TRUE),
  ('annual', 'Annual Member', 19900, 12,
   '["ai_drill_coach", "drill_playbook", "community_access", "progress_tracking", "monthly_live_qa", "exclusive_drills", "partner_matching", "free_skill_eval", "priority_booking", "annual_badge"]',
   20, 25, 2, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  perks = EXCLUDED.perks,
  discount_video_analysis = EXCLUDED.discount_video_analysis,
  discount_skill_eval = EXCLUDED.discount_skill_eval,
  free_monthly_videos = EXCLUDED.free_monthly_videos,
  priority_support = EXCLUDED.priority_support,
  exclusive_content = EXCLUDED.exclusive_content;

-- Add membership badges
INSERT INTO public.badge_definitions (id, name, description, icon, category, xp_reward, requirement_type, requirement_value, requirement_action, rarity) VALUES
  ('member_6_month', '6-Month Supporter', 'Committed to 6 months of improvement', '💪', 'milestone', 150, 'special', 1, 'membership', 'uncommon'),
  ('member_annual', 'Annual Champion', 'Dedicated yearly member', '🏆', 'milestone', 300, 'special', 1, 'membership', 'rare'),
  ('founding_member', 'Founding Member', 'One of the first 100 members', '🌟', 'achievement', 500, 'special', 1, 'special', 'legendary')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on social tables
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social features

-- member_profiles: Public profiles visible to all, users manage own
CREATE POLICY "Public profiles visible to all" ON public.member_profiles
  FOR SELECT USING (is_public OR auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.member_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.member_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- player_connections: Users can see own and public connections
CREATE POLICY "Users can see own connections" ON public.player_connections
  FOR SELECT USING (auth.uid() = follower_id OR auth.uid() = following_id);
CREATE POLICY "Users can manage own connections" ON public.player_connections
  FOR ALL USING (auth.uid() = follower_id);

-- partner_requests: Users can see own requests
CREATE POLICY "Users can see own partner requests" ON public.partner_requests
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_id);
CREATE POLICY "Users can create partner requests" ON public.partner_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update requests they're involved in" ON public.partner_requests
  FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- member_challenges: Participants can see challenges
CREATE POLICY "Challenge participants can see" ON public.member_challenges
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
CREATE POLICY "Users can create challenges" ON public.member_challenges
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Participants can update challenges" ON public.member_challenges
  FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- player_stats_history: Users can see own stats
CREATE POLICY "Users can see own stats" ON public.player_stats_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert stats" ON public.player_stats_history
  FOR INSERT WITH CHECK (true);

-- analysis_progress: Users can see own progress
CREATE POLICY "Users can see own analysis progress" ON public.analysis_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert analysis progress" ON public.analysis_progress
  FOR INSERT WITH CHECK (true);

-- membership_tiers: Anyone can read
CREATE POLICY "Anyone can read membership tiers" ON public.membership_tiers
  FOR SELECT USING (true);

-- Indexes for social tables
CREATE INDEX IF NOT EXISTS idx_member_profiles_location ON public.member_profiles(location_state, location_city);
CREATE INDEX IF NOT EXISTS idx_member_profiles_looking ON public.member_profiles(looking_for_partners) WHERE looking_for_partners = TRUE;
CREATE INDEX IF NOT EXISTS idx_member_profiles_skill ON public.member_profiles(skill_level);
CREATE INDEX IF NOT EXISTS idx_player_connections_follower ON public.player_connections(follower_id);
CREATE INDEX IF NOT EXISTS idx_player_connections_following ON public.player_connections(following_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_target ON public.partner_requests(target_id, status);
CREATE INDEX IF NOT EXISTS idx_member_challenges_status ON public.member_challenges(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_player_stats_user_date ON public.player_stats_history(user_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_progress_user ON public.analysis_progress(user_id, analysis_date DESC);

-- ============================================
-- 17. INITIAL DATA (OPTIONAL)
-- ============================================

-- Set launch date for grace period calculation (adjust this date to your actual launch)
-- UPDATE public.instructors
-- SET grace_period_ends = '2025-05-01'::TIMESTAMPTZ + INTERVAL '90 days'
-- WHERE grace_period_ends IS NULL;
