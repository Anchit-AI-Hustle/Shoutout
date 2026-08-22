import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';

// PATCH /api/works/:id/contributors — draft only. docs/05-API.md.
// Migration 007's contributors_lock_guard trigger already refuses any
// write once the work locks — this route additionally refuses editing a
// contributor who has already signed, so changing someone's split after
// they've signed off on it isn't silently allowed (a real integrity gap
// the trigger alone doesn't cover, since "locked" and "signed" are
// different states).
const contributorPatchSchema = z.object({
  id: z.string().uuid().optional(), // present = update, absent = new contributor
  name: z.string().min(1),
  phone: z.string().min(6),
  role: z.string().min(1),
  writerPct: z.number().min(0).max(100).default(0),
  masterPct: z.number().min(0).max(100).default(0),
  workForHire: z.boolean().default(false),
  proAffiliation: z.string().optional(),
});

const bodySchema = z.object({
  contributors: z.array(contributorPatchSchema),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workId } = await params;
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid contributors',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { data: work } = await supabase
    .from('works')
    .select('org_id, status')
    .eq('id', workId)
    .maybeSingle();
  if (!work) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Work not found' } },
      { status: 404 },
    );
  }
  if (work.status !== 'draft') {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_TRANSITION',
          message: 'Only a draft work can have contributors edited',
        },
      },
      { status: 409 },
    );
  }

  const existingIds = parsed.data.contributors.filter((c) => c.id).map((c) => c.id);
  if (existingIds.length > 0) {
    const { data: signedAlready } = await supabase
      .from('contributors')
      .select('id')
      .in('id', existingIds as string[])
      .not('signed_at', 'is', null);
    if (signedAlready && signedAlready.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'CONTRIBUTOR_ALREADY_SIGNED',
            message: 'Cannot edit a contributor who has already signed',
            details: { ids: signedAlready.map((c) => c.id) },
          },
        },
        { status: 409 },
      );
    }
  }

  for (const c of parsed.data.contributors) {
    if (c.id) {
      const { error } = await supabase
        .from('contributors')
        .update({
          name: c.name,
          phone: c.phone,
          role: c.role,
          writer_pct: c.writerPct,
          master_pct: c.masterPct,
          work_for_hire: c.workForHire,
          pro_affiliation: c.proAffiliation ?? null,
        })
        .eq('id', c.id);
      if (error) {
        return NextResponse.json(
          { error: { code: 'UPDATE_FAILED', message: error.message } },
          { status: 500 },
        );
      }
    } else {
      const { error } = await supabase.from('contributors').insert({
        work_id: workId,
        org_id: work.org_id,
        name: c.name,
        phone: c.phone,
        role: c.role,
        writer_pct: c.writerPct,
        master_pct: c.masterPct,
        work_for_hire: c.workForHire,
        pro_affiliation: c.proAffiliation ?? null,
        signature_ref: crypto.randomUUID(),
      });
      if (error) {
        return NextResponse.json(
          { error: { code: 'INSERT_FAILED', message: error.message } },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ id: workId, status: 'draft' });
}
