// API Endpoint: Social Features
// GET /api-social/profile - Get own profile
// GET /api-social/profile/:userId - Get public profile
// PUT /api-social/profile - Update own profile
// GET /api-social/find-partners - Find playing partners nearby
// POST /api-social/partner-request - Send partner request
// GET /api-social/partner-requests - Get pending requests
// PUT /api-social/partner-request/:id - Accept/decline request
// POST /api-social/challenge - Create challenge
// GET /api-social/challenges - Get challenges
// PUT /api-social/challenge/:id - Accept/update challenge
// GET /api-social/connections - Get following/followers
// POST /api-social/follow - Follow a user
// DELETE /api-social/follow/:userId - Unfollow
// GET /api-social/progress - Get skill progression data

const { getServiceClient, verifyUser, jsonResponse, handleCors } = require('./lib/supabase');
const { withSecurity, isValidEmail } = require('./lib/security');

const handler = async (event, context) => {
  const corsResponse = handleCors(event);
  if (corsResponse) return corsResponse;

  const supabase = getServiceClient();
  const path = event.path.replace('/.netlify/functions/api-social', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    // ==========================================
    // GET /api-social/profile - Get own profile
    // ==========================================
    if (event.httpMethod === 'GET' && pathParts[0] === 'profile' && !pathParts[1]) {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      // Get or create profile
      let { data: profile, error } = await supabase
        .from('member_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        // Create default profile
        const { data: userInfo } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', user.id)
          .single();

        const { data: newProfile, error: createError } = await supabase
          .from('member_profiles')
          .insert({
            user_id: user.id,
            display_name: userInfo?.full_name || 'Player'
          })
          .select()
          .single();

        if (createError) {
          return jsonResponse(500, { error: 'Failed to create profile' });
        }
        profile = newProfile;
      }

      // Get gamification stats
      const { data: gamification } = await supabase
        .from('user_gamification')
        .select('total_xp, level, current_streak')
        .eq('user_id', user.id)
        .single();

      // Get badge count
      const { count: badgeCount } = await supabase
        .from('user_badges')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get follower/following counts
      const { count: followerCount } = await supabase
        .from('player_connections')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const { count: followingCount } = await supabase
        .from('player_connections')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      return jsonResponse(200, {
        profile,
        stats: {
          ...gamification,
          badges: badgeCount || 0,
          followers: followerCount || 0,
          following: followingCount || 0
        }
      });
    }

    // ==========================================
    // GET /api-social/profile/:userId - Get public profile
    // ==========================================
    if (event.httpMethod === 'GET' && pathParts[0] === 'profile' && pathParts[1]) {
      const targetUserId = pathParts[1];

      const { data: profile, error } = await supabase
        .from('member_profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('is_public', true)
        .single();

      if (!profile) {
        return jsonResponse(404, { error: 'Profile not found or private' });
      }

      // Get public gamification stats
      const { data: gamification } = await supabase
        .from('user_gamification')
        .select('total_xp, level, current_streak')
        .eq('user_id', targetUserId)
        .single();

      // Get displayed badges
      const { data: badges } = await supabase
        .from('user_badges')
        .select('badge_definitions(*)')
        .eq('user_id', targetUserId)
        .eq('is_displayed', true)
        .limit(6);

      return jsonResponse(200, {
        profile,
        stats: gamification,
        badges: badges?.map(b => b.badge_definitions) || []
      });
    }

    // ==========================================
    // PUT /api-social/profile - Update own profile
    // ==========================================
    if (event.httpMethod === 'PUT' && pathParts[0] === 'profile') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const updates = JSON.parse(event.body);

      // Allowed fields to update
      const allowedFields = [
        'display_name', 'avatar_url', 'bio', 'skill_level', 'dupr_rating',
        'preferred_play_style', 'dominant_hand', 'years_playing', 'favorite_paddle',
        'location_city', 'location_state', 'location_zip', 'location_lat', 'location_lng',
        'looking_for_partners', 'availability', 'social_links', 'is_public', 'show_on_leaderboard'
      ];

      const sanitizedUpdates = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          sanitizedUpdates[field] = updates[field];
        }
      }
      sanitizedUpdates.updated_at = new Date().toISOString();

      const { data: profile, error } = await supabase
        .from('member_profiles')
        .update(sanitizedUpdates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        return jsonResponse(500, { error: 'Failed to update profile' });
      }

      return jsonResponse(200, { success: true, profile });
    }

    // ==========================================
    // GET /api-social/find-partners - Find playing partners
    // ==========================================
    if (event.httpMethod === 'GET' && pathParts[0] === 'find-partners') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const { state, city, skill_min, skill_max, limit = 20 } = event.queryStringParameters || {};

      let query = supabase
        .from('member_profiles')
        .select(`
          *,
          users!inner(id, full_name),
          user_gamification(level, current_streak)
        `)
        .eq('looking_for_partners', true)
        .eq('is_public', true)
        .neq('user_id', user.id);

      if (state) {
        query = query.eq('location_state', state);
      }
      if (city) {
        query = query.ilike('location_city', `%${city}%`);
      }
      if (skill_min) {
        query = query.gte('skill_level', parseFloat(skill_min));
      }
      if (skill_max) {
        query = query.lte('skill_level', parseFloat(skill_max));
      }

      query = query.limit(parseInt(limit));

      const { data: partners, error } = await query;

      if (error) {
        console.error('Find partners error:', error);
        return jsonResponse(500, { error: 'Failed to find partners' });
      }

      // Format response
      const formattedPartners = (partners || []).map(p => ({
        userId: p.user_id,
        displayName: p.display_name || p.users?.full_name,
        avatarUrl: p.avatar_url,
        skillLevel: p.skill_level,
        playStyle: p.preferred_play_style,
        location: `${p.location_city || ''}, ${p.location_state || ''}`.replace(/^, |, $/g, ''),
        availability: p.availability,
        level: p.user_gamification?.[0]?.level || 1,
        streak: p.user_gamification?.[0]?.current_streak || 0
      }));

      return jsonResponse(200, { partners: formattedPartners });
    }

    // ==========================================
    // POST /api-social/partner-request - Send partner request
    // ==========================================
    if (event.httpMethod === 'POST' && pathParts[0] === 'partner-request') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const { targetUserId, message, playDate, playTime, location } = JSON.parse(event.body);

      if (!targetUserId) {
        return jsonResponse(400, { error: 'Target user ID required' });
      }

      const { data: request, error } = await supabase
        .from('partner_requests')
        .insert({
          requester_id: user.id,
          target_id: targetUserId,
          message,
          play_date: playDate,
          play_time: playTime,
          location
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return jsonResponse(400, { error: 'Request already sent for this date' });
        }
        return jsonResponse(500, { error: 'Failed to send request' });
      }

      return jsonResponse(201, { success: true, request });
    }

    // ==========================================
    // GET /api-social/partner-requests - Get pending requests
    // ==========================================
    if (event.httpMethod === 'GET' && pathParts[0] === 'partner-requests') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      // Get requests TO this user
      const { data: received } = await supabase
        .from('partner_requests')
        .select(`
          *,
          requester:users!requester_id(full_name),
          requester_profile:member_profiles!requester_id(display_name, avatar_url, skill_level)
        `)
        .eq('target_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Get requests FROM this user
      const { data: sent } = await supabase
        .from('partner_requests')
        .select(`
          *,
          target:users!target_id(full_name),
          target_profile:member_profiles!target_id(display_name, avatar_url, skill_level)
        `)
        .eq('requester_id', user.id)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false });

      return jsonResponse(200, {
        received: received || [],
        sent: sent || []
      });
    }

    // ==========================================
    // PUT /api-social/partner-request/:id - Accept/decline
    // ==========================================
    if (event.httpMethod === 'PUT' && pathParts[0] === 'partner-request' && pathParts[1]) {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const requestId = pathParts[1];
      const { status } = JSON.parse(event.body); // 'accepted' or 'declined'

      if (!['accepted', 'declined'].includes(status)) {
        return jsonResponse(400, { error: 'Invalid status' });
      }

      const { data: request, error } = await supabase
        .from('partner_requests')
        .update({
          status,
          responded_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('target_id', user.id)
        .select()
        .single();

      if (error || !request) {
        return jsonResponse(404, { error: 'Request not found' });
      }

      return jsonResponse(200, { success: true, request });
    }

    // ==========================================
    // POST /api-social/challenge - Create challenge
    // ==========================================
    if (event.httpMethod === 'POST' && pathParts[0] === 'challenge') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const {
        challengedUserId,
        challengeType,
        title,
        description,
        goalType,
        goalValue,
        durationDays = 7,
        stakes,
        xpReward = 100
      } = JSON.parse(event.body);

      if (!challengedUserId || !challengeType || !title) {
        return jsonResponse(400, { error: 'Missing required fields' });
      }

      const { data: challenge, error } = await supabase
        .from('member_challenges')
        .insert({
          challenger_id: user.id,
          challenged_id: challengedUserId,
          challenge_type: challengeType,
          title,
          description,
          goal_type: goalType,
          goal_value: goalValue,
          duration_days: durationDays,
          stakes,
          xp_reward: xpReward
        })
        .select()
        .single();

      if (error) {
        return jsonResponse(500, { error: 'Failed to create challenge' });
      }

      return jsonResponse(201, { success: true, challenge });
    }

    // ==========================================
    // GET /api-social/challenges - Get challenges
    // ==========================================
    if (event.httpMethod === 'GET' && pathParts[0] === 'challenges') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const { data: challenges, error } = await supabase
        .from('member_challenges')
        .select(`
          *,
          challenger:users!challenger_id(full_name),
          challenged:users!challenged_id(full_name)
        `)
        .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) {
        return jsonResponse(500, { error: 'Failed to fetch challenges' });
      }

      return jsonResponse(200, { challenges: challenges || [] });
    }

    // ==========================================
    // PUT /api-social/challenge/:id - Accept/update challenge
    // ==========================================
    if (event.httpMethod === 'PUT' && pathParts[0] === 'challenge' && pathParts[1]) {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const challengeId = pathParts[1];
      const updates = JSON.parse(event.body);

      // Get current challenge
      const { data: challenge } = await supabase
        .from('member_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (!challenge) {
        return jsonResponse(404, { error: 'Challenge not found' });
      }

      // Verify user is participant
      if (challenge.challenger_id !== user.id && challenge.challenged_id !== user.id) {
        return jsonResponse(403, { error: 'Not a participant' });
      }

      const allowedUpdates = {};

      // If accepting challenge
      if (updates.status === 'active' && challenge.status === 'pending') {
        if (challenge.challenged_id !== user.id) {
          return jsonResponse(403, { error: 'Only challenged user can accept' });
        }
        allowedUpdates.status = 'active';
        allowedUpdates.starts_at = new Date().toISOString();
        allowedUpdates.ends_at = new Date(Date.now() + challenge.duration_days * 24 * 60 * 60 * 1000).toISOString();
      }

      // If declining challenge
      if (updates.status === 'declined' && challenge.status === 'pending') {
        allowedUpdates.status = 'declined';
      }

      // Update progress
      if (updates.progress !== undefined) {
        if (challenge.challenger_id === user.id) {
          allowedUpdates.challenger_progress = updates.progress;
        } else {
          allowedUpdates.challenged_progress = updates.progress;
        }
      }

      const { data: updated, error } = await supabase
        .from('member_challenges')
        .update(allowedUpdates)
        .eq('id', challengeId)
        .select()
        .single();

      if (error) {
        return jsonResponse(500, { error: 'Failed to update challenge' });
      }

      return jsonResponse(200, { success: true, challenge: updated });
    }

    // ==========================================
    // GET /api-social/connections - Get following/followers
    // ==========================================
    if (event.httpMethod === 'GET' && pathParts[0] === 'connections') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      // Get following
      const { data: following } = await supabase
        .from('player_connections')
        .select(`
          following_id,
          following:users!following_id(full_name),
          following_profile:member_profiles!following_id(display_name, avatar_url, skill_level)
        `)
        .eq('follower_id', user.id);

      // Get followers
      const { data: followers } = await supabase
        .from('player_connections')
        .select(`
          follower_id,
          follower:users!follower_id(full_name),
          follower_profile:member_profiles!follower_id(display_name, avatar_url, skill_level)
        `)
        .eq('following_id', user.id);

      return jsonResponse(200, {
        following: following || [],
        followers: followers || []
      });
    }

    // ==========================================
    // POST /api-social/follow - Follow a user
    // ==========================================
    if (event.httpMethod === 'POST' && pathParts[0] === 'follow') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const { userId } = JSON.parse(event.body);

      if (!userId || userId === user.id) {
        return jsonResponse(400, { error: 'Invalid user ID' });
      }

      const { data, error } = await supabase
        .from('player_connections')
        .insert({
          follower_id: user.id,
          following_id: userId
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return jsonResponse(400, { error: 'Already following' });
        }
        return jsonResponse(500, { error: 'Failed to follow' });
      }

      return jsonResponse(201, { success: true });
    }

    // ==========================================
    // DELETE /api-social/follow/:userId - Unfollow
    // ==========================================
    if (event.httpMethod === 'DELETE' && pathParts[0] === 'follow' && pathParts[1]) {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const targetUserId = pathParts[1];

      const { error } = await supabase
        .from('player_connections')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId);

      if (error) {
        return jsonResponse(500, { error: 'Failed to unfollow' });
      }

      return jsonResponse(200, { success: true });
    }

    // ==========================================
    // GET /api-social/progress - Get skill progression
    // ==========================================
    if (event.httpMethod === 'GET' && pathParts[0] === 'progress') {
      const user = await verifyUser(event.headers.authorization);
      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      // Get stats history
      const { data: statsHistory } = await supabase
        .from('player_stats_history')
        .select('*')
        .eq('user_id', user.id)
        .order('stat_date', { ascending: true })
        .limit(90); // Last 90 days

      // Get analysis progress
      const { data: analysisProgress } = await supabase
        .from('analysis_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('analysis_date', { ascending: false })
        .limit(10);

      // Get video submission count
      const { count: videoCount } = await supabase
        .from('video_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Calculate improvement (compare first and last analysis)
      let improvement = null;
      if (analysisProgress && analysisProgress.length >= 2) {
        const first = analysisProgress[analysisProgress.length - 1];
        const latest = analysisProgress[0];

        if (first.skill_ratings && latest.skill_ratings) {
          improvement = {};
          for (const skill in latest.skill_ratings) {
            if (first.skill_ratings[skill] !== undefined) {
              improvement[skill] = latest.skill_ratings[skill] - first.skill_ratings[skill];
            }
          }
        }
      }

      return jsonResponse(200, {
        statsHistory: statsHistory || [],
        analysisProgress: analysisProgress || [],
        totalVideosAnalyzed: videoCount || 0,
        improvement
      });
    }

    // ==========================================
    // GET /api-social/membership-perks - Get membership tier perks
    // ==========================================
    if (event.httpMethod === 'GET' && pathParts[0] === 'membership-perks') {
      const { data: tiers, error } = await supabase
        .from('membership_tiers')
        .select('*')
        .order('duration_months');

      if (error) {
        return jsonResponse(500, { error: 'Failed to fetch tiers' });
      }

      return jsonResponse(200, { tiers: tiers || [] });
    }

    return jsonResponse(405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('Social API error:', error);
    return jsonResponse(500, { error: 'Internal server error', message: error.message });
  }
};

exports.handler = withSecurity(handler, {
  endpoint: 'social',
  rateLimit: true,
  sanitize: true
});
