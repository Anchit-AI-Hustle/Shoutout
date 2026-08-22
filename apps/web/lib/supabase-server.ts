import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@shoutout/db';

// Route Handlers and Server Components only. Requires
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.
export async function getServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('CONFIG_MISSING: Supabase env vars not configured');
  }

  const cookieStore = await cookies();

  return createServerSupabaseClient(supabaseUrl, supabaseAnonKey, {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });
}
