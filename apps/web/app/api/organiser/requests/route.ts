import { NextResponse } from 'next/server';
import { listMyRequests } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/organiser/requests — every brief this org has submitted, across
// however many different artists' orgs are handling them.
export async function GET() {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const data = await listMyRequests(supabase, ctx.orgId);
    return NextResponse.json({ data });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
