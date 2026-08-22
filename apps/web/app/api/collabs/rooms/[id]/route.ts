import { NextResponse } from 'next/server';
import { getRoomById, getRoomVersions } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// GET /api/collabs/rooms/:id — docs/12-API.md. Versions come back gated:
// file_key is null on every entry until the room's split sheet locks.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const room = await getRoomById(supabase, id);
    const versions = await getRoomVersions(supabase, id);
    return NextResponse.json({ ...room, versions });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
