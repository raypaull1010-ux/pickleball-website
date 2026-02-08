// ============================================
// Ray's Pickleball - Frontend Configuration
// ============================================
//
// IMPORTANT: Update these values with your actual credentials
// before deploying to production.
//
// For local development, you can use Supabase test/development keys.
// For production, use your production keys.

const CONFIG = {
  // Supabase Configuration
  // Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
  SUPABASE_URL: 'https://jrwgmyksopkuylknwwhp.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impyd2dteWtzb3BrdXlsa253d2hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTE4MTEsImV4cCI6MjA4NTg4NzgxMX0.f6KTTGveXgAL7WOu6uc1_UcNhSGT8wFUoaTGBzdf8Vk',

  // Stripe Configuration (for frontend)
  // Get from: https://dashboard.stripe.com/apikeys
  STRIPE_PUBLISHABLE_KEY: 'pk_test_51SxX7PJyaxk0KFij5Rhnl2lWi5iS1vFJirFC1okGIRUQ69prWmuuRXndWcf8pA1ZJHfEJjmLX87MimgE6TM2qmla00EZqnY2ir',

  // API Base URL (for Netlify functions)
  API_BASE_URL: '/.netlify/functions',

  // Feature Flags
  USE_SUPABASE_AUTH: true, // Supabase is now configured
  USE_STRIPE_PAYMENTS: true, // Stripe is now configured

  // Environment (auto-detected)
  IS_PRODUCTION: typeof window !== 'undefined' && window.location.hostname === 'rayspickleball.com',

  // Error Tracking (optional - set in Netlify env vars)
  SENTRY_DSN: null, // Will be set from environment if available

  // Available Coaches
  // Each coach can receive payments directly via Stripe Connect
  COACHES: [
    { id: 'ray', name: 'Ray', email: 'raypaull1010@gmail.com' },
    { id: 'priscilla', name: 'Priscilla', email: 'priscilla@rayspickleball.com' },
    { id: 'eddie', name: 'Eddie', email: 'eddie@rayspickleball.com' }
  ]
};

// Helper to check if Supabase is properly configured
CONFIG.isSupabaseConfigured = function() {
  return this.SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
         this.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
};

// Helper to check if Stripe is properly configured
CONFIG.isStripeConfigured = function() {
  return this.STRIPE_PUBLISHABLE_KEY !== 'YOUR_STRIPE_PUBLISHABLE_KEY';
};

// Initialize Supabase client if configured
let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (CONFIG.isSupabaseConfigured() && typeof window.supabase !== 'undefined') {
    supabaseClient = window.supabase.createClient(
      CONFIG.SUPABASE_URL,
      CONFIG.SUPABASE_ANON_KEY
    );
  }

  return supabaseClient;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getSupabaseClient };
}
