// API Endpoint: Video Submission
// POST /api/video-submission - Create new submission
// GET /api/video-submission - Get user's submissions (requires auth)
// GET /api/video-submission?admin=true - Get all submissions (admin only)

const { getServiceClient, verifyUser, isAdmin, jsonResponse, handleCors } = require('../lib/supabase');
const { withSecurity, isValidEmail, isValidUrl, validateRequired } = require('../lib/security');

const handler = async (event, context) => {
  // Handle CORS
  const corsResponse = handleCors(event);
  if (corsResponse) return corsResponse;

  const supabase = getServiceClient();

  try {
    // POST - Create new submission
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      const {
        name,
        email,
        phone,
        videoUrl,
        videoLength,
        skillLevel,
        focusAreas,
        referralCode,
        paymentMethod,
        userId // Optional - if user is logged in
      } = body;

      // Validate required fields
      const requiredValidation = validateRequired(body, ['name', 'email', 'videoUrl', 'videoLength']);
      if (!requiredValidation.valid) {
        return jsonResponse(400, {
          error: requiredValidation.error,
          required: ['name', 'email', 'videoUrl', 'videoLength']
        });
      }

      // Validate email format
      if (!isValidEmail(email)) {
        return jsonResponse(400, { error: 'Invalid email format' });
      }

      // Validate video URL format
      if (!isValidUrl(videoUrl)) {
        return jsonResponse(400, { error: 'Invalid video URL format' });
      }

      // Validate video length
      if (![30, 60].includes(parseInt(videoLength))) {
        return jsonResponse(400, { error: 'Invalid video length. Must be 30 or 60.' });
      }

      // Calculate price
      const priceCents = videoLength === 30 ? 7500 : 12000; // $75 or $120

      // Validate referral code if provided
      let validReferralCode = null;
      if (referralCode) {
        const { data: instructor } = await supabase
          .from('instructors')
          .select('referral_code')
          .eq('referral_code', referralCode.toUpperCase())
          .single();

        const { data: user } = await supabase
          .from('users')
          .select('referral_code')
          .eq('referral_code', referralCode.toUpperCase())
          .single();

        if (instructor || user) {
          validReferralCode = referralCode.toUpperCase();
        }
      }

      // Create submission
      const submissionData = {
        video_url: videoUrl,
        video_length: parseInt(videoLength),
        skill_level: skillLevel,
        focus_areas: focusAreas,
        referral_code_used: validReferralCode,
        price_cents: priceCents,
        payment_method: paymentMethod || null,
        status: 'pending_payment'
      };

      // Add user or guest info
      if (userId) {
        submissionData.user_id = userId;
      } else {
        submissionData.guest_name = name;
        submissionData.guest_email = email;
        submissionData.guest_phone = phone;
      }

      const { data: submission, error } = await supabase
        .from('video_submissions')
        .insert(submissionData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return jsonResponse(500, { error: 'Failed to create submission', details: error.message });
      }

      // If referral code was used, create pending referral
      if (validReferralCode) {
        await supabase.from('referrals').insert({
          referrer_code: validReferralCode,
          referred_email: email,
          purchase_type: 'video_analysis',
          purchase_id: submission.id,
          purchase_amount_cents: priceCents,
          status: 'pending',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        });
      }

      return jsonResponse(201, {
        success: true,
        submission: {
          id: submission.id,
          status: submission.status,
          price: priceCents / 100,
          priceFormatted: `$${(priceCents / 100).toFixed(2)}`
        },
        message: 'Submission created. Please complete payment to proceed.'
      });
    }

    // GET - Get submissions
    if (event.httpMethod === 'GET') {
      const authHeader = event.headers.authorization;
      const user = await verifyUser(authHeader);

      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      // Check if admin request
      const isAdminRequest = event.queryStringParameters?.admin === 'true';

      if (isAdminRequest) {
        const userIsAdmin = await isAdmin(user.id);
        if (!userIsAdmin) {
          return jsonResponse(403, { error: 'Admin access required' });
        }

        // Get all submissions for admin
        const { data: submissions, error } = await supabase
          .from('video_submissions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          return jsonResponse(500, { error: 'Failed to fetch submissions' });
        }

        return jsonResponse(200, { submissions });
      }

      // Get user's own submissions
      const { data: submissions, error } = await supabase
        .from('video_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return jsonResponse(500, { error: 'Failed to fetch submissions' });
      }

      return jsonResponse(200, { submissions });
    }

    return jsonResponse(405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('API error:', error);
    return jsonResponse(500, { error: 'Internal server error', message: error.message });
  }
};

// Export with security middleware (rate limiting + input sanitization)
exports.handler = withSecurity(handler, {
  endpoint: 'video-submission',
  rateLimit: true,
  sanitize: true
});
