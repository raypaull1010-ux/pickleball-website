// Weekly Shot Challenges API
// Handles all shot challenge operations including submissions, verification, and progress

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/api-shot-challenges', '');
  const method = event.httpMethod;

  try {
    // Get user from auth header if present
    let userId = null;
    const authHeader = event.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // Route handling
    switch (true) {
      // GET /api-shot-challenges - Get current week's challenges
      case method === 'GET' && path === '':
      case method === 'GET' && path === '/':
        return await getCurrentWeekChallenges(userId);

      // GET /api-shot-challenges/definitions - Get all challenge definitions
      case method === 'GET' && path === '/definitions':
        return await getAllChallengeDefinitions();

      // GET /api-shot-challenges/progress - Get user's weekly progress
      case method === 'GET' && path === '/progress':
        if (!userId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
        }
        return await getUserWeeklyProgress(userId);

      // GET /api-shot-challenges/history - Get user's submission history
      case method === 'GET' && path === '/history':
        if (!userId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
        }
        return await getUserSubmissionHistory(userId);

      // POST /api-shot-challenges/submit - Submit a video for a challenge
      case method === 'POST' && path === '/submit':
        if (!userId) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
        }
        return await submitChallenge(userId, JSON.parse(event.body));

      // GET /api-shot-challenges/pending - Get pending submissions (for coaches)
      case method === 'GET' && path === '/pending':
        return await getPendingSubmissions(userId);

      // POST /api-shot-challenges/verify - Verify a submission (for coaches)
      case method === 'POST' && path === '/verify':
        return await verifySubmission(userId, JSON.parse(event.body));

      // POST /api-shot-challenges/ai-verify - AI verification endpoint
      case method === 'POST' && path === '/ai-verify':
        return await aiVerifySubmission(JSON.parse(event.body));

      // GET /api-shot-challenges/leaderboard - Weekly challenge leaderboard
      case method === 'GET' && path === '/leaderboard':
        return await getWeeklyLeaderboard();

      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Not found' })
        };
    }
  } catch (error) {
    console.error('Shot Challenges API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

// Get current week's challenges with user's submission status
async function getCurrentWeekChallenges(userId) {
  // Get current week's schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from('weekly_challenge_schedule')
    .select('*')
    .lte('week_start', new Date().toISOString().split('T')[0])
    .gte('week_end', new Date().toISOString().split('T')[0])
    .eq('is_active', true)
    .single();

  if (scheduleError || !schedule) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        active: false,
        message: 'No active challenges this week',
        challenges: []
      })
    };
  }

  // Get challenge definitions
  const allChallengeIds = [...schedule.challenge_ids];
  if (schedule.bonus_challenge_id) {
    allChallengeIds.push(schedule.bonus_challenge_id);
  }

  const { data: challenges, error: challengesError } = await supabase
    .from('shot_challenge_definitions')
    .select('*')
    .in('id', allChallengeIds);

  if (challengesError) {
    throw challengesError;
  }

  // Get user's submissions if logged in
  let userSubmissions = {};
  let userProgress = null;

  if (userId) {
    const { data: submissions } = await supabase
      .from('shot_challenge_submissions')
      .select('*')
      .eq('user_id', userId)
      .eq('week_schedule_id', schedule.id);

    if (submissions) {
      submissions.forEach(sub => {
        userSubmissions[sub.challenge_definition_id] = sub;
      });
    }

    const { data: progress } = await supabase
      .from('user_weekly_challenge_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('week_schedule_id', schedule.id)
      .single();

    userProgress = progress;
  }

  // Combine challenges with user status
  const challengesWithStatus = challenges.map(challenge => ({
    ...challenge,
    is_bonus: challenge.id === schedule.bonus_challenge_id,
    user_submission: userSubmissions[challenge.id] || null
  }));

  // Calculate time remaining
  const weekEnd = new Date(schedule.week_end + 'T23:59:59');
  const now = new Date();
  const timeRemaining = weekEnd - now;
  const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      active: true,
      schedule: {
        id: schedule.id,
        week_start: schedule.week_start,
        week_end: schedule.week_end,
        theme: schedule.theme,
        completion_bonus_xp: schedule.completion_bonus_xp,
        time_remaining: {
          days: daysRemaining,
          hours: hoursRemaining,
          formatted: `${daysRemaining}d ${hoursRemaining}h`
        }
      },
      challenges: challengesWithStatus,
      user_progress: userProgress
    })
  };
}

// Get all challenge definitions
async function getAllChallengeDefinitions() {
  const { data, error } = await supabase
    .from('shot_challenge_definitions')
    .select('*')
    .eq('is_active', true)
    .order('difficulty', { ascending: true });

  if (error) throw error;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ definitions: data })
  };
}

// Get user's weekly progress
async function getUserWeeklyProgress(userId) {
  // Get current week's schedule
  const { data: schedule } = await supabase
    .from('weekly_challenge_schedule')
    .select('id')
    .lte('week_start', new Date().toISOString().split('T')[0])
    .gte('week_end', new Date().toISOString().split('T')[0])
    .eq('is_active', true)
    .single();

  if (!schedule) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ progress: null, submissions: [] })
    };
  }

  // Get progress
  const { data: progress } = await supabase
    .from('user_weekly_challenge_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('week_schedule_id', schedule.id)
    .single();

  // Get all submissions for this week
  const { data: submissions } = await supabase
    .from('shot_challenge_submissions')
    .select(`
      *,
      challenge:shot_challenge_definitions(name, icon, xp_reward)
    `)
    .eq('user_id', userId)
    .eq('week_schedule_id', schedule.id);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      progress: progress || {
        challenges_completed: 0,
        total_challenges: 6,
        total_xp_earned: 0,
        bonus_earned: false
      },
      submissions: submissions || []
    })
  };
}

