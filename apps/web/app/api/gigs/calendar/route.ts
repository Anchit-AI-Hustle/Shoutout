import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listCalendar } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/gigs/calendar?from=&to= — roster-wide (docs/12-API.md).
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
    const entries = await listCalendar(supabase, parsed.data.from, parsed.data.to);
    return NextResponse.json({ data: entries });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
