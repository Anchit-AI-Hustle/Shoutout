import { NextResponse } from 'next/server';
import { createAnonClient } from '@shoutout/db';

// Read and confirm a logged gig by token. Anonymous by design: the
// organiser is usually not a ShoutOut user, and requiring an account is how
// the record never gets made.
export const dynamic = 'force-dynamic';

function anon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createAnonClient(url, key) : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = anon();
  if (!supabase) {
    return NextResponse.json(
      { error: { code: 'CONFIG_MISSING', message: 'Not configured' } },
      { status: 500 },
    );
  }
  const { data, error } = await supabase.rpc('get_gig_confirmation_public', { p_token: token });
  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: error.message } },
      { status: 500 },
    );
  }
  const row = (data ?? [])[0] ?? null;
  if (!row) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'No such booking' } },
      { status: 404 },
    );
  }
  return NextResponse.json({ data: row });
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = anon();
  if (!supabase) {
    return NextResponse.json(
      { error: { code: 'CONFIG_MISSING', message: 'Not configured' } },
      { status: 500 },
    );
  }
  const { data, error } = await supabase.rpc('confirm_gig_public', { p_token: token });
  if (error) {
    return NextResponse.json(
      { error: { code: 'CONFIRM_FAILED', message: error.message } },
      { status: 500 },
    );
  }
  // false means it was already confirmed, which is success from the
  // organiser's point of view, not an error to show them.
  return NextResponse.json({ confirmed: true, alreadyConfirmed: data === false });
}
