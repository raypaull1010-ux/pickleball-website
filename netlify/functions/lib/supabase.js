// Supabase client configuration for Netlify Functions
//
// Environment variables needed (set in Netlify dashboard):
// - SUPABASE_URL: Your Supabase project URL
// - SUPABASE_ANON_KEY: Public anon key (for client-side auth)
// - SUPABASE_SERVICE_KEY: Service role key (for admin operations)

const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with the service role key (for server-side operations)
function getServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Create a Supabase client with the anon key (respects RLS policies)
function getAnonClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

// Verify a user's JWT token and return user info
async function verifyUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const client = getAnonClient();

  const { data: { user }, error } = await client.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

// Check if user has admin role
async function isAdmin(userId) {
  const client = getServiceClient();

  const { data, error } = await client
    .from('users')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.role === 'admin';
}

// Standard response helper
function jsonResponse(statusCode, body, additionalHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      ...additionalHeaders
    },
    body: JSON.stringify(body)
  };
}

// CORS preflight handler
function handleCors(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
      },
      body: ''
    };
  }
  return null;
}

module.exports = {
  getServiceClient,
  getAnonClient,
  verifyUser,
  isAdmin,
  jsonResponse,
  handleCors
};
