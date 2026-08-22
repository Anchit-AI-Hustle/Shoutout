import { NextResponse } from 'next/server';
import { getRequest } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/collabs/:id — docs/12-API.md.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const request = await getRequest(supabase, id);
    return NextResponse.json(request);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
