import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHold } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/gigs/holds { artistId, eventDate, briefId? } — docs/12-API.md.
// Priority (soft_1/2/3 — "right of first refusal") is assigned server-side
// from existing active holds on the date, never accepted from the client.
const bodySchema = z.object({
  artistId: z.string().uuid(),
  eventDate: z.string(),
  briefId: z.string().uuid().optional(),
  holdDurationHours: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid hold',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const hold = await createHold(supabase, {
      orgId: ctx.orgId,
      artistId: parsed.data.artistId,
      eventDate: parsed.data.eventDate,
      briefId: parsed.data.briefId,
      holdDurationHours: parsed.data.holdDurationHours,
    });
    return NextResponse.json(hold, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
