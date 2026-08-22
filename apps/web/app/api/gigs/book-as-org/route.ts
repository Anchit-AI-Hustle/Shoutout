import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bookAsOrganiser } from '@shoutout/gigs';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { requireSessionOrg } from '@/lib/require-session-org';
import { moduleErrorResponse } from '@/lib/module-error-response';

// POST /api/gigs/book-as-org — the signed-in equivalent of
// POST /api/gigs/book (public). Not in docs/12-API.md's literal list, same
// reasoning as that route: the doc never specified an organiser-dashboard
// booking path. org_id is resolved server-side from the session via
// migration 019's create_authenticated_brief_for_artist — never accepted
// from the client.
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

const bodySchema = z.object({
  artistId: z.string().uuid(),
  eventDate: z.string().optional(),
  city: z.string().min(1),
  eventType: z.enum(eventTypes),
  genres: z.array(z.string()).default([]),
  budgetMin: z.number().int().positive().optional(),
  budgetMax: z.number().int().positive().optional(),
  crowdSize: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const supabase = await getServerSupabaseClient();
  const ctx = await requireSessionOrg(supabase);
  if ('error' in ctx) return ctx.error;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid booking request',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  try {
    const briefId = await bookAsOrganiser(supabase, {
      artistId: parsed.data.artistId,
      eventDate: parsed.data.eventDate,
      city: parsed.data.city,
      eventType: parsed.data.eventType,
      genres: parsed.data.genres,
      budgetMinPaise: parsed.data.budgetMin,
      budgetMaxPaise: parsed.data.budgetMax,
      crowdSize: parsed.data.crowdSize,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ id: briefId }, { status: 201 });
  } catch (error) {
    return moduleErrorResponse(error);
  }
}