// Get user's submission history across all weeks
async function getUserSubmissionHistory(userId) {
  const { data, error } = await supabase
    .from('shot_challenge_submissions')
    .select(`
      *,
      challenge:shot_challenge_definitions(name, icon, category, difficulty),
      week:weekly_challenge_schedule(week_start, week_end, theme)
    `)
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ history: data })
  };
}

// Submit a challenge video
async function submitChallenge(userId, body) {
  const { challenge_id, video_url, video_duration } = body;

  if (!challenge_id || !video_url) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'challenge_id and video_url are required' })
    };
  }

  // Use the database function
  const { data, error } = await supabase.rpc('submit_shot_challenge', {
    p_user_id: userId,
    p_challenge_id: challenge_id,
    p_video_url: video_url,
    p_video_duration: video_duration || null
  });

  if (error) throw error;

  // If AI verification, trigger the AI review process
  if (data.verification_type === 'ai' && data.success) {
    // In a real implementation, you would call your AI service here
    // For now, we'll just mark it as pending AI review
    console.log(`AI verification needed for submission ${data.submission_id}`);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(data)
  };
}

// Get pending submissions for coaches to review
async function getPendingSubmissions(userId) {
  // Verify user is a coach/admin
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (userError || !user || !['admin', 'instructor'].includes(user.role)) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Access denied. Coach or admin role required.' })
    };
  }

  const { data, error } = await supabase
    .from('shot_challenge_submissions')
    .select(`
      *,
      challenge:shot_challenge_definitions(name, icon, category, difficulty, tips),
      user:users(name, email),
      week:weekly_challenge_schedule(week_start, theme)
    `)
    .in('status', ['pending', 'ai_reviewing'])
    .order('submitted_at', { ascending: true });

  if (error) throw error;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ pending: data })
  };
}

// Verify a submission (for coaches)
async function verifySubmission(userId, body) {
  const { submission_id, approved, notes } = body;

  if (!submission_id || approved === undefined) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'submission_id and approved are required' })
    };
  }

  // Verify user is a coach/admin
  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (!user || !['admin', 'instructor'].includes(user.role)) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Access denied. Coach or admin role required.' })
    };
  }

  // Use the database function
  const { data, error } = await supabase.rpc('verify_shot_challenge', {
    p_submission_id: submission_id,
    p_verified_by: userId,
    p_approved: approved,
    p_notes: notes || null
  });

  if (error) throw error;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(data)
  };
}

// AI verification endpoint (called by AI service or webhook)
async function aiVerifySubmission(body) {
  const { submission_id, approved, confidence_score, notes, api_key } = body;

  // Verify API key for security
  if (api_key !== process.env.AI_VERIFICATION_API_KEY) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Invalid API key' })
    };
  }

  // Update submission with AI results
  const { data, error } = await supabase
    .from('shot_challenge_submissions')
    .update({
      status: approved ? 'approved' : 'needs_resubmit',
      verification_method: 'ai',
      ai_confidence_score: confidence_score,
      verification_notes: notes,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', submission_id)
    .select()
    .single();

  if (error) throw error;

  // If approved, award XP
  if (approved) {
    const { data: challenge } = await supabase
      .from('shot_challenge_definitions')
      .select('xp_reward')
      .eq('id', data.challenge_definition_id)
      .single();

    if (challenge) {
      // Award XP
      await supabase.from('xp_transactions').insert({
        user_id: data.user_id,
        xp_amount: challenge.xp_reward,
        action_type: 'shot_challenge',
        description: `AI verified: ${data.challenge_definition_id}`,
        metadata: { submission_id, confidence_score }
      });

      // Update user gamification
      await supabase.rpc('add_user_xp', {
        p_user_id: data.user_id,
        p_xp: challenge.xp_reward
      });

      // Update submission
      await supabase
        .from('shot_challenge_submissions')
        .update({
          xp_awarded: challenge.xp_reward,
          xp_awarded_at: new Date().toISOString()
        })
        .eq('id', submission_id);
    }
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, submission: data })
  };
}

// Get weekly leaderboard
async function getWeeklyLeaderboard() {
  // Get current week's schedule
  const { data: schedule } = await supabase
    .from('weekly_challenge_schedule')
    .select('id')
    .lte('week_start', new Date().toISOString().split('T')[0])
    .gte('week_end', new Date().toISOString().split('T')[0])
    .eq('is_active', true)
    .single();

  if (!schedule) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ leaderboard: [] })
    };
  }

  const { data, error } = await supabase
    .from('user_weekly_challenge_progress')
    .select(`
      *,
      user:users(name),
      profile:member_profiles(display_name, avatar_url)
    `)
    .eq('week_schedule_id', schedule.id)
    .order('challenges_completed', { ascending: false })
    .order('total_xp_earned', { ascending: false })
    .limit(20);

  if (error) throw error;

  const leaderboard = data.map((entry, index) => ({
    rank: index + 1,
    user_id: entry.user_id,
    display_name: entry.profile?.display_name || entry.user?.name || 'Anonymous',
    avatar_url: entry.profile?.avatar_url,
    challenges_completed: entry.challenges_completed,
    total_challenges: entry.total_challenges,
    total_xp_earned: entry.total_xp_earned,
    bonus_earned: entry.bonus_earned
  }));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ leaderboard })
  };
}
