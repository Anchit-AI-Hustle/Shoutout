import { NextResponse } from 'next/server';
import { createAnonClient } from '@shoutout/db';
import { ModuleError, getPublicProfile } from '@shoutout/profiles';

// GET /api/profiles/:slug — public (docs/12-API.md). Via get_artist_public /
// get_artist_roles_public (migration 011) — id/slug-keyed SECURITY DEFINER
// functions, not an open RLS policy, so the anon key can't list every
// artist in the database.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: { code: 'CONFIG_MISSING', message: 'Supabase env vars not configured' } },
      { status: 500 },
    );
  }

  const supabase = createAnonClient(supabaseUrl, supabaseAnonKey);

  try {
    const profile = await getPublicProfile(supabase, slug);
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof ModuleError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 500;
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Something went wrong' } },
      { status: 500 },
    );
  }
}
