import { NextResponse } from 'next/server';
import { ModuleError, getRiderPublic } from '@shoutout/gigs';
import { createAnonClient } from '@shoutout/db';

// GET /api/riders/:id?token= — public, the organiser's view. Possession of
// the link (id + confirm_token) is the credential, same shape as Credits'
// public work share page.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get('token');
  if (!token) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Missing token' } },
      { status: 422 },
    );
  }

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
    const rider = await getRiderPublic(supabase, id, token);
    return NextResponse.json(rider);
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
