import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';

// POST /api/reviews — rate the other side of a completed booking.
//
// The "only after the event" rule is a database trigger (migration 024),
// not a check here: a review written before the gig is a negotiating
// lever, and that has to be impossible rather than discouraged.
//
// Writing a review recomputes the subject's reliability immediately, so
// the score a visitor sees is never stale relative to the reviews under it.
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  direction: z.enum(['organiser_to_artist', 'artist_to_organiser']),
  rating: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5).optional(),
  professionalism: z.number().int().min(1).max(5).optional(),
  soundQuality: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const session = await requireSessionOrg(supabase);
  if ('error' in session) return session.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid review',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, artist_id, org_id')
    .eq('id', parsed.data.bookingId)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Booking not found' } },
      { status: 404 },
    );
  }

  const { error } = await supabase.from('reviews').insert({
    org_id: session.orgId,
    booking_id: booking.id,
    direction: parsed.data.direction,
    rating: parsed.data.rating,
    punctuality: parsed.data.punctuality ?? null,
    professionalism: parsed.data.professionalism ?? null,
    sound_quality: parsed.data.soundQuality ?? null,
    comment: parsed.data.comment ?? null,
    subject_artist_id: parsed.data.direction === 'organiser_to_artist' ? booking.artist_id : null,
    subject_org_id: parsed.data.direction === 'artist_to_organiser' ? booking.org_id : null,
  });

  if (error) {
    if (error.message.includes('BOOKING_NOT_COMPLETE')) {
      return NextResponse.json(
        {
          error: {
            code: 'BOOKING_NOT_COMPLETE',
            message: 'You can only review after the event has happened',
          },
        },
        { status: 409 },
      );
    }
    if (error.code === '23505') {
      return NextResponse.json(
        { error: { code: 'ALREADY_REVIEWED', message: 'You have already reviewed this booking' } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INSERT_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  if (parsed.data.direction === 'organiser_to_artist') {
    // Best-effort: a failed recompute must not fail the review that was
    // already written. The score self-heals on the next recompute.
    await supabase.rpc('recompute_reliability', { p_artist_id: booking.artist_id });
  }

  return NextResponse.json({ reviewed: true });
}
