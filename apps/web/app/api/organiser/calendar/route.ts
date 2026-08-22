import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listMyCalendar } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/organiser/calendar?from=&to= — confirmed bookings across every
// artist this org has booked, the organiser-side mirror of
// GET /api/gigs/calendar (which is roster-wide for the artist side).
const querySchema = z.object({
  from: z.string(),
  to: z.string(),
});

export async function GET(request: Request) {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'from and to are required (YYYY-MM-DD)' } },
      { status: 422 },
    );
  }

  try {
    const data = await listMyCalendar(supabase, ctx.orgId, parsed.data.from, parsed.data.to);
    return NextResponse.json({ data });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
