import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';

// POST /api/gigs/log - record a gig that was agreed somewhere else.
//
// Deliberately NOT behind has_entitlement. This is the day-one value that
// earns the right to charge later; gating it would recreate the exact
// problem it exists to fix, which is that a lone artist gets nothing from
// this product until an organiser turns up.
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  artistId: z.string().uuid(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().min(1).max(120),
  eventType: z.string().min(1).max(40),
  // Rupees from the form; paise on the wire and in the database.
  feeRupees: z.number().positive().max(100_000_000),
  organiserName: z.string().min(1).max(200),
  organiserPhone: z.string().max(20).optional(),
  venueName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
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
          message: 'Check the date, fee and organiser name',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { data, error } = await supabase.rpc('log_external_gig', {
    p_artist_id: parsed.data.artistId,
    p_event_date: parsed.data.eventDate,
    p_city: parsed.data.city,
    p_event_type: parsed.data.eventType,
    p_fee_paise: Math.round(parsed.data.feeRupees * 100),
    p_organiser_name: parsed.data.organiserName,
    p_organiser_phone: parsed.data.organiserPhone ?? null,
    p_venue_name: parsed.data.venueName ?? null,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    const code = error.message.includes('FORBIDDEN')
      ? 'FORBIDDEN'
      : error.message.includes('NOT_FOUND')
        ? 'NOT_FOUND'
        : error.message.includes('VALIDATION_FAILED')
          ? 'VALIDATION_FAILED'
          : 'INSERT_FAILED';
    return NextResponse.json(
      { error: { code, message: error.message } },
      { status: code === 'INSERT_FAILED' ? 500 : 400 },
    );
  }

  const row = ((data ?? []) as { booking_id: string; confirmation_token: string }[])[0];
  if (!row) {
    return NextResponse.json(
      { error: { code: 'INSERT_FAILED', message: 'Could not log this gig' } },
      { status: 500 },
    );
  }

  return NextResponse.json({
    bookingId: row.booking_id,
    confirmUrl: `/g/${row.confirmation_token}`,
  });
}
