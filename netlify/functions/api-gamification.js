// API Endpoint: Gamification System
// GET /api-gamification - Get user's gamification data
// POST /api-gamification/checkin - Daily check-in
// POST /api-gamification/xp - Award XP for actions
// GET /api-gamification/leaderboard - Get leaderboard
// GET /api-gamification/badges - Get all badges
// GET /api-gamification/activity - Get activity feed

const { getServiceClient, verifyUser, isAdmin, jsonResponse, handleCors } = require('./lib/supabase');
const { withSecurity } = require('./lib/security');

// XP rewards for different actions
const XP_REWARDS = {
  daily_login: 10,
  streak_bonus_per_day: 5, // Extra XP per streak day (max 50)
  video_submit: 50,
  drill_complete: 25,
  community_help: 30,
  referral_signup: 100,
  profile_complete: 25,
  first_purchase: 50
};

// Level calculation functions
function calculateLevel(xp) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
}

function xpForLevel(level) {
  return Math.pow(level - 1, 2) * 50;
}

function xpForNextLevel(level) {
  return Math.pow(level, 2) * 50;
}

const handler = async (event, context) => {
  const corsResponse = handleCors(event);
  if (corsResponse) return corsResponse;

  const supabase = getServiceClient();
  const path = event.path.replace('/.netlify/functions/api-gamification', '');

  try {
    // ==========================================
    // GET /api-gamification - Get user's gamification data
    // ==========================================
    if (event.httpMethod === 'GET' && (path === '' || path === '/')) {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      // Get or create user gamification record
      let { data: gamification, error } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!gamification) {
        // Create new gamification record
        const { data: newGamification, error: createError } = await supabase
          .from('user_gamification')
          .insert({ user_id: user.id })
          .select()
          .single();

        if (createError) {
          console.error('Error creating gamification record:', createError);
          return jsonResponse(500, { error: 'Failed to initialize gamification' });
        }
        gamification = newGamification;
      }

      // Get user's badges
      const { data: userBadges } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at, is_displayed, badge_definitions(*)')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      // Get recent XP transactions
      const { data: recentXP } = await supabase
        .from('xp_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Get streak calendar (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: checkins } = await supabase
        .from('daily_checkins')
        .select('checkin_date, xp_earned, streak_day')
        .eq('user_id', user.id)
        .gte('checkin_date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('checkin_date', { ascending: false });

      // Calculate level progress
      const currentLevel = calculateLevel(gamification.total_xp);
      const currentLevelXP = xpForLevel(currentLevel);
      const nextLevelXP = xpForNextLevel(currentLevel);
      const progressXP = gamification.total_xp - currentLevelXP;
      const neededXP = nextLevelXP - currentLevelXP;
      const progressPercent = Math.min(100, Math.round((progressXP / neededXP) * 100));

      return jsonResponse(200, {
        stats: {
          totalXP: gamification.total_xp,
          level: currentLevel,
          currentStreak: gamification.current_streak,
          longestStreak: gamification.longest_streak,
          lastLoginDate: gamification.last_login_date
        },
        levelProgress: {
          currentLevel,
          currentLevelXP,
          nextLevelXP,
          progressXP,
          neededXP,
          progressPercent
        },
        badges: userBadges || [],
        recentXP: recentXP || [],
        streakCalendar: checkins || []
      });
    }

    // ==========================================
    // POST /api-gamification/checkin - Daily check-in
    // ==========================================
    if (event.httpMethod === 'POST' && path === '/checkin') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const today = new Date().toISOString().split('T')[0];

      // Check if already checked in today
      const { data: existingCheckin } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', user.id)
        .eq('checkin_date', today)
        .single();

      if (existingCheckin) {
        return jsonResponse(200, {
          success: true,
          alreadyCheckedIn: true,
          message: 'Already checked in today!',
          checkin: existingCheckin
        });
      }

      // Get current gamification state
      let { data: gamification } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!gamification) {
        // Create new gamification record
        const { data: newGamification } = await supabase
          .from('user_gamification')
          .insert({ user_id: user.id })
          .select()
          .single();
        gamification = newGamification;
      }

      // Calculate streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = 1;
      if (gamification.last_login_date === yesterdayStr) {
        // Continue streak
        newStreak = gamification.current_streak + 1;
      } else if (gamification.last_login_date === today) {
        // Same day, keep streak
        newStreak = gamification.current_streak;
      }
      // Otherwise streak resets to 1

      // Calculate XP reward
      const streakBonus = Math.min(50, (newStreak - 1) * XP_REWARDS.streak_bonus_per_day);
      const totalXPEarned = XP_REWARDS.daily_login + streakBonus;

      // Create check-in record
      const { data: checkin, error: checkinError } = await supabase
        .from('daily_checkins')
        .insert({
          user_id: user.id,
          checkin_date: today,
          xp_earned: totalXPEarned,
          streak_day: newStreak
        })
        .select()
        .single();

      if (checkinError) {
        console.error('Checkin error:', checkinError);
        return jsonResponse(500, { error: 'Failed to record check-in' });
      }

      // Update gamification stats
      const newTotalXP = gamification.total_xp + totalXPEarned;
      const newLevel = calculateLevel(newTotalXP);
      const leveledUp = newLevel > gamification.level;

      await supabase
        .from('user_gamification')
        .update({
          total_xp: newTotalXP,
          level: newLevel,
          current_streak: newStreak,
          longest_streak: Math.max(gamification.longest_streak, newStreak),
          last_login_date: today,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      // Record XP transaction
      await supabase.from('xp_transactions').insert({
        user_id: user.id,
        xp_amount: totalXPEarned,
        action_type: 'login',
        description: `Daily check-in (Day ${newStreak} streak)`,
        metadata: { streak: newStreak, bonus: streakBonus }
      });

      // Check for streak badges
      const badgesToAward = [];
      const streakBadges = [
        { streak: 3, badge: 'streak_3' },
        { streak: 7, badge: 'streak_7' },
        { streak: 14, badge: 'streak_14' },
        { streak: 30, badge: 'streak_30' },
        { streak: 100, badge: 'streak_100' }
      ];

      for (const { streak, badge } of streakBadges) {
        if (newStreak >= streak) {
          // Check if badge already earned
          const { data: existingBadge } = await supabase
            .from('user_badges')
            .select('id')
            .eq('user_id', user.id)
            .eq('badge_id', badge)
            .single();

          if (!existingBadge) {
            badgesToAward.push(badge);
          }
        }
      }

      // Award badges
      const earnedBadges = [];
      for (const badgeId of badgesToAward) {
        const { data: badge } = await supabase
          .from('badge_definitions')
          .select('*')
          .eq('id', badgeId)
          .single();

        if (badge) {
          await supabase.from('user_badges').insert({
            user_id: user.id,
            badge_id: badgeId
          });

          // Award badge XP
          if (badge.xp_reward > 0) {
            await supabase.from('xp_transactions').insert({
              user_id: user.id,
              xp_amount: badge.xp_reward,
              action_type: 'badge_earned',
              description: `Earned badge: ${badge.name}`
            });

            await supabase
              .from('user_gamification')
              .update({
                total_xp: newTotalXP + badge.xp_reward
              })
              .eq('user_id', user.id);
          }

          // Add to activity feed
          await supabase.from('activity_feed').insert({
            user_id: user.id,
            activity_type: 'badge_earned',
            title: `Earned ${badge.name} badge!`,
            description: badge.description,
            metadata: { badge_id: badgeId, icon: badge.icon }
          });

          earnedBadges.push(badge);
        }
      }

      // Check for level up activity
      if (leveledUp) {
        await supabase.from('activity_feed').insert({
          user_id: user.id,
          activity_type: 'level_up',
          title: `Reached Level ${newLevel}!`,
          description: `Leveled up from ${gamification.level} to ${newLevel}`,
          metadata: { old_level: gamification.level, new_level: newLevel }
        });

        // Check for level badges
        const levelBadges = [
          { level: 5, badge: 'level_5' },
          { level: 10, badge: 'level_10' },
          { level: 25, badge: 'level_25' },
          { level: 50, badge: 'level_50' }
        ];

        for (const { level, badge } of levelBadges) {
          if (newLevel >= level) {
            const { data: existingBadge } = await supabase
              .from('user_badges')
              .select('id')
              .eq('user_id', user.id)
              .eq('badge_id', badge)
              .single();

            if (!existingBadge) {
              await supabase.from('user_badges').insert({
                user_id: user.id,
                badge_id: badge
              });
            }
          }
        }
      }

      return jsonResponse(200, {
        success: true,
        checkin: {
          date: today,
          streak: newStreak,
          xpEarned: totalXPEarned,
          baseXP: XP_REWARDS.daily_login,
          streakBonus
        },
        stats: {
          totalXP: newTotalXP,
          level: newLevel,
          leveledUp
        },
        badgesEarned: earnedBadges,
        message: newStreak > 1
          ? `🔥 ${newStreak}-day streak! +${totalXPEarned} XP`
          : `Welcome back! +${totalXPEarned} XP`
      });
    }

    // ==========================================
    // POST /api-gamification/xp - Award XP for actions
    // ==========================================
    if (event.httpMethod === 'POST' && path === '/xp') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const { action, metadata = {} } = JSON.parse(event.body);

      if (!action || !XP_REWARDS[action]) {
        return jsonResponse(400, { error: 'Invalid action type' });
      }

      const xpAmount = XP_REWARDS[action];

      // Get current gamification
      const { data: gamification } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!gamification) {
        return jsonResponse(404, { error: 'User gamification not found' });
      }

      const newTotalXP = gamification.total_xp + xpAmount;
      const newLevel = calculateLevel(newTotalXP);
      const leveledUp = newLevel > gamification.level;

      // Update gamification
      await supabase
        .from('user_gamification')
        .update({
          total_xp: newTotalXP,
          level: newLevel,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      // Record XP transaction
      await supabase.from('xp_transactions').insert({
        user_id: user.id,
        xp_amount: xpAmount,
        action_type: action,
        description: `${action.replace(/_/g, ' ')}`,
        metadata
      });

      return jsonResponse(200, {
        success: true,
        xpAwarded: xpAmount,
        totalXP: newTotalXP,
        level: newLevel,
        leveledUp
      });
    }

    // ==========================================
    // GET /api-gamification/leaderboard - Get leaderboard
    // ==========================================
    if (event.httpMethod === 'GET' && path === '/leaderboard') {
      const period = event.queryStringParameters?.period || 'alltime';
      const limit = Math.min(50, parseInt(event.queryStringParameters?.limit) || 10);

      // Get leaderboard data
      const { data: leaderboard, error } = await supabase
        .from('user_gamification')
        .select(`
          user_id,
          total_xp,
          level,
          current_streak,
          users!inner(full_name, email)
        `)
        .order('total_xp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Leaderboard error:', error);
        return jsonResponse(500, { error: 'Failed to fetch leaderboard' });
      }

      // Format leaderboard
      const formattedLeaderboard = (leaderboard || []).map((entry, index) => ({
        rank: index + 1,
        userId: entry.user_id,
        name: entry.users?.full_name || 'Anonymous',
        totalXP: entry.total_xp,
        level: entry.level,
        streak: entry.current_streak
      }));

      return jsonResponse(200, {
        period,
        leaderboard: formattedLeaderboard
      });
    }

    // ==========================================
    // GET /api-gamification/badges - Get all badges
    // ==========================================
    if (event.httpMethod === 'GET' && path === '/badges') {
      const showAll = event.queryStringParameters?.admin === 'true';
      let query = supabase
        .from('badge_definitions')
        .select('*')
        .order('category')
        .order('requirement_value');

      // Only filter hidden badges for non-admin requests
      if (!showAll) {
        query = query.eq('is_hidden', false);
      }

      const { data: badges, error } = await query;

      if (error) {
        return jsonResponse(500, { error: 'Failed to fetch badges' });
      }

      // Group by category
      const grouped = {};
      for (const badge of badges || []) {
        if (!grouped[badge.category]) {
          grouped[badge.category] = [];
        }
        grouped[badge.category].push(badge);
      }

      return jsonResponse(200, { badges: grouped, total: (badges || []).length });
    }

    // ==========================================
    // GET /api-gamification/activity - Get activity feed
    // ==========================================
    if (event.httpMethod === 'GET' && path === '/activity') {
      const limit = Math.min(50, parseInt(event.queryStringParameters?.limit) || 20);

      const { data: activities, error } = await supabase
        .from('activity_feed')
        .select(`
          *,
          users!inner(full_name)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Activity feed error:', error);
        return jsonResponse(500, { error: 'Failed to fetch activity feed' });
      }

      const formattedActivities = (activities || []).map(a => ({
        id: a.id,
        type: a.activity_type,
        title: a.title,
        description: a.description,
        userName: a.users?.full_name || 'Anonymous',
        metadata: a.metadata,
        createdAt: a.created_at
      }));

      return jsonResponse(200, { activities: formattedActivities });
    }

    // ==========================================
    // POST /api-gamification/badges - Create a new badge (admin only)
    // ==========================================
    if (event.httpMethod === 'POST' && path === '/badges') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }
      const userIsAdmin = await isAdmin(user.id);
      if (!userIsAdmin) {
        return jsonResponse(403, { error: 'Admin access required' });
      }

      const badge = JSON.parse(event.body);
      if (!badge.id || !badge.name || !badge.icon || !badge.category) {
        return jsonResponse(400, { error: 'Missing required fields: id, name, icon, category' });
      }

      const { data, error } = await supabase
        .from('badge_definitions')
        .insert({
          id: badge.id,
          name: badge.name,
          description: badge.description || '',
          icon: badge.icon,
          category: badge.category,
          xp_reward: badge.xp_reward || 0,
          requirement_type: badge.requirement_type || 'count',
          requirement_value: badge.requirement_value || 1,
          requirement_action: badge.requirement_action || '',
          is_hidden: badge.is_hidden || false,
          rarity: badge.rarity || 'common'
        })
        .select()
        .single();

      if (error) {
        console.error('Create badge error:', error);
        return jsonResponse(500, { error: 'Failed to create badge', details: error.message });
      }

      return jsonResponse(201, { badge: data });
    }

    // ==========================================
    // PUT /api-gamification/badges/:id - Update a badge (admin only)
    // ==========================================
    if (event.httpMethod === 'PUT' && path.startsWith('/badges/')) {
      const badgeId = decodeURIComponent(path.replace('/badges/', ''));
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }
      const userIsAdmin = await isAdmin(user.id);
      if (!userIsAdmin) {
        return jsonResponse(403, { error: 'Admin access required' });
      }

      const updates = JSON.parse(event.body);
      // Only allow updating specific fields
      const allowedFields = ['name', 'description', 'icon', 'category', 'xp_reward', 'requirement_type', 'requirement_value', 'requirement_action', 'is_hidden', 'rarity'];
      const sanitized = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          sanitized[key] = updates[key];
        }
      }

      if (Object.keys(sanitized).length === 0) {
        return jsonResponse(400, { error: 'No valid fields to update' });
      }

      const { data, error } = await supabase
        .from('badge_definitions')
        .update(sanitized)
        .eq('id', badgeId)
        .select()
        .single();

      if (error) {
        console.error('Update badge error:', error);
        return jsonResponse(500, { error: 'Failed to update badge', details: error.message });
      }

      if (!data) {
        return jsonResponse(404, { error: 'Badge not found' });
      }

      return jsonResponse(200, { badge: data });
    }

    // ==========================================
    // DELETE /api-gamification/badges/:id - Delete a badge (admin only)
    // ==========================================
    if (event.httpMethod === 'DELETE' && path.startsWith('/badges/')) {
      const badgeId = decodeURIComponent(path.replace('/badges/', ''));
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }
      const userIsAdmin = await isAdmin(user.id);
      if (!userIsAdmin) {
        return jsonResponse(403, { error: 'Admin access required' });
      }

      // Check if any users have earned this badge
      const { count } = await supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('badge_id', badgeId);

      const { error } = await supabase
        .from('badge_definitions')
        .delete()
        .eq('id', badgeId);

      if (error) {
        console.error('Delete badge error:', error);
        return jsonResponse(500, { error: 'Failed to delete badge', details: error.message });
      }

      return jsonResponse(200, { deleted: badgeId, usersAffected: count || 0 });
    }

    return jsonResponse(405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('Gamification API error:', error);
    return jsonResponse(500, { error: 'Internal server error', message: error.message });
  }
};

exports.handler = withSecurity(handler, {
  endpoint: 'gamification',
  rateLimit: true,
  sanitize: true
});
