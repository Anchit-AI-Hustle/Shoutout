import { createClient } from '@supabase/supabase-js';

// Anon-key client. RLS enforces isolation — never the service-role key here.
// See docs/02-ARCHITECTURE.md: "service-role key only in workflows/ and
// admin/, never in a user path."
export function createAnonClient(supabaseUrl: string, supabaseAnonKey: string) {
  return createClient(supabaseUrl, supabaseAnonKey);
}
