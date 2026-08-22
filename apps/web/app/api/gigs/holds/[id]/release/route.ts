import { NextResponse } from 'next/server';
import { releaseHold } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/gigs/holds/:id/release — docs/12-API.md.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const hold = await releaseHold(supabase, id);
    return NextResponse.json(hold);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
