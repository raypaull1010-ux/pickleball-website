-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 🎮 DIGITAL AVATAR SYSTEM - Database Schema
-- Ray's Pickleball Platform
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- PLAYER AVATARS
-- Core avatar profile with stats
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE player_avatars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Basic Info
    display_name VARCHAR(50) NOT NULL,
    title VARCHAR(100),  -- "The Dink Master", "Kitchen King", etc.
    avatar_emoji VARCHAR(10) DEFAULT '🏓',
    avatar_color_primary VARCHAR(7) DEFAULT '#667eea',
    avatar_color_secondary VARCHAR(7) DEFAULT '#764ba2',

    -- Core Stats (1-99 scale)
    stat_power INTEGER DEFAULT 50 CHECK (stat_power >= 1 AND stat_power <= 99),
    stat_finesse INTEGER DEFAULT 50 CHECK (stat_finesse >= 1 AND stat_finesse <= 99),
    stat_speed INTEGER DEFAULT 50 CHECK (stat_speed >= 1 AND stat_speed <= 99),
    stat_court_iq INTEGER DEFAULT 50 CHECK (stat_court_iq >= 1 AND stat_court_iq <= 99),
    stat_consistency INTEGER DEFAULT 50 CHECK (stat_consistency >= 1 AND stat_consistency <= 99),
    stat_mental INTEGER DEFAULT 50 CHECK (stat_mental >= 1 AND stat_mental <= 99),

    -- Calculated Overall Rating (auto-computed)
    overall_rating INTEGER GENERATED ALWAYS AS (
        ROUND((stat_power * 0.15 + stat_finesse * 0.20 + stat_speed * 0.15 +
               stat_court_iq * 0.20 + stat_consistency * 0.20 + stat_mental * 0.10)::numeric)
    ) STORED,

    -- Ranking Info
    rank_tier VARCHAR(20) DEFAULT 'Bronze',  -- Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster
    rank_division INTEGER DEFAULT 5 CHECK (rank_division >= 1 AND rank_division <= 5),  -- 5 = lowest, 1 = highest
    rank_points INTEGER DEFAULT 0,

    -- Tournament Stats
    tournaments_entered INTEGER DEFAULT 0,
    tournaments_won INTEGER DEFAULT 0,
    tournament_matches_played INTEGER DEFAULT 0,
    tournament_matches_won INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_tournament_at TIMESTAMPTZ,

    UNIQUE(user_id)
);

-- Index for leaderboard queries
CREATE INDEX idx_avatars_overall_rating ON player_avatars(overall_rating DESC);
CREATE INDEX idx_avatars_rank ON player_avatars(rank_tier, rank_division, rank_points DESC);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- STAT HISTORY
-- Track all stat changes over time
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE avatar_stat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avatar_id UUID NOT NULL REFERENCES player_avatars(id) ON DELETE CASCADE,

    -- What changed
    stat_name VARCHAR(20) NOT NULL,  -- 'power', 'finesse', 'speed', 'court_iq', 'consistency', 'mental'
    old_value INTEGER NOT NULL,
    new_value INTEGER NOT NULL,
    change_amount INTEGER GENERATED ALWAYS AS (new_value - old_value) STORED,

    -- Source of change
    source_type VARCHAR(30) NOT NULL,  -- 'coach_assessment', 'video_analysis', 'drill_completion', 'match_result', 'manual'
    source_id UUID,  -- Reference to the assessment/video/drill/match
    source_description TEXT,

    -- Who made the change (for coach assessments)
    assessed_by UUID REFERENCES users(id),
    coach_notes TEXT,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stat_history_avatar ON avatar_stat_history(avatar_id, created_at DESC);
