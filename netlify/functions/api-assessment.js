/**
 * 📊 ASSESSMENT API ENDPOINTS
 * Ray's Pickleball Platform
 *
 * Netlify serverless function for coach assessments.
 *
 * Endpoints:
 *   POST   /api/assessments           - Submit new assessment
 *   GET    /api/assessments/:id       - Get assessment by ID
 *   GET    /api/assessments/avatar/:id - Get assessments for avatar
 *   PATCH  /api/assessments/:id/apply - Apply assessment to avatar
 */

// Mock database
const mockAssessments = new Map();

// Valid coach IDs
const VALID_COACHES = ['ray', 'priscilla', 'eddie'];

exports.handler = async (event, context) => {
    const { httpMethod, path, body, queryStringParameters } = event;

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    try {
        const pathParts = path.replace(/^\/\.netlify\/functions\/api-assessment\/?/, '').split('/').filter(Boolean);

        // POST /api/assessments - Create assessment
        if (pathParts.length === 0 && httpMethod === 'POST') {
            return handleCreateAssessment(JSON.parse(body || '{}'), headers);
        }

        // GET /api/assessments/avatar/:id - Get assessments for avatar
        if (pathParts[0] === 'avatar' && pathParts.length === 2 && httpMethod === 'GET') {
            return handleGetAvatarAssessments(pathParts[1], queryStringParameters, headers);
        }

        // GET /api/assessments/:id - Get single assessment
        if (pathParts.length === 1 && httpMethod === 'GET') {
            return handleGetAssessment(pathParts[0], headers);
        }

        // PATCH /api/assessments/:id/apply - Apply assessment
        if (pathParts.length === 2 && pathParts[1] === 'apply' && httpMethod === 'PATCH') {
            return handleApplyAssessment(pathParts[0], headers);
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Not found' })
        };

    } catch (error) {
        console.error('Assessment API Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * Create new assessment
 */
function handleCreateAssessment(data, headers) {
    // Validate required fields
    if (!data.avatar_id) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'avatar_id is required' })
        };
    }

    if (!data.coach_id || !VALID_COACHES.includes(data.coach_id)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Valid coach_id is required (ray, priscilla, or eddie)' })
        };
    }

    // Validate stats are within range
    const statKeys = ['power', 'finesse', 'speed', 'court_iq', 'consistency', 'mental'];
    for (const key of statKeys) {
        const value = data.stats?.[key];
        if (value !== undefined && (value < 1 || value > 99)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: `${key} must be between 1 and 99` })
            };
        }
    }

    const id = `assessment-${Date.now()}`;

    const assessment = {
        id,
        avatar_id: data.avatar_id,
        coach_id: data.coach_id,
        coach_name: getCoachName(data.coach_id),

        // Stats
        power_rating: data.stats?.power || null,
        finesse_rating: data.stats?.finesse || null,
        speed_rating: data.stats?.speed || null,
        court_iq_rating: data.stats?.court_iq || null,
        consistency_rating: data.stats?.consistency || null,
        mental_rating: data.stats?.mental || null,

        // Feedback
        notes: data.notes || '',
        strengths: data.strengths || [],
        areas_to_improve: data.areas_to_improve || [],
        recommended_drills: data.recommended_drills || [],

        // Status
        status: 'pending', // pending, applied, rejected
        applied_at: null,

        // Timestamps
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    mockAssessments.set(id, assessment);

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
            message: 'Assessment created successfully',
            assessment
        })
    };
}

/**
 * Get assessment by ID
 */
function handleGetAssessment(assessmentId, headers) {
    const assessment = mockAssessments.get(assessmentId);

    if (!assessment) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Assessment not found' })
        };
    }

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify(assessment)
    };
}

/**
 * Get all assessments for an avatar
 */
function handleGetAvatarAssessments(avatarId, params, headers) {
    const limit = parseInt(params?.limit) || 20;
    const status = params?.status; // 'pending', 'applied', 'rejected'

    let assessments = Array.from(mockAssessments.values())
        .filter(a => a.avatar_id === avatarId);

    if (status) {
        assessments = assessments.filter(a => a.status === status);
    }

    assessments = assessments
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            assessments,
            total: assessments.length
        })
    };
}

/**
 * Apply assessment to avatar (updates avatar stats)
 */
function handleApplyAssessment(assessmentId, headers) {
    const assessment = mockAssessments.get(assessmentId);

    if (!assessment) {
        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Assessment not found' })
        };
    }

    if (assessment.status === 'applied') {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Assessment already applied' })
        };
    }

    // In production, this would update the avatar in the database
    // and create stat history entries

    assessment.status = 'applied';
    assessment.applied_at = new Date().toISOString();
    assessment.updated_at = new Date().toISOString();

    mockAssessments.set(assessmentId, assessment);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            message: 'Assessment applied successfully',
            assessment
        })
    };
}

/**
 * Get coach display name
 */
function getCoachName(coachId) {
    const names = {
        'ray': 'Coach Ray',
        'priscilla': 'Coach Priscilla',
        'eddie': 'Coach Eddie'
    };
    return names[coachId] || 'Coach';
}
