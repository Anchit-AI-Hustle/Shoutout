import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';

// Customer-discovery capture. GET returns the live scoreboard; POST logs one
// interview and its per-hypothesis verdicts in a single call, because an
// interview that is half-recorded is worse than one that isn't.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getServerSupabaseClient();
  const session = await requireSessionOrg(supabase);
  if ('error' in session) return session.error;

  const [{ data: board, error }, { data: interviews }] = await Promise.all([
    supabase.rpc('research_scoreboard'),
    supabase
      .from('research_interviews')
      .select('id, segment, company_name, city, held_on, quoted_price_paise, pays_for_software')
      .order('held_on', { ascending: false })
      .limit(50),
  ]);

  if (error) {
    return NextResponse.json(
      { error: { code: 'QUERY_FAILED', message: error.message } },
      { status: 500 },
    );
  }

  return NextResponse.json({ scoreboard: board ?? [], interviews: interviews ?? [] });
}

const bodySchema = z.object({
  segment: z.enum([
    'event_company',
    'college_fest',
    'artist_manager',
    'musician',
    'wedding_planner',
    'venue',
  ]),
  companyName: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  quotedPricePaise: z.number().int().min(0).optional(),
  paysForSoftware: z.boolean().optional(),
  notes: z.string().max(8000).optional(),
  verdicts: z
    .array(
      z.object({
        hypothesisId: z.string().regex(/^H[1-8]$/),
        verdict: z.enum(['supports', 'kills', 'unclear']),
        quote: z.string().max(2000).optional(),
      }),
    )
    .default([]),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const session = await requireSessionOrg(supabase);
  if ('error' in session) return session.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid interview',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { data: interview, error } = await supabase
    .from('research_interviews')
    .insert({
      org_id: session.orgId,
      segment: parsed.data.segment,
      company_name: parsed.data.companyName ?? null,
      contact_name: parsed.data.contactName ?? null,
      city: parsed.data.city ?? null,
      quoted_price_paise: parsed.data.quotedPricePaise ?? null,
      pays_for_software: parsed.data.paysForSoftware ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select('id')
    .single();

  if (error || !interview) {
    return NextResponse.json(
      { error: { code: 'INSERT_FAILED', message: error?.message ?? 'Could not save' } },
      { status: 500 },
    );
  }

  if (parsed.data.verdicts.length > 0) {
    const { error: vErr } = await supabase.from('research_responses').insert(
      parsed.data.verdicts.map((v) => ({
        org_id: session.orgId,
        interview_id: interview.id,
        hypothesis_id: v.hypothesisId,
        verdict: v.verdict,
        quote: v.quote ?? null,
      })),
    );
    if (vErr) {
      return NextResponse.json(
        { error: { code: 'INSERT_FAILED', message: vErr.message } },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ interviewId: interview.id });
}