CREATE INDEX idx_stat_history_source ON avatar_stat_history(source_type, source_id);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- COACH ASSESSMENTS
-- Full assessments from instructors
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE coach_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avatar_id UUID NOT NULL REFERENCES player_avatars(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES users(id),

    -- Stats at time of assessment
    power_rating INTEGER CHECK (power_rating >= 1 AND power_rating <= 99),
    finesse_rating INTEGER CHECK (finesse_rating >= 1 AND finesse_rating <= 99),
    speed_rating INTEGER CHECK (speed_rating >= 1 AND speed_rating <= 99),
    court_iq_rating INTEGER CHECK (court_iq_rating >= 1 AND court_iq_rating <= 99),
    consistency_rating INTEGER CHECK (consistency_rating >= 1 AND consistency_rating <= 99),
    mental_rating INTEGER CHECK (mental_rating >= 1 AND mental_rating <= 99),

    -- Feedback
    notes TEXT,
    strengths TEXT[],  -- Array of strength areas
    areas_to_improve TEXT[],  -- Array of improvement areas
    recommended_drills TEXT[],  -- Array of drill recommendations

    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'applied', 'rejected'
    applied_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assessments_avatar ON coach_assessments(avatar_id, created_at DESC);
CREATE INDEX idx_assessments_coach ON coach_assessments(coach_id, created_at DESC);
CREATE INDEX idx_assessments_pending ON coach_assessments(status) WHERE status = 'pending';

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- VIDEO ANALYSIS
-- AI-powered video analysis results
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE video_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avatar_id UUID NOT NULL REFERENCES player_avatars(id) ON DELETE CASCADE,

    -- Video Info
    video_url TEXT NOT NULL,
    video_duration_seconds INTEGER,
    video_filename VARCHAR(255),
    video_size_bytes BIGINT,

    -- Processing Status
    status VARCHAR(30) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed', 'applied'
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,

    -- Raw Analysis Data (JSON)
    raw_analysis JSONB,  -- Full AI output

    -- Extracted Metrics
    total_shots_detected INTEGER,
    shot_breakdown JSONB,  -- { "dinks": 45, "drives": 23, "drops": 12, "lobs": 5, "serves": 8 }

    placement_accuracy DECIMAL(5,2),  -- 0-100%
    court_coverage_score DECIMAL(5,2),  -- 0-100
    avg_reaction_time_ms INTEGER,
    rally_lengths JSONB,  -- Array of rally lengths

    -- Calculated Stat Suggestions
    suggested_power INTEGER CHECK (suggested_power >= 1 AND suggested_power <= 99),
    suggested_finesse INTEGER CHECK (suggested_finesse >= 1 AND suggested_finesse <= 99),
    suggested_speed INTEGER CHECK (suggested_speed >= 1 AND suggested_speed <= 99),
    suggested_court_iq INTEGER CHECK (suggested_court_iq >= 1 AND suggested_court_iq <= 99),
    suggested_consistency INTEGER CHECK (suggested_consistency >= 1 AND suggested_consistency <= 99),

    -- Confidence scores for each suggestion
    confidence_scores JSONB,  -- { "power": 0.85, "finesse": 0.92, ... }

    -- Coach Review (optional)
    reviewed_by UUID REFERENCES users(id),
    review_notes TEXT,
    approved BOOLEAN,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_avatar ON video_analyses(avatar_id, created_at DESC);
CREATE INDEX idx_video_status ON video_analyses(status);
CREATE INDEX idx_video_pending_review ON video_analyses(status, approved) WHERE status = 'completed' AND approved IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- TOURNAMENTS
-- Monthly digital tournaments
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tournament Info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,

    -- Configuration
    max_participants INTEGER DEFAULT 32,
    min_rating INTEGER DEFAULT 0,  -- Minimum overall rating to enter
    max_rating INTEGER DEFAULT 99,  -- Maximum overall rating to enter
    entry_fee_coins INTEGER DEFAULT 0,

    -- Prizes
    prize_badge_id UUID,  -- References badges table
    prize_coins_1st INTEGER DEFAULT 500,
    prize_coins_2nd INTEGER DEFAULT 250,
    prize_coins_3rd INTEGER DEFAULT 100,
    prize_xp INTEGER DEFAULT 1000,

    -- Status
    status VARCHAR(20) DEFAULT 'upcoming',  -- 'upcoming', 'registration', 'in_progress', 'completed', 'cancelled'
    registration_opens_at TIMESTAMPTZ,
    registration_closes_at TIMESTAMPTZ,

    -- Results
    winner_avatar_id UUID REFERENCES player_avatars(id),
    runner_up_avatar_id UUID REFERENCES player_avatars(id),
    third_place_avatar_id UUID REFERENCES player_avatars(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tournaments_status ON tournaments(status, start_date);
CREATE INDEX idx_tournaments_upcoming ON tournaments(start_date) WHERE status IN ('upcoming', 'registration');

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- TOURNAMENT ENTRIES
-- Players registered for tournaments
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE tournament_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    avatar_id UUID NOT NULL REFERENCES player_avatars(id) ON DELETE CASCADE,

    -- Snapshot of stats at entry time (for fairness)
    entry_power INTEGER NOT NULL,
    entry_finesse INTEGER NOT NULL,
    entry_speed INTEGER NOT NULL,
    entry_court_iq INTEGER NOT NULL,
    entry_consistency INTEGER NOT NULL,
    entry_mental INTEGER NOT NULL,
    entry_overall INTEGER NOT NULL,

    -- Bracket Position
    seed INTEGER,  -- 1-32 based on rating
    bracket_position INTEGER,  -- Position in bracket

    -- Results
    current_round INTEGER DEFAULT 0,
    eliminated BOOLEAN DEFAULT FALSE,
    final_placement INTEGER,  -- 1st, 2nd, 3rd, etc.

    -- Timestamps
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    eliminated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_entry_unique ON tournament_entries(tournament_id, avatar_id);
CREATE INDEX idx_entry_tournament ON tournament_entries(tournament_id, seed);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- TOURNAMENT MATCHES
-- Individual simulated matches
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE tournament_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

    -- Match Info
    round_number INTEGER NOT NULL,  -- 1 = Round of 32, 2 = Round of 16, etc.
    match_number INTEGER NOT NULL,  -- Match number within round

    -- Players
    player1_avatar_id UUID REFERENCES player_avatars(id),
    player2_avatar_id UUID REFERENCES player_avatars(id),

    -- Scores
    player1_score INTEGER,
    player2_score INTEGER,
    winner_avatar_id UUID REFERENCES player_avatars(id),

    -- Match Simulation Details
    simulation_seed BIGINT,  -- Random seed for reproducibility
    simulation_log JSONB,  -- Point-by-point simulation data
    key_moments JSONB,  -- Highlight moments from simulation

    -- Stat Performance (how each stat influenced the match)
    player1_stat_impact JSONB,  -- { "power": 12, "finesse": 8, ... } points won from each stat
    player2_stat_impact JSONB,

    -- Status
    status VARCHAR(20) DEFAULT 'scheduled',  -- 'scheduled', 'in_progress', 'completed'
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_match_tournament ON tournament_matches(tournament_id, round_number, match_number);
CREATE INDEX idx_match_player1 ON tournament_matches(player1_avatar_id);
CREATE INDEX idx_match_player2 ON tournament_matches(player2_avatar_id);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- DRILLS & CHALLENGES
-- Training activities that affect stats
-- ═══════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE drill_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    avatar_id UUID NOT NULL REFERENCES player_avatars(id) ON DELETE CASCADE,

    -- Drill Info
    drill_id VARCHAR(50) NOT NULL,  -- Reference to drill definition
    drill_name VARCHAR(100) NOT NULL,
    drill_category VARCHAR(50),  -- 'dinks', 'drives', 'serves', 'footwork', etc.

    -- Performance
    score INTEGER,  -- Score achieved
    max_score INTEGER,  -- Maximum possible
    time_seconds INTEGER,  -- Time to complete

    -- Stat Impact
    stat_affected VARCHAR(20),  -- Which stat this drill affects
    stat_bonus INTEGER DEFAULT 1,  -- How much the stat increased

    -- Timestamps
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drill_avatar ON drill_completions(avatar_id, completed_at DESC);
CREATE INDEX idx_drill_category ON drill_completions(drill_category);

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Function to update avatar stats from an assessment
CREATE OR REPLACE FUNCTION apply_coach_assessment(assessment_id UUID)
RETURNS VOID AS $$
DECLARE
    assessment RECORD;
    avatar RECORD;
    stat_names TEXT[] := ARRAY['power', 'finesse', 'speed', 'court_iq', 'consistency', 'mental'];
    stat_name TEXT;
    old_val INTEGER;
    new_val INTEGER;
BEGIN
    -- Get assessment
    SELECT * INTO assessment FROM coach_assessments WHERE id = assessment_id;
    IF assessment IS NULL THEN
        RAISE EXCEPTION 'Assessment not found';
    END IF;

    -- Get current avatar stats
    SELECT * INTO avatar FROM player_avatars WHERE id = assessment.avatar_id;

    -- Update each stat and log history
    IF assessment.power_rating IS NOT NULL AND assessment.power_rating != avatar.stat_power THEN
        INSERT INTO avatar_stat_history (avatar_id, stat_name, old_value, new_value, source_type, source_id, assessed_by, coach_notes)
        VALUES (avatar.id, 'power', avatar.stat_power, assessment.power_rating, 'coach_assessment', assessment_id, assessment.coach_id, assessment.notes);
    END IF;

    IF assessment.finesse_rating IS NOT NULL AND assessment.finesse_rating != avatar.stat_finesse THEN
        INSERT INTO avatar_stat_history (avatar_id, stat_name, old_value, new_value, source_type, source_id, assessed_by, coach_notes)
        VALUES (avatar.id, 'finesse', avatar.stat_finesse, assessment.finesse_rating, 'coach_assessment', assessment_id, assessment.coach_id, assessment.notes);
    END IF;

    IF assessment.speed_rating IS NOT NULL AND assessment.speed_rating != avatar.stat_speed THEN
        INSERT INTO avatar_stat_history (avatar_id, stat_name, old_value, new_value, source_type, source_id, assessed_by, coach_notes)
        VALUES (avatar.id, 'speed', avatar.stat_speed, assessment.speed_rating, 'coach_assessment', assessment_id, assessment.coach_id, assessment.notes);
    END IF;

    IF assessment.court_iq_rating IS NOT NULL AND assessment.court_iq_rating != avatar.stat_court_iq THEN
        INSERT INTO avatar_stat_history (avatar_id, stat_name, old_value, new_value, source_type, source_id, assessed_by, coach_notes)
        VALUES (avatar.id, 'court_iq', avatar.stat_court_iq, assessment.court_iq_rating, 'coach_assessment', assessment_id, assessment.coach_id, assessment.notes);
    END IF;

    IF assessment.consistency_rating IS NOT NULL AND assessment.consistency_rating != avatar.stat_consistency THEN
        INSERT INTO avatar_stat_history (avatar_id, stat_name, old_value, new_value, source_type, source_id, assessed_by, coach_notes)
        VALUES (avatar.id, 'consistency', avatar.stat_consistency, assessment.consistency_rating, 'coach_assessment', assessment_id, assessment.coach_id, assessment.notes);
    END IF;

    IF assessment.mental_rating IS NOT NULL AND assessment.mental_rating != avatar.stat_mental THEN
        INSERT INTO avatar_stat_history (avatar_id, stat_name, old_value, new_value, source_type, source_id, assessed_by, coach_notes)
        VALUES (avatar.id, 'mental', avatar.stat_mental, assessment.mental_rating, 'coach_assessment', assessment_id, assessment.coach_id, assessment.notes);
    END IF;

    -- Update avatar stats
    UPDATE player_avatars SET
        stat_power = COALESCE(assessment.power_rating, stat_power),
        stat_finesse = COALESCE(assessment.finesse_rating, stat_finesse),
        stat_speed = COALESCE(assessment.speed_rating, stat_speed),
        stat_court_iq = COALESCE(assessment.court_iq_rating, stat_court_iq),
        stat_consistency = COALESCE(assessment.consistency_rating, stat_consistency),
        stat_mental = COALESCE(assessment.mental_rating, stat_mental),
        updated_at = NOW()
    WHERE id = assessment.avatar_id;

    -- Mark assessment as applied
    UPDATE coach_assessments SET
        status = 'applied',
        applied_at = NOW()
    WHERE id = assessment_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate rank tier from points
CREATE OR REPLACE FUNCTION calculate_rank_tier(points INTEGER)
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN CASE
        WHEN points >= 5000 THEN 'Grandmaster'
        WHEN points >= 4000 THEN 'Master'
        WHEN points >= 3000 THEN 'Diamond'
        WHEN points >= 2000 THEN 'Platinum'
        WHEN points >= 1000 THEN 'Gold'
        WHEN points >= 500 THEN 'Silver'
        ELSE 'Bronze'
    END;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_avatars_timestamp
    BEFORE UPDATE ON player_avatars
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_assessments_timestamp
    BEFORE UPDATE ON coach_assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_videos_timestamp
    BEFORE UPDATE ON video_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tournaments_timestamp
    BEFORE UPDATE ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Leaderboard view
CREATE VIEW avatar_leaderboard AS
SELECT
    pa.id,
    pa.user_id,
    pa.display_name,
    pa.title,
    pa.avatar_emoji,
    pa.overall_rating,
    pa.rank_tier,
    pa.rank_division,
    pa.rank_points,
    pa.tournaments_won,
    pa.stat_power,
    pa.stat_finesse,
    pa.stat_speed,
    pa.stat_court_iq,
    pa.stat_consistency,
    pa.stat_mental,
    RANK() OVER (ORDER BY pa.overall_rating DESC, pa.rank_points DESC) as global_rank,
    RANK() OVER (PARTITION BY pa.rank_tier ORDER BY pa.rank_points DESC) as tier_rank
FROM player_avatars pa
ORDER BY overall_rating DESC, rank_points DESC;

-- Recent activity view
CREATE VIEW avatar_recent_activity AS
SELECT
    ash.avatar_id,
    ash.stat_name,
    ash.old_value,
    ash.new_value,
    ash.change_amount,
    ash.source_type,
    ash.source_description,
    ash.coach_notes,
    u.display_name as assessed_by_name,
    ash.created_at
FROM avatar_stat_history ash
LEFT JOIN users u ON ash.assessed_by = u.id
ORDER BY ash.created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════════════════
-- SAMPLE DATA (for testing)
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Insert sample tournament
INSERT INTO tournaments (name, description, start_date, status, registration_opens_at, registration_closes_at)
VALUES (
    'February Digital Championship',
    'Monthly tournament for all skill levels. Win exclusive badges and coins!',
    NOW() + INTERVAL '5 days',
    'registration',
    NOW() - INTERVAL '2 days',
    NOW() + INTERVAL '4 days'
);

-- Note: Sample avatars would be created when users register
