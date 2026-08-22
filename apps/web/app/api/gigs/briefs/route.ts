import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBrief, listBriefs } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/gigs/briefs, GET /api/gigs/briefs — docs/12-API.md. The
// authenticated path (a manager logging an inbound enquiry themselves);
// the public "Book this artist" path is POST /api/gigs/book.
const eventTypes = [
  'wedding',
  'corporate',
  'festival',
  'club',
  'college',
  'private',
  'government',
  'temple',
  'other',
] as const;

const createBriefSchema = z.object({
  eventDate: z.string().optional(),
  dateFlexibleUntil: z.string().optional(),
  city: z.string().min(1),
  eventType: z.enum(eventTypes),
  genres: z.array(z.string()).default([]),
  budgetMin: z.number().int().positive().optional(),
  budgetMax: z.number().int().positive().optional(),
  crowdSize: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => null);
  const parsed = createBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid brief',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const brief = await createBrief(supabase, {
      orgId: ctx.orgId,
      eventDate: parsed.data.eventDate,
      dateFlexibleUntil: parsed.data.dateFlexibleUntil,
      city: parsed.data.city,
      eventType: parsed.data.eventType,
      genres: parsed.data.genres,
      budgetMinPaise: parsed.data.budgetMin,
      budgetMaxPaise: parsed.data.budgetMax,
      crowdSize: parsed.data.crowdSize,
      notes: parsed.data.notes,
    });
    return NextResponse.json(brief, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}

export async function GET() {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  try {
    const briefs = await listBriefs(supabase);
    return NextResponse.json({ data: briefs });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
