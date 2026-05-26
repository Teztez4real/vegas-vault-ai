import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

// Server-side only — do NOT import in client components
export function getSupabaseAdmin() {
  const { createClient: cc } = require('@supabase/supabase-js');
  return cc(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
