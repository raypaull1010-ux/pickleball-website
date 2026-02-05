// API Endpoint: Membership
// POST /api/membership - Create new membership request
// GET /api/membership - Get user's membership (requires auth)

const { getServiceClient, verifyUser, isAdmin, jsonResponse, handleCors } = require('./lib/supabase');
const { withSecurity, isValidEmail, validateRequired } = require('./lib/security');

// Pricing
const PRICES = {
  monthly: 1999, // $19.99
  annual: 19900  // $199.00
};

// Founding member tracking (first 50 get special pricing)
const FOUNDING_MEMBER_LIMIT = 50;

const handler = async (event, context) => {
  // Handle CORS
  const corsResponse = handleCors(event);
  if (corsResponse) return corsResponse;

  const supabase = getServiceClient();

  try {
    // POST - Create new membership
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      const {
        name,
        email,
        plan,
        paymentMethod,
        referralCode,
        userId
      } = body;

      // Validate required fields
      const requiredValidation = validateRequired(body, ['name', 'email', 'plan']);
      if (!requiredValidation.valid) {
        return jsonResponse(400, {
          error: requiredValidation.error,
          required: ['name', 'email', 'plan']
        });
      }

      // Validate email format
      if (!isValidEmail(email)) {
        return jsonResponse(400, { error: 'Invalid email format' });
      }

      // Validate plan
      if (!['monthly', 'annual'].includes(plan)) {
        return jsonResponse(400, { error: 'Invalid plan. Must be "monthly" or "annual".' });
      }

      const priceCents = PRICES[plan];

      // Check founding member count
      const { count: memberCount } = await supabase
        .from('memberships')
        .select('*', { count: 'exact', head: true })
        .in('status', ['active', 'payment_received']);

      const isFoundingMember = memberCount < FOUNDING_MEMBER_LIMIT;
      const foundingMemberNumber = isFoundingMember ? memberCount + 1 : null;

      // Validate referral code if provided
      let validReferralCode = null;
      if (referralCode) {
        const { data: instructor } = await supabase
          .from('instructors')
          .select('referral_code, id')
          .eq('referral_code', referralCode.toUpperCase())
          .single();

        const { data: user } = await supabase
          .from('users')
          .select('referral_code')
          .eq('referral_code', referralCode.toUpperCase())
          .single();

        if (instructor || user) {
          validReferralCode = referralCode.toUpperCase();

          // If instructor referral, increment their membership_referrals count
          if (instructor) {
            await supabase
              .from('instructors')
              .update({
                membership_referrals: instructor.membership_referrals + 1,
                total_referrals: instructor.total_referrals + 1
              })
              .eq('id', instructor.id);
          }
        }
      }

      // Create membership
      const membershipData = {
        plan,
        price_cents: priceCents,
        payment_method: paymentMethod || null,
        status: 'pending_payment',
        is_founding_member: isFoundingMember,
        founding_member_number: foundingMemberNumber,
        referral_code_used: validReferralCode
      };

      if (userId) {
        membershipData.user_id = userId;
      } else {
        membershipData.guest_name = name;
        membershipData.guest_email = email;
      }

      const { data: membership, error } = await supabase
        .from('memberships')
        .insert(membershipData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return jsonResponse(500, { error: 'Failed to create membership', details: error.message });
      }

      // If referral code was used, create pending referral
      if (validReferralCode) {
        await supabase.from('referrals').insert({
          referrer_code: validReferralCode,
          referred_email: email,
          purchase_type: 'membership',
          purchase_id: membership.id,
          purchase_amount_cents: priceCents,
          status: 'pending',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
      }

      return jsonResponse(201, {
        success: true,
        membership: {
          id: membership.id,
          plan: membership.plan,
          status: membership.status,
          price: priceCents / 100,
          priceFormatted: plan === 'monthly' ? '$19.99/month' : '$199/year',
          isFoundingMember,
          foundingMemberNumber
        },
        message: isFoundingMember
          ? `Congratulations! You're founding member #${foundingMemberNumber}! Please complete payment.`
          : 'Membership request created. Please complete payment to activate.'
      });
    }

    // GET - Get membership status
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

        const { data: memberships, error } = await supabase
          .from('memberships')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          return jsonResponse(500, { error: 'Failed to fetch memberships' });
        }

        return jsonResponse(200, { memberships });
      }

      // Get user's membership
      const { data: membership, error } = await supabase
        .from('memberships')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        return jsonResponse(500, { error: 'Failed to fetch membership' });
      }

      return jsonResponse(200, {
        membership: membership || null,
        isActive: membership?.status === 'active'
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
  endpoint: 'membership',
  rateLimit: true,
  sanitize: true
});
