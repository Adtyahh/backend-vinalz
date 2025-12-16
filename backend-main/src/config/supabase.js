const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Validate environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL is required in environment variables');
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY is required in environment variables');
}

// Client for public/user operations (with RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Server-side, jangan persist session
      detectSessionInUrl: false
    }
  }
);

// Admin client for operations that bypass RLS
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper function to get client with user token
const getSupabaseClient = (accessToken) => {
  if (!accessToken) return supabase;
  
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

// Test connection
const testConnection = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
    return false;
  }
};

module.exports = {
  supabase,
  supabaseAdmin,
  getSupabaseClient,
  testConnection
};