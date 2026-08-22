import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// GET /api/auth/google — start "Continue with Google".
//
// Deliberately server-initiated rather than calling signInWithOAuth() from
// the browser. PKCE stores a code verifier when the flow starts, and only
// the side that stored it can complete the exchange. CLAUDE.md requires
// server-side code exchange (/auth/callback), so the flow has to *start*
// on the server too — a browser-initiated flow would put the verifier in
// browser storage and the server callback could never redeem the code.
//
// skipBrowserRedirect keeps Supabase from trying to navigate on its own;
// we get the provider URL back and issue the redirect ourselves, which is
// what lets the verifier land in a server cookie on the way out.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await getServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    // The common cause is the Google provider not being enabled in the
    // Supabase dashboard yet ("Unsupported provider: provider is not
    // enabled"). Send the user back to /login with something readable
    // rather than a raw 500.
    return NextResponse.redirect(`${origin}/login?error=google_unavailable`);
  }

  return NextResponse.redirect(data.url);
}
