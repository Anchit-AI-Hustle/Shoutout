import { NextResponse } from 'next/server';

// GET /api/auth/providers — which social sign-in options actually work.
//
// The Google button was rendered unconditionally, so every visitor who
// clicked it was bounced straight back with an error. Offering a control
// that cannot succeed is worse than not offering it: it reads as a broken
// product rather than an unfinished one.
//
// Availability can only be known by asking Supabase — signInWithOAuth
// builds its URL locally and never reports a disabled provider (see
// /api/auth/google for the full reasoning). So this probes the authorize
// endpoint and caches the answer, since a provider being switched on is a
// once-ever event, not a per-request question.
export const revalidate = 300;

async function isEnabled(supabaseUrl: string, provider: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/authorize?provider=${encodeURIComponent(provider)}`,
      { redirect: 'manual', signal: AbortSignal.timeout(4000) },
    );
    // A configured provider answers with a redirect to the provider; a
    // disabled one answers 400 "provider is not enabled".
    return res.status >= 300 && res.status < 400;
  } catch {
    // Network trouble is not proof of a disabled provider, but hiding the
    // button is the safer failure: a hidden working button costs one email
    // sign-in, a visible broken one costs trust.
    return false;
  }
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return NextResponse.json({ google: false });

  return NextResponse.json({ google: await isEnabled(supabaseUrl, 'google') });
}
