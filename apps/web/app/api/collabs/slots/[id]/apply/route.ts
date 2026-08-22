import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyToSlot } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/collabs/slots/:id/apply { pitch?, demoUrl? } — docs/12-API.md,
// rate limit 20/day.
const bodySchema = z.object({
  artistId: z.string().uuid(),
  pitch: z.string().max(2000).optional(),
  demoUrl: z.string().url().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
          message: 'Invalid application',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const application = await applyToSlot(supabase, {
      orgId: ctx.orgId,
      slotId: id,
      artistId: parsed.data.artistId,
      pitch: parsed.data.pitch,
      demoUrl: parsed.data.demoUrl,
    });
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
