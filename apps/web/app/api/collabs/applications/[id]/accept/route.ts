import { NextResponse } from 'next/server';
import { acceptApplication } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/collabs/applications/:id/accept → opens a Room, drafts the
// split sheet (docs/12-API.md, docs/06-COLLABS.md).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const result = await acceptApplication(supabase, id);
    return NextResponse.json(result);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
