import { NextResponse } from 'next/server';
import { confirmArtistSide } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/gigs/:id/rider/confirm — docs/12-API.md. The authenticated
// (manager) side of "both sides tick off" — sets artist_confirmed_at. The
// organiser's side is the public GET/POST /api/riders/:id pair.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const rider = await confirmArtistSide(supabase, id);
    return NextResponse.json(rider);
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
