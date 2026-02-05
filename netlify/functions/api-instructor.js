// API Endpoint: Instructor
// POST /api/instructor - Register as instructor
// GET /api/instructor - Get visible instructors (public)
// GET /api/instructor?id=xxx - Get specific instructor
// PUT /api/instructor - Update own profile (requires auth)

const { getServiceClient, verifyUser, isAdmin, jsonResponse, handleCors } = require('./lib/supabase');
const { withSecurity, isValidEmail, validateRequired } = require('./lib/security');

// Grace period configuration
const GRACE_PERIOD_DAYS = 90;
const INSTRUCTOR_FEE_CENTS = 4000; // $40
const REQUIRED_REFERRALS = 2;

// Generate a unique referral code
function generateReferralCode(name) {
  const namePart = name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePart}${randomPart}`;
}

const handler = async (event, context) => {
  // Handle CORS
  const corsResponse = handleCors(event);
  if (corsResponse) return corsResponse;

  const supabase = getServiceClient();

  try {
    // POST - Register new instructor
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      const {
        name,
        email,
        phone,
        location,
        bio,
        photoUrl,
        experienceYears,
        certifications,
        specialties,
        userId
      } = body;

      // Validate required fields
      const requiredValidation = validateRequired(body, ['name', 'email']);
      if (!requiredValidation.valid) {
        return jsonResponse(400, {
          error: requiredValidation.error,
          required: ['name', 'email']
        });
      }

      // Validate email format
      if (!isValidEmail(email)) {
        return jsonResponse(400, { error: 'Invalid email format' });
      }

      // Check if email already registered
      const { data: existing } = await supabase
        .from('instructors')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (existing) {
        return jsonResponse(400, { error: 'An instructor with this email already exists.' });
      }

      // Generate unique referral code
      let referralCode = generateReferralCode(name);
      let codeExists = true;
      let attempts = 0;

      while (codeExists && attempts < 10) {
        const { data } = await supabase
          .from('instructors')
          .select('id')
          .eq('referral_code', referralCode)
          .single();

        if (!data) {
          codeExists = false;
        } else {
          referralCode = generateReferralCode(name);
          attempts++;
        }
      }

      // Calculate grace period end date
      const gracePeriodEnds = new Date();
      gracePeriodEnds.setDate(gracePeriodEnds.getDate() + GRACE_PERIOD_DAYS);

      // Create instructor
      const instructorData = {
        name,
        email: email.toLowerCase(),
        phone,
        location,
        bio,
        photo_url: photoUrl,
        experience_years: experienceYears ? parseInt(experienceYears) : null,
        certifications: certifications || [],
        specialties: specialties || [],
        referral_code: referralCode,
        status: 'grace_period',
        grace_period_start: new Date().toISOString(),
        grace_period_ends: gracePeriodEnds.toISOString(),
        is_visible: true,
        total_referrals: 0,
        membership_referrals: 0,
        has_paid_fee: false
      };

      if (userId) {
        instructorData.user_id = userId;

        // Update user role
        await supabase
          .from('users')
          .update({ role: 'instructor' })
          .eq('id', userId);
      }

      const { data: instructor, error } = await supabase
        .from('instructors')
        .insert(instructorData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return jsonResponse(500, { error: 'Failed to create instructor profile', details: error.message });
      }

      return jsonResponse(201, {
        success: true,
        instructor: {
          id: instructor.id,
          name: instructor.name,
          referralCode: instructor.referral_code,
          gracePeriodEnds: instructor.grace_period_ends,
          status: instructor.status
        },
        message: `Welcome to the instructor network! Your referral code is ${referralCode}. Your profile is visible during the ${GRACE_PERIOD_DAYS}-day grace period. After that, maintain visibility by paying $${INSTRUCTOR_FEE_CENTS / 100} or referring ${REQUIRED_REFERRALS}+ members.`
      });
    }

    // GET - Get instructors
    if (event.httpMethod === 'GET') {
      const { id, admin, all } = event.queryStringParameters || {};

      // Get specific instructor
      if (id) {
        const { data: instructor, error } = await supabase
          .from('instructors')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !instructor) {
          return jsonResponse(404, { error: 'Instructor not found' });
        }

        // If not visible and not admin, return 404
        if (!instructor.is_visible) {
          const authHeader = event.headers.authorization;
          const user = await verifyUser(authHeader);

          if (!user) {
            return jsonResponse(404, { error: 'Instructor not found' });
          }

          const userIsAdmin = await isAdmin(user.id);
          const isOwnProfile = instructor.user_id === user.id;

          if (!userIsAdmin && !isOwnProfile) {
            return jsonResponse(404, { error: 'Instructor not found' });
          }
        }

        return jsonResponse(200, { instructor });
      }

      // Admin request - get all instructors including hidden
      if (admin === 'true' || all === 'true') {
        const authHeader = event.headers.authorization;
        const user = await verifyUser(authHeader);

        if (!user) {
          return jsonResponse(401, { error: 'Authentication required' });
        }

        const userIsAdmin = await isAdmin(user.id);
        if (!userIsAdmin) {
          return jsonResponse(403, { error: 'Admin access required' });
        }

        const { data: instructors, error } = await supabase
          .from('instructors')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          return jsonResponse(500, { error: 'Failed to fetch instructors' });
        }

        return jsonResponse(200, { instructors });
      }

      // Public request - get visible instructors only
      const { data: instructors, error } = await supabase
        .from('instructors')
        .select('id, name, location, bio, photo_url, experience_years, certifications, specialties, referral_code')
        .eq('is_visible', true)
        .order('name', { ascending: true });

      if (error) {
        return jsonResponse(500, { error: 'Failed to fetch instructors' });
      }

      return jsonResponse(200, { instructors });
    }

    // PUT - Update instructor profile
    if (event.httpMethod === 'PUT') {
      const authHeader = event.headers.authorization;
      const user = await verifyUser(authHeader);

      if (!user) {
        return jsonResponse(401, { error: 'Authentication required' });
      }

      const body = JSON.parse(event.body);
      const { id } = event.queryStringParameters || {};

      // Get the instructor to update
      const query = id
        ? supabase.from('instructors').select('*').eq('id', id).single()
        : supabase.from('instructors').select('*').eq('user_id', user.id).single();

      const { data: instructor, error: fetchError } = await query;

      if (fetchError || !instructor) {
        return jsonResponse(404, { error: 'Instructor profile not found' });
      }

      // Check permissions
      const userIsAdmin = await isAdmin(user.id);
      const isOwnProfile = instructor.user_id === user.id;

      if (!userIsAdmin && !isOwnProfile) {
        return jsonResponse(403, { error: 'Not authorized to update this profile' });
      }

      // Build update data
      const updateData = {};
      const allowedFields = ['name', 'phone', 'location', 'bio', 'photo_url', 'experience_years', 'certifications', 'specialties'];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          // Convert camelCase to snake_case
          const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          updateData[dbField] = body[field];
        }
      }

      // Admin-only fields
      if (userIsAdmin) {
        if (body.status !== undefined) updateData.status = body.status;
        if (body.isVisible !== undefined) updateData.is_visible = body.isVisible;
        if (body.hasPaidFee !== undefined) {
          updateData.has_paid_fee = body.hasPaidFee;
          if (body.hasPaidFee) {
            updateData.fee_paid_at = new Date().toISOString();
            updateData.is_visible = true;
            updateData.status = 'active';
          }
        }
      }

      if (Object.keys(updateData).length === 0) {
        return jsonResponse(400, { error: 'No valid fields to update' });
      }

      const { data: updated, error: updateError } = await supabase
        .from('instructors')
        .update(updateData)
        .eq('id', instructor.id)
        .select()
        .single();

      if (updateError) {
        return jsonResponse(500, { error: 'Failed to update profile', details: updateError.message });
      }

      return jsonResponse(200, {
        success: true,
        instructor: updated,
        message: 'Profile updated successfully'
      });
    }

    return jsonResponse(405, { error: 'Method not allowed' });

  } catch (error) {
    console.error('API error:', error);
    return jsonResponse(500, { error: 'Internal server error', message: error.message });
  }
};

// Export with security middleware (rate limiting + input sanitization)
exports.handler = withSecurity(handler, {
  endpoint: 'instructor',
  rateLimit: true,
  sanitize: true
});
