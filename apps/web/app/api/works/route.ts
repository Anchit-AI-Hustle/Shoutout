import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// POST /api/works — { title, contributors: [...] }. docs/05-API.md.
// org_id resolved server-side from the session, never from the client.
// Inserts work + contributors atomically via create_work_with_contributors
// (migration 007) — same orphan-row reasoning as POST /api/shouts.
const contributorInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  role: z.string().min(1),
  writerPct: z.number().min(0).max(100).default(0),
  masterPct: z.number().min(0).max(100).default(0),
  workForHire: z.boolean().default(false),
  proAffiliation: z.string().optional(),
});

const createWorkSchema = z.object({
  title: z.string().min(1),
  contributors: z.array(contributorInputSchema).min(1),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createWorkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid work',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: { code: 'NO_ACTIVE_ORG', message: 'No org for this session' } },
      { status: 403 },
    );
  }

  const { data: workId, error: rpcError } = await supabase.rpc('create_work_with_contributors', {
    p_org_id: membership.org_id,
    p_title: parsed.data.title,
    p_contributors: parsed.data.contributors.map((c) => ({
      name: c.name,
      phone: c.phone,
      role: c.role,
      writer_pct: c.writerPct,
      master_pct: c.masterPct,
      work_for_hire: c.workForHire,
      pro_affiliation: c.proAffiliation ?? null,
    })),
  });

  if (rpcError) {
    return NextResponse.json(
      { error: { code: 'INSERT_FAILED', message: rpcError.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: workId, status: 'draft' }, { status: 201 });
}
