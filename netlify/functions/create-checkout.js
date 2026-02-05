// Stripe Checkout Session Creator
// POST /create-checkout
//
// Creates a Stripe Checkout session for:
// - Video analysis ($75 / $120)
// - Membership ($19.99/month or $199/year)
// - Skill evaluation ($35)
// - Instructor fee ($40)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET);
const { getServiceClient, jsonResponse, handleCors } = require('./lib/supabase');
const { withSecurity, isValidEmail } = require('./lib/security');

// SECURITY: Whitelist of allowed origins for redirect URLs
// This prevents attackers from injecting malicious redirect URLs
const ALLOWED_ORIGINS = [
  'https://rayspickleball.com',
  'https://www.rayspickleball.com',
  'https://glowing-biscotti-cf7938.netlify.app',
  'http://localhost:8888', // Netlify dev
  'http://localhost:3000', // Local dev
  'http://127.0.0.1:8888'
];

const DEFAULT_ORIGIN = 'https://glowing-biscotti-cf7938.netlify.app';

// Validate and sanitize origin
function getSafeOrigin(requestOrigin) {
  if (!requestOrigin) return DEFAULT_ORIGIN;

  // Check if origin is in whitelist
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Check for Netlify deploy previews (*.netlify.app)
  if (requestOrigin.match(/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/)) {
    return requestOrigin;
  }

  // Default to production URL if origin not trusted
  console.warn(`Untrusted origin rejected: ${requestOrigin}`);
  return DEFAULT_ORIGIN;
}

// Product configurations
const PRODUCTS = {
  video_30: {
    name: 'Video Analysis - 30 Minutes',
    description: 'Professional pickleball video analysis by Coach Ray',
    price_cents: 7500,
    mode: 'payment'
  },
  video_60: {
    name: 'Video Analysis - 60 Minutes',
    description: 'In-depth professional pickleball video analysis by Coach Ray',
    price_cents: 12000,
    mode: 'payment'
  },
  membership_monthly: {
    name: 'Ray\'s Pickleball Membership - Monthly',
    description: 'Monthly access to AI Drill Coach, Drill Playbook, discounts, and community',
    price_cents: 1999,
    mode: 'subscription'
  },
  membership_annual: {
    name: 'Ray\'s Pickleball Membership - Annual',
    description: 'Annual access to AI Drill Coach, Drill Playbook, discounts, and community (save $40!)',
    price_cents: 19900,
    mode: 'payment' // One-time for annual
  },
  evaluation: {
    name: 'Skill Evaluation',
    description: 'Professional skill level evaluation with personalized feedback',
    price_cents: 3500,
    mode: 'payment'
  },
  instructor_fee: {
    name: 'Instructor Network Fee',
    description: 'Annual instructor listing fee to maintain visibility on the instructor network',
    price_cents: 4000,
    mode: 'payment'
  }
};

const handler = async (event, context) => {
  // Handle CORS
  const corsResponse = handleCors(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Check for Stripe key
  if (!process.env.STRIPE_SECRET_KEY) {
    return jsonResponse(500, {
      error: 'Stripe not configured',
      message: 'Payment processing is not available. Please use Venmo.'
    });
  }

  try {
    const body = JSON.parse(event.body);
    const {
      productType, // 'video_30', 'video_60', 'membership_monthly', etc.
      itemId,      // ID of the video_submission, membership, etc.
      customerEmail,
      customerName,
      successUrl,
      cancelUrl,
      metadata = {}
    } = body;

    // Validate product type
    if (!productType || !PRODUCTS[productType]) {
      return jsonResponse(400, {
        error: 'Invalid product type',
        validTypes: Object.keys(PRODUCTS)
      });
    }

    // Validate email if provided
    if (customerEmail && !isValidEmail(customerEmail)) {
      return jsonResponse(400, { error: 'Invalid email format' });
    }

    const product = PRODUCTS[productType];

    // Build checkout session configuration
    const sessionConfig = {
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description
            },
            unit_amount: product.price_cents,
            ...(product.mode === 'subscription' && {
              recurring: {
                interval: 'month'
              }
            })
          },
          quantity: 1
        }
      ],
      mode: product.mode,
      // SECURITY: Use validated origin, never trust raw header
      success_url: successUrl || `${getSafeOrigin(event.headers.origin)}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${getSafeOrigin(event.headers.origin)}/payment-cancel`,
      metadata: {
        product_type: productType,
        item_id: itemId,
        customer_name: customerName,
        ...metadata
      }
    };

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    // If we have an itemId, update the record with the Stripe session ID
    if (itemId) {
      const supabase = getServiceClient();

      // Determine which table to update based on product type
      let table = null;
      if (productType.startsWith('video_')) {
        table = 'video_submissions';
      } else if (productType.startsWith('membership_')) {
        table = 'memberships';
      } else if (productType === 'evaluation') {
        table = 'skill_evaluations';
      } else if (productType === 'instructor_fee') {
        table = 'instructors';
      }

      if (table) {
        const updateData = {
          payment_method: 'stripe',
          payment_id: session.id
        };

        await supabase
          .from(table)
          .update(updateData)
          .eq('id', itemId);
      }
    }

    return jsonResponse(200, {
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return jsonResponse(500, {
      error: 'Failed to create checkout session',
      message: error.message
    });
  }
};

// Export with security middleware (rate limiting + input sanitization)
exports.handler = withSecurity(handler, {
  endpoint: 'create-checkout',
  rateLimit: true,
  sanitize: true
});
