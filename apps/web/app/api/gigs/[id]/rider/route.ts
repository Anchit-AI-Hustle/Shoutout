import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRider, upsertRider } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET/POST /api/gigs/:id/rider — :id is a booking id (docs/12-API.md's
// "{ backline, travel, hospitality }" body). GET also returns confirm_token
// so the manager can build the organiser's share link — same "share
// manually" pattern as Credits' contributor signing link
// (apps/web/app/works/[id]/page.tsx), since WhatsApp dispatch isn't wired
// up either place.
const bodySchema = z.object({
  backline: z.record(z.unknown()).optional(),
  travel: z.record(z.unknown()).optional(),
  hospitality: z.record(z.unknown()).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const rider = await getRider(supabase, id);
    return NextResponse.json(rider);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}

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
          message: 'Invalid rider',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const rider = await upsertRider(supabase, ctx.orgId, id, parsed.data);
    return NextResponse.json(rider, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
