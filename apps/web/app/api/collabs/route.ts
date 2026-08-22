import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createRequest, listRequests } from '@shoutout/collabs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/collabs { kind, title, body?, brief?, referenceUrl?, visibility,
// deadline?, slots: Slot[] }, GET /api/collabs?kind=&role=&city=&paid=&cursor=
// — docs/12-API.md. `cursor` isn't implemented (this returns the latest 50,
// no pagination cursor yet) — flagged rather than faked.
const slotSchema = z.object({
  role: z.string().min(1),
  requirements: z.record(z.unknown()).default({}),
  compModel: z.enum(['fee', 'points', 'hybrid', 'credit']),
  feePaise: z.number().int().positive().optional(),
  writerPct: z.number().min(0).max(100).optional(),
  masterPct: z.number().min(0).max(100).optional(),
  revisionsIncluded: z.number().int().min(0).optional(),
});

const kinds = ['track', 'band', 'crew', 'engineer', 'visual', 'mentor', 'session'] as const;

const createSchema = z.object({
  artistId: z.string().uuid(),
  kind: z.enum(kinds),
  title: z.string().min(1),
  body: z.string().optional(),
  brief: z.record(z.unknown()).optional(),
  referenceUrl: z.string().url().optional(),
  city: z.string().optional(),
  visibility: z.enum(['open', 'invite', 'roster', 'verified']).default('open'),
  deadline: z.string().optional(),
  slots: z.array(slotSchema).min(1).max(6),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid request',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const requestId = await createRequest(supabase, {
      orgId: ctx.orgId,
      artistId: parsed.data.artistId,
      kind: parsed.data.kind,
      title: parsed.data.title,
      body: parsed.data.body,
      briefJson: parsed.data.brief,
      referenceUrl: parsed.data.referenceUrl,
      city: parsed.data.city,
      visibility: parsed.data.visibility,
      deadline: parsed.data.deadline,
      slots: parsed.data.slots,
    });
    return NextResponse.json({ id: requestId }, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}

export async function GET(request: Request) {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const url = new URL(request.url);
  const paidParam = url.searchParams.get('paid');

  try {
    const data = await listRequests(supabase, {
      kind: url.searchParams.get('kind') ?? undefined,
      role: url.searchParams.get('role') ?? undefined,
      city: url.searchParams.get('city') ?? undefined,
      paid: paidParam === null ? undefined : paidParam === 'true',
    });
    return NextResponse.json({ data });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
