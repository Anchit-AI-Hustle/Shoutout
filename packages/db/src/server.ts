import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';

// Cookie-based server client — Route Handlers, Server Components, middleware.
// Runs with the USER's session (RLS enforces isolation), never the
// service-role key. See docs/02-ARCHITECTURE.md.
//
// Framework-agnostic on purpose: apps/web supplies the cookie adapter (from
// next/headers or a NextRequest/NextResponse pair) so this package doesn't
// depend on Next.js.
export function createServerSupabaseClient(
  supabaseUrl: string,
  supabaseAnonKey: string,
  cookies: CookieMethodsServer,
) {
  return createServerClient(supabaseUrl, supabaseAnonKey, { cookies });
}
