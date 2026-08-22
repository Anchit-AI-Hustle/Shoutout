import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface CookieToSet {
  name: string;
  value: string;
  options?: CookieOptionsWithName;
}

// Refreshes the Supabase session cookie on every request. Required so a
// session doesn't silently expire mid-visit — @supabase/ssr's documented
// Next.js middleware pattern.
export async function middleware(request: NextRequest) {
  // Catch an auth code wherever it lands.
  //
  // Supabase only honours `redirect_to` if the exact URL is in the
  // project's Redirect URLs allowlist. When it isn't, it silently falls
  // back to the Site URL *root* — so a magic link arrives at `/?code=…`,
  // not at `/auth/callback?code=…`, and nothing at `/` redeems it. The
  // link then appears to do nothing at all: the user lands on the
  // homepage, still signed out, with no error.
  //
  // Verified by following a real link end to end:
  //   303 -> https://shoutout.anchit-tandon.com/?code=208cc20a-…
  //
  // Rather than depending on a dashboard allowlist entry that this repo
  // can't set or test, forward any `?code=` to the callback route from
  // here. Works no matter which path Supabase picks.
  const code = request.nextUrl.searchParams.get('code');
  if (code && request.nextUrl.pathname !== '/auth/callback') {
    const callback = new URL('/auth/callback', request.url);
    callback.searchParams.set('code', code);
    // Preserve where they were headed, but never send an off-site path on.
    const next = request.nextUrl.pathname;
    if (next.startsWith('/') && !next.startsWith('//')) {
      callback.searchParams.set('next', next);
    }
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options ?? {}),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
