import { NextResponse } from 'next/server';
import { getBrief } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/gigs/briefs/:id — detail (RLS is the actual boundary; this just
// serialises). docs/12-API.md.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const brief = await getBrief(supabase, id);
    return NextResponse.json(brief);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
