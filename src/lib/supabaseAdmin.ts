import { createClient } from '@supabase/supabase-js';

// On Vercel serverless, env vars don't have VITE_ prefix
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Service-role client (bypasses RLS). Use ONLY when you need elevated privileges.
// Falls back to anon key if service role key is not set (local dev without it).
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Create a Supabase client authenticated with a user's JWT access token.
 * This ensures auth.uid() works correctly in RLS policies on the server side.
 * Use this for ALL database operations on behalf of a user when the service role key is unavailable.
 */
export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
