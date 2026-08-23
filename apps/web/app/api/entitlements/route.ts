import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';

// GET /api/entitlements — what this org can currently do.
//
// Purely for rendering: the real gate is in the database (migration 030),
// so a client that lies to itself about this achieves nothing beyond seeing
// a form that then fails.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabaseClient();
  const session = await requireSessionOrg(supabase);
  if ('error' in session) return session.error;

  const { data, error } = await supabase.rpc('my_entitlements');
  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as { entitlement: string; tier: string; status: string }[];
  return NextResponse.json({
    entitlements: rows.map((r) => r.entitlement),
    tier: rows[0]?.tier ?? null,
    status: rows[0]?.status ?? null,
  });
}
