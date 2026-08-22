import { NextResponse } from 'next/server';
import { challengeHold } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/gigs/holds/:id/challenge — docs/12-API.md. Tightens the hold's
// expiry to the documented 48-hour window (docs/05-GIGS.md §4).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const hold = await challengeHold(supabase, id);
    return NextResponse.json(hold);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
