import { NextResponse } from 'next/server';
import { searchOrganisers, ModuleError } from '@shoutout/profiles';
import { createAnonClient } from '@shoutout/db';

// GET /api/organisers?city=&eventType= — public organiser browse.
// Mirrors /api/artists: both sides of the marketplace are browsable
// without an account, because judging who you'd work with is the thing
// that makes someone sign up.
export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: { code: 'CONFIG_MISSING', message: 'Supabase env vars not configured' } },
      { status: 500 },
    );
  }

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);
  const url = new URL(request.url);

  try {
    const data = await searchOrganisers(supabase, {
      city: url.searchParams.get('city') ?? undefined,
      eventType: url.searchParams.get('eventType') ?? undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ModuleError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Something went wrong' } },
      { status: 500 },
    );
  }
}
