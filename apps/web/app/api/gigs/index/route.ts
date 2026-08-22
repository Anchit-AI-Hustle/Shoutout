import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getIndex } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/gigs/index?genre=&city=&eventType=&crowdBand= — docs/12-API.md.
// "The system never invents a price": a cell with sample_n < 5 returns
// INSUFFICIENT_INDEX_DATA with a 200, not an error — a manager pricing
// manually is a normal, expected path, not a failure.
const querySchema = z.object({
  genre: z.string().min(1),
  city: z.string().min(1),
  eventType: z.string().min(1),
  crowdBand: z.enum(['under_100', '100_to_500', '500_to_2000', 'over_2000', 'unknown']),
});

export async function GET(request: Request) {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    genre: url.searchParams.get('genre'),
    city: url.searchParams.get('city'),
    eventType: url.searchParams.get('eventType'),
    crowdBand: url.searchParams.get('crowdBand'),
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid query',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const result = await getIndex(supabase, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
