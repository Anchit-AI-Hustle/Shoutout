import { NextResponse } from 'next/server';
import { shortlistForBrief } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/gigs/briefs/:id/shortlist → { data: [{ artistId, score,
// components }] } — docs/12-API.md. "shortlist always returns components.
// An unexplained ranking is not trusted."
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const entries = await shortlistForBrief(supabase, ctx.orgId, id);
    return NextResponse.json({ data: entries });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
