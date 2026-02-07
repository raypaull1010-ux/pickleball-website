/**
 * 🎮 AVATAR API ENDPOINTS
 * Ray's Pickleball Platform
 *
 * Netlify serverless function for avatar management.
 *
 * Endpoints:
 *   GET    /api/avatar/:id        - Get avatar by ID
 *   POST   /api/avatar            - Create new avatar
 *   PATCH  /api/avatar/:id/stats  - Update avatar stats
 *   GET    /api/avatars/leaderboard - Get top avatars
 */

// Note: In production, connect to your database (Supabase, PlanetScale, etc.)
// This is a mock implementation for demonstration

// Mock database (replace with real DB)
const mockAvatars = new Map();

// Initialize with sample data
mockAvatars.set('1', {
    id: '1',
    user_id: 'user-1',
    display_name: 'Ray Martinez',
    title: 'The Dink Master',
    avatar_emoji: '🏓',
    avatar_color_primary: '#667eea',
    avatar_color_secondary: '#764ba2',
    stat_power: 72,
    stat_finesse: 89,
    stat_speed: 75,
    stat_court_iq: 82,
    stat_consistency: 85,
    stat_mental: 68,
    overall_rating: 78,
    rank_tier: 'Diamond',
    rank_division: 3,
    rank_points: 3250,
    tournaments_entered: 12,
    tournaments_won: 3,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: new Date().toISOString()
});

exports.handler = async (event, context) => {
    const { httpMethod, path, body, queryStringParameters } = event;

    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        // Parse path: /api/avatar/xxx or /api/avatars/leaderboard
        const pathParts = path.replace(/^\/\.netlify\/functions\/api-avatar\/?/, '').split('/').filter(Boolean);

        // GET /api/avatars/leaderboard
        if (pathParts[0] === 'leaderboard' && httpMethod === 'GET') {
            return handleLeaderboard(queryStringParameters, headers);
        }

        // GET /api/avatar/:id
        if (pathParts.length === 1 && httpMethod === 'GET') {
            return handleGetAvatar(pathParts[0], headers);
        }

        // POST /api/avatar
        if (pathParts.length === 0 && httpMethod === 'POST') {
            return handleCreateAvatar(JSON.parse(body || '{}'), headers);
        }

        // PATCH /api/avatar/:id/stats
        if (pathParts.length === 2 && pathParts[1] === 'stats' && httpMethod === 'PATCH') {
            return handleUpdateStats(pathParts[0], JSON.parse(body || '{}'), headers);
        }

        // 404 for unknown routes
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found', path, method: httpMethod })
        };

    } catch (error) {
        console.error('API Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * Get avatar by ID
 */
function handleGetAvatar(avatarId, headers) {
    const avatar = mockAvatars.get(avatarId);

    if (!avatar) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Avatar not found' })
        };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(avatar)
    };
}

/**
 * Create new avatar
 */
function handleCreateAvatar(data, headers) {
    const id = `avatar-${Date.now()}`;

    const avatar = {
        id,
        user_id: data.user_id || `user-${Date.now()}`,
        display_name: data.display_name || 'New Player',
        title: data.title || 'Rookie',
        avatar_emoji: data.avatar_emoji || '🏓',
        avatar_color_primary: data.avatar_color_primary || '#667eea',
        avatar_color_secondary: data.avatar_color_secondary || '#764ba2',
        stat_power: data.stat_power || 50,
        stat_finesse: data.stat_finesse || 50,
        stat_speed: data.stat_speed || 50,
        stat_court_iq: data.stat_court_iq || 50,
        stat_consistency: data.stat_consistency || 50,
        stat_mental: data.stat_mental || 50,
        overall_rating: calculateOverallRating(data),
        rank_tier: 'Bronze',
        rank_division: 5,
        rank_points: 0,
        tournaments_entered: 0,
        tournaments_won: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    mockAvatars.set(id, avatar);

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify(avatar)
    };
}

/**
 * Update avatar stats
 */
function handleUpdateStats(avatarId, data, headers) {
    const avatar = mockAvatars.get(avatarId);

    if (!avatar) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Avatar not found' })
        };
    }

    const { stats, source, notes } = data;
    const changes = [];

    // Update each provided stat
    for (const [statKey, newValue] of Object.entries(stats || {})) {
        const fullKey = statKey.startsWith('stat_') ? statKey : `stat_${statKey}`;
        const oldValue = avatar[fullKey];

        if (oldValue !== undefined && oldValue !== newValue) {
            changes.push({
                stat: statKey.replace('stat_', ''),
                old_value: oldValue,
                new_value: newValue,
                change: newValue - oldValue
            });

            avatar[fullKey] = Math.max(1, Math.min(99, newValue));
        }
    }

    // Recalculate overall rating
    avatar.overall_rating = calculateOverallRating(avatar);
    avatar.updated_at = new Date().toISOString();

    // Update rank tier based on points (simplified)
    avatar.rank_tier = getRankTier(avatar.rank_points);

    mockAvatars.set(avatarId, avatar);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            avatar,
            changes,
            source: source || 'manual',
            notes: notes || ''
        })
    };
}

/**
 * Get leaderboard
 */
function handleLeaderboard(params, headers) {
    const limit = parseInt(params?.limit) || 10;
    const offset = parseInt(params?.offset) || 0;

    const avatars = Array.from(mockAvatars.values())
        .sort((a, b) => b.overall_rating - a.overall_rating)
        .slice(offset, offset + limit)
        .map((avatar, index) => ({
            ...avatar,
            rank: offset + index + 1
        }));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            leaderboard: avatars,
            total: mockAvatars.size,
            limit,
            offset
        })
    };
}

/**
 * Calculate overall rating from stats
 */
function calculateOverallRating(data) {
    const weights = {
        power: 0.15,
        finesse: 0.20,
        speed: 0.15,
        court_iq: 0.20,
        consistency: 0.20,
        mental: 0.10
    };

    let total = 0;
    for (const [stat, weight] of Object.entries(weights)) {
        const key = `stat_${stat}`;
        const value = data[key] || data[stat] || 50;
        total += value * weight;
    }

    return Math.round(total);
}

/**
 * Get rank tier from points
 */
function getRankTier(points) {
    if (points >= 5000) return 'Grandmaster';
    if (points >= 4000) return 'Master';
    if (points >= 3000) return 'Diamond';
    if (points >= 2000) return 'Platinum';
    if (points >= 1000) return 'Gold';
    if (points >= 500) return 'Silver';
    return 'Bronze';
}
