import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSettlement, MoneyError, DEFAULT_TAKE_RATE_BPS } from '@shoutout/money';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';

// POST /api/settlements — draft a settlement for a confirmed booking.
//
// Drafts only. Nothing is instructed to a payment aggregator here, because
// no aggregator is configured yet (see packages/money's provider.ts, which
// throws rather than pretending). The value of drafting now is that the
// ledger, the fee split and the KYC gate are all exercised for real — the
// remaining step is swapping one adapter in.
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  takeRateBps: z.number().int().min(0).max(10_000).optional(),
  tdsBps: z.number().int().min(0).max(10_000).optional(),
  sidemen: z
    .array(
      z.object({
        shareBps: z.number().int().min(1).max(10_000),
        payeeName: z.string().min(1),
        payeeOrgId: z.string().uuid().optional(),
        payeeArtistId: z.string().uuid().optional(),
      }),
    )
    .optional(),
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
          message: 'Invalid settlement request',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, org_id, artist_id, fee_paise, status, artists(stage_name)')
    .eq('id', parsed.data.bookingId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: error.message } },
      { status: 500 },
    );
  }
  if (!booking) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Booking not found' } },
      { status: 404 },
    );
  }
  if (!['confirmed', 'performed', 'settled'].includes(booking.status)) {
    return NextResponse.json(
      {
        error: {
          code: 'BOOKING_NOT_SETTLEABLE',
          message: `A ${booking.status} booking cannot be settled`,
        },
      },
      { status: 409 },
    );
  }

  const artist = booking.artists as unknown as { stage_name: string } | null;

  try {
    const result = await createSettlement(supabase, {
      orgId: session.orgId,
      bookingId: booking.id,
      grossPaise: BigInt(booking.fee_paise),
      takeRateBps: parsed.data.takeRateBps ?? DEFAULT_TAKE_RATE_BPS,
      tdsBps: parsed.data.tdsBps,
      artistOrgId: booking.org_id,
      artistId: booking.artist_id,
      artistName: artist?.stage_name ?? 'Artist',
      sidemen: parsed.data.sidemen,
    });

    return NextResponse.json({
      settlementId: result.settlementId,
      // bigint isn't JSON-serialisable — stringify at the boundary rather
      // than letting a Number() coercion quietly lose precision.
      lines: result.lines.map((l) => ({ ...l, amountPaise: l.amountPaise.toString() })),
    });
  } catch (err) {
    if (err instanceof MoneyError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: 400 },
      );
    }
    if (err instanceof RangeError) {
      return NextResponse.json(
        { error: { code: 'LEDGER_INVALID', message: err.message } },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Could not draft this settlement' } },
      { status: 500 },
    );
  }
}
