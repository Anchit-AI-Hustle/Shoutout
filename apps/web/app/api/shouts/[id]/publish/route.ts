import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/shouts/:id/publish — docs/05-API.md: "draft → open, queues
// match job → 202 { matchJobId }".
//
// No job queue exists yet (Inngest, docs/09-BUILD-SEQUENCE.md M1/M8) — this
// performs the draft->open transition only (the state machine trigger from
// migration 003 enforces it's a valid move) and returns 202 without a
// matchJobId, rather than fabricating one. Matching has to be triggered some
// other way (manually, or via GET /api/match/preview) until the queue
// exists.
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
    .from('shouts')
    .update({ status: 'open' })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id, status')
    .maybeSingle();

  if (error) {
    const isTransitionError = error.message.includes('INVALID_TRANSITION');
    return NextResponse.json(
      {
        error: {
          code: isTransitionError ? 'INVALID_TRANSITION' : 'PUBLISH_FAILED',
          message: error.message,
        },
      },
      { status: isTransitionError ? 409 : 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Shout not found, not a draft, or not yours' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ id: data.id, status: data.status, matchJobId: null }, { status: 202 });
}
