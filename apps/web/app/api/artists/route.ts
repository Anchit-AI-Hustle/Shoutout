import { NextResponse } from 'next/server';
import { searchArtists, ModuleError } from '@shoutout/gigs';
import { createAnonClient } from '@shoutout/db';

// GET /api/artists?genre=&city=&role=&limit=&offset= — public artist
// search/browse (migration 019's search_artists_public). Not in
// docs/12-API.md's literal endpoint list — the doc never specified how an
// organiser is supposed to find an artist without already knowing their
// slug. Public and unauthenticated on purpose, same "let people understand
// what's here without signing in" reasoning as the rest of this pass —
// browsing doesn't need an account, only booking does.
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
    const data = await searchArtists(supabase, {
      genre: url.searchParams.get('genre') ?? undefined,
      city: url.searchParams.get('city') ?? undefined,
      role: url.searchParams.get('role') ?? undefined,
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
