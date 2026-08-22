import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// GET /auth/callback — server-side PKCE code exchange (CLAUDE.md: "PKCE
// with server-side code exchange").
//
// This is the zero-configuration way in. Supabase's stock email template
// sends a link rather than a 6-digit code — the code only appears if the
// template is edited to include {{ .Token }} — so without this route, a
// project that hasn't customised its templates has no working sign-in at
// all. With it, both shapes work: the code path via
// /api/auth/otp/verify, the link path here.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await getServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Relative paths only — an absolute `next` would let a crafted link
  // bounce a freshly-authenticated user to another origin.
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return NextResponse.redirect(`${origin}${target}`);
}
