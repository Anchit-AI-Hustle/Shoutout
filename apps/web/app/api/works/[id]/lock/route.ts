import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/works/:id/lock — "the most important endpoint in the product."
// (docs/05-API.md) The 100%-writer, 100%-master, all-signed invariant is
// enforced by migration 007's assert_splits_total trigger, not this route —
// this just attempts the transition and translates the trigger's exception
// into the documented 409 code.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from('works')
    .update({ status: 'locked', locked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id, status, locked_at')
    .maybeSingle();

  if (error) {
    const isSplitsError = error.message.includes('SPLITS_MUST_TOTAL_100');
    const isSignError = error.message.includes('ALL_CONTRIBUTORS_MUST_SIGN');
    const code = isSplitsError
      ? 'SPLITS_MUST_TOTAL_100'
      : isSignError
        ? 'ALL_CONTRIBUTORS_MUST_SIGN'
        : 'LOCK_FAILED';
    return NextResponse.json(
      { error: { code, message: error.message } },
      { status: code === 'LOCK_FAILED' ? 500 : 409 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Work not found, not yours, or already locked' } },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
