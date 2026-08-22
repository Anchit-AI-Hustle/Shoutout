import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createQuote } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/gigs/quotes { briefId, artistId, feePaise, validUntil } —
// docs/12-API.md.
const bodySchema = z.object({
  briefId: z.string().uuid(),
  artistId: z.string().uuid(),
  feePaise: z.number().int().positive(),
  validUntil: z.string().optional(),
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
          message: 'Invalid quote',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const quote = await createQuote(supabase, {
      orgId: ctx.orgId,
      briefId: parsed.data.briefId,
      artistId: parsed.data.artistId,
      feePaise: parsed.data.feePaise,
      validUntil: parsed.data.validUntil,
    });
    return NextResponse.json(quote, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
