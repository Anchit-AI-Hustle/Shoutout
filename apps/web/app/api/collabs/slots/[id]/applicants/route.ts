import { NextResponse } from 'next/server';
import { listApplicants } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/collabs/slots/:id/applicants — "ranked, poster only"
// (docs/12-API.md). RLS's two-sided applications_read policy already
// restricts this to the poster (or the applicants themselves, who'd only
// ever see their own row anyway via the slot_id filter implicit in a real
// UI) — this route doesn't add its own poster check on top.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const data = await listApplicants(supabase, id);
    return NextResponse.json({ data });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
