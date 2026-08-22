import { NextResponse } from 'next/server';
import { z } from 'zod';
import { confirmHold } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/gigs/holds/:id/confirm → 409 DATE_ALREADY_CONFIRMED if taken —
// docs/12-API.md. Delegates to migration 012's confirm_hold RPC, which
// does the state flip and creates the booking row atomically.
const bodySchema = z.object({
  feePaise: z.number().int().positive().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid request',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const booking = await confirmHold(supabase, id, parsed.data.feePaise);
    return NextResponse.json(booking);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
