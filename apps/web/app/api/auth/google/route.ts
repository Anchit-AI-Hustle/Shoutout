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
    return NextResponse.redirect(`${origin}/login?error=google_unavailable`);
  }

  // Pre-flight the authorize URL before handing the browser to it.
  //
  // signInWithOAuth({ skipBrowserRedirect }) never contacts Supabase — it
  // builds the URL locally and always returns error: null. So the check
  // above cannot detect a disabled provider, and the browser was being
  // sent straight to a raw Supabase error page:
  //
  //   {"code":400,"error_code":"validation_failed",
  //    "msg":"Unsupported provider: provider is not enabled"}
  //
  // The 400 is only observable by actually requesting the URL, so do that
  // here — server-side, without following the redirect — and translate a
  // failure into something a human can read. On success this costs one
  // extra request on a route that is hit once per sign-in.
  let authorizeStatus: number;
  try {
    const probe = await fetch(data.url, { redirect: 'manual' });
    authorizeStatus = probe.status;
  } catch {
    return NextResponse.redirect(`${origin}/login?error=google_unavailable`);
  }

  // A configured provider answers with a redirect to Google (3xx).
  if (authorizeStatus >= 400) {
    return NextResponse.redirect(`${origin}/login?error=google_unavailable`);
  }

  return NextResponse.redirect(data.url);
}
