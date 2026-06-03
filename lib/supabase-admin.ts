import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error('Missing env SUPABASE_URL');
  if (!key) throw new Error('Missing env SUPABASE_SERVICE_ROLE_KEY');

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
